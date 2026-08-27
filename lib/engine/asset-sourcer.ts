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
import {
  assessMediaRequirement,
  buildMediaReadinessWarnings,
  type MediaRequirement,
} from "./media-requirement";
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
  mediaRequirement: MediaRequirement;
  assetSummary: string;
  warnings: string[];
  readinessWarnings: string[];
};

// ── Platform-safe font selection ──────────────────────────────────────────────
function selectFont(tone: string, industry: string): AssetBundle["font"] {
  const haystack = `${tone} ${industry}`.toLowerCase();
  const family = /editorial|luxury|fashion|heritage|beauty|skincare/.test(haystack)
    ? 'ui-serif, Georgia, Cambria, "Times New Roman", serif'
    : /technical|data|developer|engineering/.test(haystack)
      ? 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace'
      : 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  return {
    family,
    weights:      [400, 600, 700],
    cssImport:    "none - platform font stack; no runtime request",
    isGoogleFont: false,
    source:       "fallback",
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
  const mediaRequirement = assessMediaRequirement(analysis);

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
  } else if (mediaRequirement.level === "required" || mediaRequirement.level === "recommended") {
    warnings.push(`No Pexels API key — ${mediaRequirement.level} photography was not sourced.`);
  }

  const readinessWarnings = buildMediaReadinessWarnings(mediaRequirement, photos.length);

  const assetSummary = [
    `AVAILABLE ASSETS FOR THIS DESIGN:`,
    `MEDIA POLICY: ${mediaRequirement.level.toUpperCase()} — minimum approved images: ${mediaRequirement.minimumAssets}. ${mediaRequirement.reason}`,
    photos.length > 0
      ? `Photos (${photos.length}): ${photos.map((p, i) => `[Photo ${i + 1}] ${p.url} (credit: ${p.credit})`).join(", ")}`
      : "Photos: None available — use an honest labeled asset placeholder when imagery is essential",
    extractedPalette.length > 0
      ? `Palette extracted from hero photo: ${extractedPalette.map((c) => `${c.hex} (${c.role})`).join(", ")}`
      : "",
    `Icons (Lucide — use these names): ${icons.join(", ")}`,
    `Font stack: ${font.family} via ${font.source}; runtime import: ${font.cssImport}`,
    warnings.length > 0 ? `Sourcing warnings: ${warnings.join("; ")}` : "",
    readinessWarnings.length > 0 ? `READINESS GATE: ${readinessWarnings.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    photos,
    icons,
    font,
    extractedPalette,
    mediaRequirement,
    assetSummary,
    warnings,
    readinessWarnings,
  };
}
