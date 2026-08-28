// lib/engine/fonts-intelligence.ts
// Module Q -- Google Fonts Smart Selection
//
// Uses the Google Fonts API (free, requires free API key from Google Cloud Console)
// to validate and enhance font choices made by the LLM.
//
// Key behaviors:
//   1. Validates that proposed fonts actually exist in Google Fonts
//   2. Prefers Variable Fonts (single file, better performance)
//   3. Falls back to a curated archetype-based font list if no API key provided
//   4. Generates optimal @import URL with only needed weights
//
// API: https://www.googleapis.com/webfonts/v1/webfonts?key=YOUR_KEY
// Cost: FREE (key is free from Google Cloud Console)

import type { ArchetypeId } from "./brand-archetype-resolver";
import { CircuitBreaker } from "../application/circuit-breaker";

export type FontRecommendation = {
  family: string;
  weights: string;        // e.g. "400;600;700"
  isVariable: boolean;
  importUrl: string;
  fallback: string;       // CSS font-family fallback stack
  source: "api" | "curated";
};

export type FontIntelligenceResult = {
  display: FontRecommendation;
  body: FontRecommendation;
  mono: FontRecommendation | null;
  importBlock: string;    // complete @import CSS block
  rationale: string;
};

// ── Curated fallback library (no API key needed) ──────────────────────────────
// Selected for: expressiveness, Variable Font availability, performance

const ARCHETYPE_FONTS: Record<ArchetypeId, {
  display: string; body: string; mono?: string;
}> = {
  ruler:     { display: "Cormorant Garamond", body: "DM Sans",          mono: "DM Mono"    },
  hero:      { display: "Barlow Condensed",   body: "Barlow",           mono: "JetBrains Mono" },
  rebel:     { display: "Bebas Neue",         body: "Space Grotesk",    mono: "Space Mono" },
  magician:  { display: "Cinzel",             body: "Raleway",          mono: "Fira Code"  },
  everyman:  { display: "Nunito",             body: "Nunito",                              },
  lover:     { display: "Cormorant",          body: "Lato",             mono: undefined    },
  jester:    { display: "Paytone One",        body: "Nunito",           mono: undefined    },
  caregiver: { display: "Playfair Display",   body: "Source Sans 3",   mono: undefined    },
  creator:   { display: "Libre Baskerville",  body: "IBM Plex Sans",    mono: "IBM Plex Mono" },
  explorer:  { display: "Oswald",             body: "Quattrocento Sans",mono: undefined    },
  innocent:  { display: "Quicksand",          body: "Nunito",           mono: undefined    },
  sage:      { display: "Merriweather",       body: "Source Serif 4",   mono: "Source Code Pro" },
};

// Variable fonts list (known subset -- these support wght axis)
const VARIABLE_FONTS = new Set([
  "DM Sans", "DM Mono", "Barlow", "Space Grotesk", "Raleway", "Nunito",
  "Lato", "Source Sans 3", "IBM Plex Sans", "IBM Plex Mono",
  "Quicksand", "Source Serif 4", "Playfair Display", "Cormorant",
  "Fira Code", "JetBrains Mono", "Source Code Pro",
]);

function buildImportUrl(family: string, isVariable: boolean, weights: string): string {
  const encoded = encodeURIComponent(family);
  if (isVariable) {
    return `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weights.replace(/;/g, "..")}&display=swap`;
  }
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weights.replace(";", ",")}&display=swap`;
}

function buildFallback(family: string): string {
  const isSerif = /serif|garamond|baskerville|merriweather|playfair/i.test(family);
  const isMono = /mono|code|console/i.test(family);
  if (isMono) return `'${family}', 'Courier New', monospace`;
  if (isSerif) return `'${family}', Georgia, serif`;
  return `'${family}', system-ui, sans-serif`;
}

function makeRecommendation(
  family: string,
  weights = "400;600;700",
  source: "api" | "curated" = "curated"
): FontRecommendation {
  const isVariable = VARIABLE_FONTS.has(family);
  return {
    family,
    weights,
    isVariable,
    importUrl: buildImportUrl(family, isVariable, weights),
    fallback:  buildFallback(family),
    source,
  };
}

// ── API validation (optional -- requires GOOGLE_FONTS_API_KEY) ────────────────

async function getAvailableFonts(
  key?: string,
  breaker = new CircuitBreaker("assets:google-fonts")
): Promise<Set<string>> {
  if (!key) {
    return new Set(); // empty = skip validation
  }

  try {
    const res = await breaker.execute(() => fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${key}&sort=popularity`,
      { next: { revalidate: 86400 } }
    ));
    if (!res.ok) throw new Error("Fonts API error");
    const data = await res.json() as { items: { family: string; axes?: { tag: string }[] }[] };
    return new Set(data.items.map((font) => font.family));
  } catch {
    return new Set();
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function selectFontsForArchetype(
  archetypeId: ArchetypeId,
  proposedDisplay?: string,
  proposedBody?: string,
  dependencies: { googleFontsApiKey?: string; breaker?: CircuitBreaker } = {}
): Promise<FontIntelligenceResult> {
  const curated = ARCHETYPE_FONTS[archetypeId] ?? ARCHETYPE_FONTS["everyman"];
  const available = await getAvailableFonts(dependencies.googleFontsApiKey, dependencies.breaker);

  // Validate proposed fonts against API (if key exists), fallback to curated
  const resolveFont = (proposed: string | undefined, curatedFallback: string): string => {
    if (proposed && (available.size === 0 || available.has(proposed))) {
      return proposed; // use proposed if valid or no API to check
    }
    return curatedFallback;
  };

  const displayFamily = resolveFont(proposedDisplay, curated.display);
  const bodyFamily    = resolveFont(proposedBody, curated.body);
  const monoFamily    = curated.mono;

  const display = makeRecommendation(displayFamily, "400;600;700");
  const body    = makeRecommendation(bodyFamily,    "400;500");
  const mono    = monoFamily ? makeRecommendation(monoFamily, "400;500") : null;

  // Build combined @import block
  const imports = [display, body, ...(mono ? [mono] : [])]
    .filter((f, i, arr) => arr.findIndex((x) => x.family === f.family) === i) // dedupe
    .map((f) => `@import url('${f.importUrl}');`)
    .join("\n");

  const rationale = [
    `Display: ${display.family} (${display.isVariable ? "Variable Font -- single file" : "static"}, source: ${display.source})`,
    `Body: ${body.family} (${body.isVariable ? "Variable Font" : "static"}, source: ${body.source})`,
    mono ? `Mono: ${mono.family}` : null,
    `Archetype: ${archetypeId} -- fonts selected for emotional alignment`,
  ].filter(Boolean).join(". ");

  return {
    display,
    body,
    mono,
    importBlock: imports,
    rationale,
  };
}
