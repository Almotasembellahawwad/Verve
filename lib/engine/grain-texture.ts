// lib/engine/grain-texture.ts
// Module P -- Physical Grain / Material Texture Engine
//
// Generates SVG feTurbulence grain filters embedded as CSS custom properties.
// Zero external dependencies -- pure SVG/CSS.
// Each Jungian archetype gets a distinct material personality.
//
// Performance rules (from research):
//   - Apply only to ::before pseudo-element (never to body/large containers)
//   - numOctaves: max 2 (static, no animation)
//   - mix-blend-mode: overlay (preserves color underneath)
//   - pointer-events: none (no interaction cost)

import type { ArchetypeId } from "./brand-archetype-resolver";

export type GrainProfile = {
  archetypeId: ArchetypeId;
  materialName: string;
  baseFrequency: string;   // e.g. "0.65" or "0.45 0.35"
  numOctaves: number;      // 1-2 only
  seed: number;            // deterministic per archetype
  opacity: number;         // 0.02 to 0.06 -- subtle
  blendMode: string;       // overlay | soft-light | screen
  description: string;
};

// Each archetype maps to a distinct material feel
const GRAIN_PROFILES: Record<ArchetypeId, GrainProfile> = {
  ruler: {
    archetypeId:   "ruler",
    materialName:  "Cold-pressed cotton paper",
    baseFrequency: "0.55 0.45",
    numOctaves:    2,
    seed:          42,
    opacity:       0.04,
    blendMode:     "overlay",
    description:   "Formal, dense grain -- authority press material",
  },
  hero: {
    archetypeId:   "hero",
    materialName:  "Brushed aluminum",
    baseFrequency: "0.72",
    numOctaves:    2,
    seed:          17,
    opacity:       0.035,
    blendMode:     "overlay",
    description:   "Fine metallic grain -- strength and precision",
  },
  rebel: {
    archetypeId:   "rebel",
    materialName:  "Raw concrete",
    baseFrequency: "0.35 0.28",
    numOctaves:    2,
    seed:          88,
    opacity:       0.06,
    blendMode:     "soft-light",
    description:   "Coarse, irregular grain -- disruption and rawness",
  },
  magician: {
    archetypeId:   "magician",
    materialName:  "Iridescent film",
    baseFrequency: "0.80 0.65",
    numOctaves:    1,
    seed:          23,
    opacity:       0.03,
    blendMode:     "screen",
    description:   "Fine luminous grain -- transformation and wonder",
  },
  everyman: {
    archetypeId:   "everyman",
    materialName:  "Natural linen",
    baseFrequency: "0.50 0.40",
    numOctaves:    2,
    seed:          31,
    opacity:       0.04,
    blendMode:     "overlay",
    description:   "Woven textile grain -- approachable and familiar",
  },
  lover: {
    archetypeId:   "lover",
    materialName:  "Matte velvet",
    baseFrequency: "0.90 0.75",
    numOctaves:    1,
    seed:          56,
    opacity:       0.025,
    blendMode:     "soft-light",
    description:   "Ultra-fine, smooth grain -- intimacy and sensory richness",
  },
  jester: {
    archetypeId:   "jester",
    materialName:  "Coated newsprint",
    baseFrequency: "0.60 0.80",
    numOctaves:    2,
    seed:          7,
    opacity:       0.05,
    blendMode:     "overlay",
    description:   "Irregular halftone-like grain -- playful, surprising",
  },
  caregiver: {
    archetypeId:   "caregiver",
    materialName:  "Watercolor paper",
    baseFrequency: "0.45 0.35",
    numOctaves:    2,
    seed:          64,
    opacity:       0.035,
    blendMode:     "soft-light",
    description:   "Soft, absorbent grain -- warmth and care",
  },
  creator: {
    archetypeId:   "creator",
    materialName:  "Cold-press illustration board",
    baseFrequency: "0.62 0.50",
    numOctaves:    2,
    seed:          19,
    opacity:       0.04,
    blendMode:     "overlay",
    description:   "Textured craft paper -- artisanal and deliberate",
  },

  explorer: {
    archetypeId:   "explorer",
    materialName:  "Weathered map paper",
    baseFrequency: "0.42 0.55",
    numOctaves:    2,
    seed:          93,
    opacity:       0.05,
    blendMode:     "overlay",
    description:   "Aged, textured grain -- adventure and discovery",
  },
  innocent: {
    archetypeId:   "innocent",
    materialName:  "Tracing paper",
    baseFrequency: "0.85",
    numOctaves:    1,
    seed:          11,
    opacity:       0.02,
    blendMode:     "soft-light",
    description:   "Barely-there grain -- purity, lightness, optimism",
  },
  sage: {
    archetypeId:   "sage",
    materialName:  "Uncoated offset paper",
    baseFrequency: "0.58 0.42",
    numOctaves:    2,
    seed:          77,
    opacity:       0.04,
    blendMode:     "overlay",
    description:   "Academic, matte grain -- knowledge and clarity",
  },
};

// ── SVG generation ────────────────────────────────────────────────────────────

export function generateGrainSVG(profile: GrainProfile): string {
  // Inline SVG encoded as a data URI for use in CSS
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${profile.baseFrequency}' numOctaves='${profile.numOctaves}' seed='${profile.seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23g)' opacity='1'/></svg>`;
  return `url("data:image/svg+xml,${svg}")`;
}

/**
 * Generates CSS custom properties + a ::before rule snippet
 * that can be injected into the generated design code.
 */
export function buildGrainCSS(archetypeId: ArchetypeId): {
  cssVars: string;
  pseudoElementRule: string;
  materialName: string;
  description: string;
} {
  const profile = GRAIN_PROFILES[archetypeId] ?? GRAIN_PROFILES["everyman"];
  const svgUrl  = generateGrainSVG(profile);

  const cssVars = `
  /* Physical Material Texture -- Module P (${profile.materialName}) */
  --grain-url: ${svgUrl};
  --grain-opacity: ${profile.opacity};
  --grain-blend: ${profile.blendMode};`.trim();

  const pseudoElementRule = `
/* Grain overlay -- applied via ::before to limit paint area */
.verve-grain::before {
  content: '';
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background-image: var(--grain-url);
  background-repeat: repeat;
  background-size: 200px 200px;
  opacity: var(--grain-opacity);
  mix-blend-mode: var(--grain-blend);
  pointer-events: none;
  z-index: 0;
}`.trim();

  return {
    cssVars,
    pseudoElementRule,
    materialName: profile.materialName,
    description:  profile.description,
  };
}

/**
 * Returns a code injection instruction for the code generator.
 * Tells it exactly what class to add to the root element.
 */
export function getGrainCodeHint(archetypeId: ArchetypeId): string {
  const profile = GRAIN_PROFILES[archetypeId] ?? GRAIN_PROFILES["everyman"];
  return [
    `// PHYSICAL TEXTURE: Add class="verve-grain" to your root <div> or <main> element.`,
    `// Material: ${profile.materialName} -- ${profile.description}`,
    `// The grain is a ::before pseudo-element (no DOM node, no performance cost).`,
    `// CSS vars: --grain-url, --grain-opacity (${profile.opacity}), --grain-blend (${profile.blendMode})`,
  ].join("\n");
}
