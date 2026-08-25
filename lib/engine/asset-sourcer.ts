// =========================================================
// lib/engine/asset-sourcer.ts
// Module H: Asset Sourcing Engine
//
// Sources:
//   - Pexels API (free, commercial use, no attribution required)
//   - Lucide Icons (contextual, SVG-based)
//   - Fontshare API (high-quality, less-common than Google Fonts)
//   - colorthief (extracts real palette from Pexels image — Phase 2.5)
//
// Timeouts (Phase 1.6):
//   - Pexels: 8s
//   - Fontshare verify: skipped (CSS @import URL is deterministic)
// =========================================================

import type { BriefAnalysis } from "./brief-analyzer";
import { scorePhotoAgainstBlocklist, getContextualIcons } from "./asset-blocklist";
import { getPalette } from "colorthief";

const PEXELS_TIMEOUT_MS = 8_000;

// ── Types ─────────────────────────────────────────────────────────────────────
export type PexelsPhoto = {
  id: number;
  url: string;
  src: { medium: string; large: string; large2x: string };
  alt: string;
  photographer: string;
  photographer_url: string;
};

export type AssetBundle = {
  photos: {
    url: string;
    alt: string;
    photographer: string;
    credit: string;
    dominant_hex: string;
  }[];
  icons: string[];
  font: {
    family: string;
    weights: number[];
    cssImport: string;
    isGoogleFont: boolean;
    source: "fontshare" | "google" | "fallback";
  };
  extractedPalette: { hex: string; role: string }[];
  assetSummary: string;
  warnings: string[];
};

// ── Fontshare catalog ─────────────────────────────────────────────────────────
const FONTSHARE_CATALOG: { family: string; moods: string[]; weights: number[]; cssSlug: string }[] = [
  { family: "Satoshi",         moods: ["modern", "tech", "clean", "startup"],           weights: [400, 500, 700, 900], cssSlug: "satoshi" },
  { family: "Clash Display",   moods: ["bold", "editorial", "fashion", "creative"],     weights: [400, 500, 600, 700], cssSlug: "clash-display" },
  { family: "General Sans",    moods: ["neutral", "corporate", "trustworthy", "finance"], weights: [300, 400, 500, 600], cssSlug: "general-sans" },
  { family: "Syne",            moods: ["creative", "art", "motion", "design"],          weights: [400, 600, 700, 800], cssSlug: "syne" },
  { family: "Cabinet Grotesk", moods: ["saas", "product", "developer", "tool"],         weights: [400, 500, 700, 800], cssSlug: "cabinet-grotesk" },
  { family: "Switzer",         moods: ["minimal", "legal", "consulting", "professional"], weights: [400, 500, 600], cssSlug: "switzer" },
  { family: "Zodiak",          moods: ["luxury", "premium", "finance", "wealth"],       weights: [300, 400, 700], cssSlug: "zodiak" },
  { family: "Boska",           moods: ["editorial", "magazine", "lifestyle", "food"],   weights: [400, 500, 700, 900], cssSlug: "boska" },
  { family: "Chillax",         moods: ["friendly", "health", "wellness", "lifestyle"],  weights: [400, 500, 600, 700], cssSlug: "chillax" },
  { family: "Gambetta",        moods: ["environment", "sustainability", "nature"],      weights: [300, 400, 600], cssSlug: "gambetta" },
];

const BLOCKED_GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Nunito", "Source Sans", "Raleway", "Noto Sans",
];

function selectFont(tone: string, industry: string): AssetBundle["font"] {
  const haystack = `${tone} ${industry}`.toLowerCase();
  const match    = FONTSHARE_CATALOG.find((f) => f.moods.some((m) => haystack.includes(m)));
  const chosen   = match ?? FONTSHARE_CATALOG[0]!;
  const weights  = match ? chosen.weights : [400, 500, 700];
  return {
    family:       chosen.family,
    weights,
    cssImport:    `@import url('https://api.fontshare.com/v2/css?f[]=${chosen.cssSlug}@${weights.join(",")}&display=swap');`,
    isGoogleFont: false,
    source:       "fontshare",
  };
}

// ── Real palette extraction via colorthief (Phase 2.5) ──────────────────────
// colorthief works in Node.js with Buffer — no canvas required.
async function extractPaletteFromUrl(
  imageUrl: string
): Promise<{ hex: string; role: string }[]> {
  try {
    // Fetch image with timeout
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6_000);
    const res = await fetch(imageUrl, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return [];

    const buf = Buffer.from(await res.arrayBuffer());

    const palette = await getPalette(buf, { colorCount: 5 });

    const roles = ["primary", "secondary", "accent", "neutral", "background"];
    return (palette ?? []).map((color, i) => ({
      hex: color.hex(),
      role: roles[i] ?? `color-${i + 1}`,
    }));
  } catch {
    // Non-fatal: fall back to empty array, plan generator derives colors from brief
    return [];
  }
}

// ── Pexels fetch with timeout (Phase 1.6) ────────────────────────────────────
async function fetchPexelsPhotos(query: string, apiKey: string, count = 5): Promise<PexelsPhoto[]> {
  const url  = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count * 3}&orientation=landscape`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("Pexels timeout")), PEXELS_TIMEOUT_MS);

  try {
    const res = await fetch(url, { headers: { Authorization: apiKey }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
    const data = await res.json() as { photos: PexelsPhoto[] };

    return data.photos
      .filter((photo) => {
        const check = scorePhotoAgainstBlocklist(photo.alt ?? "", []);
        return !check.isCliche || check.severity === "medium";
      })
      .slice(0, count);
  } finally {
    clearTimeout(timer);
  }
}

function buildPexelsQuery(analysis: BriefAnalysis): string {
  const subject  = analysis.subject
    .replace(/\b(website|landing page|app|platform|tool|software|saas)\b/gi, "")
    .trim()
    .slice(0, 50);
  return `${subject} ${analysis.industry}`.trim().slice(0, 80);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function sourceAssets(
  analysis: BriefAnalysis,
  pexelsKey?: string
): Promise<AssetBundle> {
  const warnings: string[] = [];
  const icons = getContextualIcons(analysis.industry, analysis.tone);
  const font  = selectFont(analysis.tone, analysis.industry);

  if (BLOCKED_GOOGLE_FONTS.includes(font.family)) {
    warnings.push(`Font "${font.family}" is in the blocked defaults list — using Fontshare fallback`);
  }

  let photos: AssetBundle["photos"]             = [];
  let extractedPalette: AssetBundle["extractedPalette"] = [];

  if (pexelsKey) {
    try {
      const query = buildPexelsQuery(analysis);
      const raw   = await fetchPexelsPhotos(query, pexelsKey, 3);

      photos = raw.map((p) => ({
        url:          p.src.large,
        alt:          p.alt,
        photographer: p.photographer,
        credit:       `Photo by ${p.photographer} on Pexels`,
        dominant_hex: "#888888", // overwritten below after real extraction
      }));

      if (photos.length > 0) {
        // Real palette extraction (Phase 2.5) — non-fatal if it fails
        extractedPalette = await extractPaletteFromUrl(photos[0].url);
        if (extractedPalette.length > 0) {
          photos[0].dominant_hex = extractedPalette[0].hex;
        }
      }

      if (raw.length === 0) {
        warnings.push(`Pexels returned 0 non-cliché photos for query: "${query}". Try a more specific brief.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Pexels unavailable: ${msg}. Continuing without photos.`);
    }
  } else {
    warnings.push("No Pexels API key — photos skipped. Add a Pexels key in Settings for real asset sourcing.");
  }

  const assetSummary = [
    `AVAILABLE ASSETS FOR THIS DESIGN:`,
    photos.length > 0
      ? `Photos (${photos.length}): ${photos.map((p, i) => `[Photo ${i + 1}] ${p.url} (credit: ${p.credit})`).join(", ")}`
      : "Photos: None available — use CSS-only visual treatment or gradient placeholder",
    extractedPalette.length > 0
      ? `Palette extracted from hero photo: ${extractedPalette.map((c) => `${c.hex} (${c.role})`).join(", ")}`
      : "",
    `Icons (Lucide — use these names): ${icons.join(", ")}`,
    `Font: "${font.family}" via ${font.source} — CSS import: ${font.cssImport}`,
    warnings.length > 0 ? `Warnings: ${warnings.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { photos, icons, font, extractedPalette, assetSummary, warnings };
}
