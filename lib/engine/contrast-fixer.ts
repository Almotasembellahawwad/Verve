// lib/engine/contrast-fixer.ts
// Module O -- Automatic Color Contrast Enforcement
//
// Uses WCAG 2.1 relative luminance algorithm (APCA-compatible math)
// to ensure every text/background pair meets AA standard (4.5:1 ratio).
// Zero LLM calls -- pure deterministic math.
//
// When a pair fails, we adjust the text color lightness until it passes,
// preserving the hue and saturation so the design identity is unchanged.

export type ColorPair = {
  name: string;        // e.g. "headline on background"
  textHex: string;     // e.g. "#F0ECD6"
  bgHex: string;       // e.g. "#141210"
  usage: string;       // e.g. "h1, h2 on primary background"
};

export type ContrastResult = {
  pair: string;
  ratio: number;
  passesAA: boolean;   // 4.5:1 for normal text
  passesAAA: boolean;  // 7:1
  fixedTextHex: string | null;  // null if no fix needed
  originalTextHex: string;
};

export type ContrastFixReport = {
  checked: ContrastResult[];
  fixesApplied: number;
  allPass: boolean;
};

// ── Hex helpers ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

// WCAG 2.1 relative luminance
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(...hexToRgb(hex1));
  const l2 = relativeLuminance(...hexToRgb(hex2));
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// RGB <-> HSL conversion for luminance adjustment
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      case bn: h = ((rn - gn) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// ── Core fix logic ────────────────────────────────────────────────────────────

/**
 * Given a text hex and bg hex, adjusts text color lightness until AA passes.
 * Returns the adjusted hex (or null if already passing).
 */
function fixContrastColor(textHex: string, bgHex: string, targetRatio = 4.5): string | null {
  if (contrastRatio(textHex, bgHex) >= targetRatio) return null; // already passing

  const [r, g, b] = hexToRgb(textHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const bgLum = relativeLuminance(...hexToRgb(bgHex));
  const isDarkBg = bgLum < 0.5;

  // Binary search lightness toward white (dark bg) or black (light bg)
  let lo = isDarkBg ? l : 0;
  let hi = isDarkBg ? 1 : l;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const [nr, ng, nb] = hslToRgb(h, s, mid);
    const candidate = rgbToHex(nr, ng, nb);
    if (contrastRatio(candidate, bgHex) >= targetRatio) {
      if (isDarkBg) hi = mid; else lo = mid;
    } else {
      if (isDarkBg) lo = mid; else hi = mid;
    }
  }

  const [fr, fg, fb] = hslToRgb(h, s, isDarkBg ? hi : lo);
  return rgbToHex(fr, fg, fb);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Checks and auto-fixes color contrast for a palette.
 * Modifies pairs in-place and returns a report.
 */
export function enforceContrast(pairs: ColorPair[]): ContrastFixReport {
  const checked: ContrastResult[] = [];
  let fixesApplied = 0;

  for (const pair of pairs) {
    // Capture BEFORE any mutation
    const originalTextHex = pair.textHex;
    const ratioBefore     = contrastRatio(pair.textHex, pair.bgHex);
    const passesAABefore  = ratioBefore >= 4.5;
    const fixedTextHex    = fixContrastColor(pair.textHex, pair.bgHex);

    let finalPassesAA = passesAABefore;

    if (fixedTextHex) {
      fixesApplied++;
      pair.textHex  = fixedTextHex;
      // Recalculate ratio with the fixed color for accurate allPass evaluation
      const fixedRatio = contrastRatio(fixedTextHex, pair.bgHex);
      finalPassesAA    = fixedRatio >= 4.5;
    }

    checked.push({
      pair:            pair.name,
      ratio:           Math.round(contrastRatio(pair.textHex, pair.bgHex) * 100) / 100,
      passesAA:        finalPassesAA,
      passesAAA:       contrastRatio(pair.textHex, pair.bgHex) >= 7,
      fixedTextHex,
      originalTextHex, // ← now correctly the PRE-fix value
    });
  }

  return {
    checked,
    fixesApplied,
    allPass: checked.every((c) => c.passesAA),
  };
}

function findClosestColorPassingAll(textHex: string, backgrounds: string[], targetRatio = 4.5): string | null {
  if (backgrounds.every((bg) => contrastRatio(textHex, bg) >= targetRatio)) return null;

  const [r, g, b] = hexToRgb(textHex);
  const [h, s, originalLightness] = rgbToHsl(r, g, b);
  let closest: { hex: string; distance: number } | null = null;

  // Search both directions once, then apply one stable replacement to every
  // usage of the text token. This avoids contradictory per-background fixes.
  for (let step = 0; step <= 200; step++) {
    const lightness = step / 200;
    const candidate = rgbToHex(...hslToRgb(h, s, lightness));
    if (!backgrounds.every((bg) => contrastRatio(candidate, bg) >= targetRatio)) continue;
    const distance = Math.abs(lightness - originalLightness);
    if (!closest || distance < closest.distance) closest = { hex: candidate, distance };
  }

  return closest?.hex ?? null;
}

/**
 * Extract color pairs from a DesignPlan and fix them.
 * Returns the updated palette and a contrast report.
 */
export function fixPaletteContrast(
  palette: { name: string; hex: string; role: string }[]
): { fixedPalette: typeof palette; report: ContrastFixReport } {
  if (palette.length === 0) {
    return {
      fixedPalette: palette,
      report: { checked: [], fixesApplied: 0, allPass: false },
    };
  }

  // Find background colors (by role naming convention)
  const bgColors = palette.filter((c) =>
    /background|bg|base|surface|dark|light/i.test(c.role)
  );
  const textColors = palette.filter((c) =>
    /text|heading|body|copy|title|foreground|content/i.test(c.role)
  );

  // If no clear bg/text split, use darkest as bg and lightest as text
  const sortedByLum = [...palette].sort((a, b) => {
    const la = relativeLuminance(...hexToRgb(a.hex));
    const lb = relativeLuminance(...hexToRgb(b.hex));
    return la - lb;
  });

  const actualBg = bgColors.length > 0 ? bgColors : [sortedByLum[0]!];
  const actualText = textColors.length > 0 ? textColors : [sortedByLum[sortedByLum.length - 1]!];

  const replacements = new Map<string, string>();
  for (const text of actualText) {
    const backgrounds = actualBg.filter((bg) => bg.hex !== text.hex).map((bg) => bg.hex);
    if (backgrounds.length === 0) continue;
    const fixed = findClosestColorPassingAll(text.hex, backgrounds);
    if (fixed) replacements.set(text.hex.toLowerCase(), fixed);
  }

  const fixedPalette = palette.map((color) => {
    const replacement = replacements.get(color.hex.toLowerCase());
    return replacement ? { ...color, hex: replacement } : color;
  });

  const fixedByName = new Map(fixedPalette.map((color) => [color.name, color]));
  const checked: ContrastResult[] = [];
  for (const bg of actualBg) {
    for (const text of actualText) {
      if (bg.hex === text.hex) continue;
      const finalTextHex = fixedByName.get(text.name)?.hex ?? text.hex;
      const finalBgHex = fixedByName.get(bg.name)?.hex ?? bg.hex;
      const ratio = contrastRatio(finalTextHex, finalBgHex);
      checked.push({
        pair: `${text.name} on ${bg.name}`,
        ratio: Math.round(ratio * 100) / 100,
        passesAA: ratio >= 4.5,
        passesAAA: ratio >= 7,
        fixedTextHex: finalTextHex !== text.hex ? finalTextHex : null,
        originalTextHex: text.hex,
      });
    }
  }

  const report: ContrastFixReport = {
    checked,
    fixesApplied: replacements.size,
    allPass: checked.length > 0 && checked.every((check) => check.passesAA),
  };

  return { fixedPalette, report };
}
