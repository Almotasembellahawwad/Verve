// =========================================================
// lib/engine/asset-sourcer.ts
// Module H: Asset Sourcing Engine
//
// Order in pipeline:
//   [01] Brief Analyzer → BriefAnalysis
//   [02] Asset Sourcer  → AssetBundle  ← THIS MODULE
//   [03] Cliché Blocklist
//   [04] Plan Generator (receives AssetBundle as context)
//   [05] Critique Loop
//   [06] Code Generator (uses real asset URLs)
//   [07] Scorer
//
// Sources:
//   - Pexels API (free, commercial use, no attribution required)
//   - Lucide Icons (contextual, SVG-based)
//   - Fontshare API (high-quality, less-common than Google Fonts)
//   - color-thief (extracts palette from Pexels image)
// =========================================================

import type { BriefAnalysis } from "./brief-analyzer";
import { scorePhotoAgainstBlocklist, getContextualIcons } from "./asset-blocklist";

// ── Types ─────────────────────────────────────────────────────────────────────
export type PexelsPhoto = {
  id: number;
  url: string;          // Pexels page URL
  src: {
    medium: string;
    large: string;
    large2x: string;
  };
  alt: string;
  photographer: string;
  photographer_url: string;
};

export type AssetBundle = {
  photos: {
    url: string;
    alt: string;
    photographer: string;
    credit: string;       // "Photo by X on Pexels"
    dominant_hex: string; // extracted by color-thief
  }[];
  icons: string[];          // Lucide icon names (contextual)
  font: {
    family: string;
    weights: number[];
    cssImport: string;    // @import url(...)
    isGoogleFont: boolean;
    source: "fontshare" | "google" | "fallback";
  };
  extractedPalette: { hex: string; role: string }[]; // from color-thief on hero photo
  assetSummary: string;   // human-readable for LLM context injection
  warnings: string[];     // any clichés avoided or API failures
};

// ── Fontshare catalog subset ──────────────────────────────────────────────────
// Curated fonts from Fontshare — less common than Inter/Roboto
// Filtered by mood/tone
const FONTSHARE_CATALOG: {
  family: string;
  moods: string[];
  weights: number[];
  cssSlug: string;
}[] = [
  { family: "Satoshi",        moods: ["modern", "tech", "clean", "startup"],   weights: [400, 500, 700, 900], cssSlug: "satoshi" },
  { family: "Clash Display",  moods: ["bold", "editorial", "fashion", "creative"], weights: [400, 500, 600, 700], cssSlug: "clash-display" },
  { family: "General Sans",   moods: ["neutral", "corporate", "trustworthy", "finance"], weights: [300, 400, 500, 600], cssSlug: "general-sans" },
  { family: "Syne",           moods: ["creative", "art", "motion", "design"],  weights: [400, 600, 700, 800], cssSlug: "syne" },
  { family: "Cabinet Grotesk",moods: ["saas", "product", "developer", "tool"], weights: [400, 500, 700, 800], cssSlug: "cabinet-grotesk" },
  { family: "Switzer",        moods: ["minimal", "legal", "consulting", "professional"], weights: [400, 500, 600], cssSlug: "switzer" },
  { family: "Zodiak",         moods: ["luxury", "premium", "finance", "wealth"], weights: [300, 400, 700], cssSlug: "zodiak" },
  { family: "Boska",          moods: ["editorial", "magazine", "lifestyle", "food"], weights: [400, 500, 700, 900], cssSlug: "boska" },
  { family: "Chillax",        moods: ["friendly", "health", "wellness", "lifestyle"], weights: [400, 500, 600, 700], cssSlug: "chillax" },
  { family: "Gambetta",       moods: ["environment", "sustainability", "nature", "impact"], weights: [300, 400, 600], cssSlug: "gambetta" },
];

// Fonts that are BLOCKED (same logic as design clichés)
const BLOCKED_GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Nunito", "Source Sans", "Raleway", "Noto Sans",
];

function selectFont(tone: string, industry: string): AssetBundle["font"] {
  const haystack = `${tone} ${industry}`.toLowerCase();

  // Try Fontshare first (mood match)
  const match = FONTSHARE_CATALOG.find((f) =>
    f.moods.some((m) => haystack.includes(m))
  );

  if (match) {
    return {
      family: match.family,
      weights: match.weights,
      cssImport: `@import url('https://api.fontshare.com/v2/css?f[]=${match.cssSlug}@${match.weights.join(",")}&display=swap');`,
      isGoogleFont: false,
      source: "fontshare",
    };
  }

  // Fallback: first Fontshare entry (always better than Inter)
  const fallback = FONTSHARE_CATALOG[0];
  return {
    family: fallback.family,
    weights: [400, 500, 700],
    cssImport: `@import url('https://api.fontshare.com/v2/css?f[]=${fallback.cssSlug}@400,500,700&display=swap');`,
    isGoogleFont: false,
    source: "fontshare",
  };
}

// ── color-thief palette extraction ──────────────────────────────────────────
async function extractPaletteFromUrl(
  _imageUrl: string
): Promise<{ hex: string; role: string }[]> {
  // color-thief extraction requires canvas which is not available
  // in Next.js edge/serverless by default.
  // We return an empty array — the plan generator will derive colors from the brief instead.
  // Future: implement with @resvg/resvg-js or sharp for server-side extraction.
  return [];
}

// ── Pexels photo fetch + filter ───────────────────────────────────────────────
async function fetchPexelsPhotos(
  query: string,
  apiKey: string,
  count = 5
): Promise<PexelsPhoto[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count * 3}&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
  const data = await res.json() as { photos: PexelsPhoto[] };

  // Filter against asset cliché blocklist
  return data.photos
    .filter((photo) => {
      const check = scorePhotoAgainstBlocklist(photo.alt ?? "", []);
      return !check.isCliche || check.severity === "medium"; // strict: block high-severity clichés
    })
    .slice(0, count);
}

// ── Build Pexels search query from BriefAnalysis ─────────────────────────────
function buildPexelsQuery(analysis: BriefAnalysis): string {
  // Avoid generic queries — use subject + industry, not tone words like "professional"
  const subject = analysis.subject
    .replace(/\b(website|landing page|app|platform|tool|software|saas)\b/gi, "")
    .trim()
    .slice(0, 50);

  const industry = analysis.industry;

  // Combine — e.g., "carbon accounting manufacturing" not "professional business success"
  return `${subject} ${industry}`.trim().slice(0, 80);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function sourceAssets(
  analysis: BriefAnalysis,
  pexelsKey?: string
): Promise<AssetBundle> {
  const warnings: string[] = [];
  const icons = getContextualIcons(analysis.industry, analysis.tone);
  const font = selectFont(analysis.tone, analysis.industry);

  // Check for blocked Google Fonts in selection
  if (BLOCKED_GOOGLE_FONTS.includes(font.family)) {
    warnings.push(`Font "${font.family}" is in the blocked defaults list — using Fontshare fallback`);
  }

  let photos: AssetBundle["photos"] = [];
  let extractedPalette: AssetBundle["extractedPalette"] = [];

  if (pexelsKey) {
    try {
      const query = buildPexelsQuery(analysis);
      const raw = await fetchPexelsPhotos(query, pexelsKey, 3);

      photos = raw.map((p) => ({
        url: p.src.large,
        alt: p.alt,
        photographer: p.photographer,
        credit: `Photo by ${p.photographer} on Pexels`,
        dominant_hex: "#000000", // placeholder, overwritten below
      }));

      // Extract palette from hero photo
      if (photos.length > 0) {
        extractedPalette = await extractPaletteFromUrl(photos[0].url);
        if (extractedPalette.length > 0) {
          photos[0].dominant_hex = extractedPalette[0].hex;
        }
      }

      if (raw.length === 0) {
        warnings.push(`Pexels returned 0 non-cliché photos for query: "${query}". Try a more specific brief.`);
      }
    } catch (err) {
      warnings.push(`Pexels API unavailable: ${err instanceof Error ? err.message : String(err)}. Continuing without photos.`);
    }
  } else {
    warnings.push("No Pexels API key — photos skipped. Add a Pexels key in 'Set API key' for real asset sourcing.");
  }

  const assetSummary = [
    `AVAILABLE ASSETS FOR THIS DESIGN:`,
    photos.length > 0
      ? `Photos (${photos.length}): ${photos.map((p, i) => `[Photo ${i + 1}] ${p.url} (credit: ${p.credit})`).join(", ")}`
      : "Photos: None available — use CSS-only visual treatment or placeholder",
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
