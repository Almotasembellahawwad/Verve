// lib/export.ts
// Export Options — generate downloadable files from a design plan

import type { DesignPlan } from "./engine/plan-generator";

// ── Type system token helper ──────────────────────────────────────────────────
function typeScaleVars(plan: DesignPlan): string {
  const display = plan.typePairing?.display ?? "sans-serif";
  const body    = plan.typePairing?.body    ?? "sans-serif";
  return [
    `  /* Typography */`,
    `  --font-display:     '${display}', sans-serif;`,
    `  --font-body:        '${body}', sans-serif;`,
    `  --font-mono:        'Courier New', monospace;`,
    `  /* Type Scale */`,
    `  --text-caption:     11px;`,
    `  --text-sm:          13px;`,
    `  --text-base:        17px;`,
    `  --text-md:          21px;`,
    `  --text-lg:          28px;`,
    `  --text-xl:          40px;`,
    `  --text-2xl:         56px;`,
    `  --text-3xl:         80px;`,
    `  /* Line Heights */`,
    `  --leading-tight:    0.95;`,
    `  --leading-heading:  1.1;`,
    `  --leading-body:     1.75;`,
    `  --leading-caption:  1.5;`,
    `  /* Letter Spacing */`,
    `  --tracking-tight:   -0.04em;`,
    `  --tracking-display: -0.02em;`,
    `  --tracking-body:    0;`,
    `  --tracking-caption: 0.12em;`,
    `  --tracking-label:   0.2em;`,
  ].join("\n");
}

// ── CSS Variables export ──────────────────────────────────────────────────────
export function exportCSSVars(plan: DesignPlan, briefSlug: string): string {
  const colors = plan.colorPalette
    .map((c) => {
      const varName = `--color-${c.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;
      return `  ${varName}: ${c.hex}; /* ${c.role} */`;
    })
    .join("\n");

  const typeVars = typeScaleVars(plan);

  return `/* ============================================================
   Verve Design Tokens
   Brief: ${briefSlug}
   Generated: ${new Date().toISOString()}
   Score: ${(plan as Record<string, unknown>).__score ?? "–"}/100
   ============================================================ */

:root {
  /* ── Color Palette ──────────────────────── */
${colors}

${typeVars}

  /* ── Spacing ────────────────────────────── */
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-6:   24px;
  --space-8:   32px;
  --space-12:  48px;
  --space-16:  64px;
  --space-24:  96px;
  --space-32:  128px;

  /* ── Border Radius ──────────────────────── */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;

  /* ── Animation ──────────────────────────── */
  --ease-primary:     cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-fast:         200ms;
  --dur-medium:       400ms;
  --dur-slow:         700ms;
}

/* ── Semantic aliases ─────────────────────────────────────── */
:root {
  --color-bg:      ${plan.colorPalette[plan.colorPalette.length - 1]?.hex ?? "#fff"};
  --color-surface: ${plan.colorPalette[plan.colorPalette.length - 2]?.hex ?? "#f5f5f5"};
  --color-text:    ${plan.colorPalette[0]?.hex ?? "#000"};
  --color-accent:  ${plan.colorPalette[Math.floor(plan.colorPalette.length / 2)]?.hex ?? "#000"};
}
`;
}

// ── Figma / Style Dictionary tokens ──────────────────────────────────────────
export function exportFigmaTokens(plan: DesignPlan): string {
  const colors: Record<string, { value: string; type: "color"; description: string }> = {};
  for (const c of plan.colorPalette) {
    const key = c.name.toLowerCase().replace(/\s+/g, "_");
    colors[key] = { value: c.hex, type: "color", description: c.role };
  }

  const typography = {
    display: {
      fontFamily: { value: plan.typePairing?.display ?? "sans-serif", type: "fontFamilies" },
      lineHeight: { value: "0.95", type: "lineHeights" },
      letterSpacing: { value: "-4%", type: "letterSpacing" },
    },
    body: {
      fontFamily: { value: plan.typePairing?.body ?? "sans-serif", type: "fontFamilies" },
      lineHeight: { value: "1.75", type: "lineHeights" },
      letterSpacing: { value: "0%", type: "letterSpacing" },
    },
  };

  const spacing: Record<string, { value: string; type: "spacing" }> = {};
  [4, 8, 12, 16, 24, 32, 48, 64, 96, 128].forEach((v) => {
    spacing[`space_${v}`] = { value: `${v}px`, type: "spacing" };
  });

  return JSON.stringify({ global: { colors, typography, spacing } }, null, 2);
}

// ── README setup guide ────────────────────────────────────────────────────────
export function exportREADME(plan: DesignPlan, brief: string): string {
  const palette = plan.colorPalette.map(
    (c) => `| \`${c.hex}\` | ${c.name} | ${c.role} |`
  ).join("\n");

  return `# Verve Design System — Setup Guide

**Brief**: ${brief.slice(0, 200)}${brief.length > 200 ? "..." : ""}
**Generated**: ${new Date().toLocaleDateString()}
**Signature Element**: ${plan.signatureElement?.name ?? "–"}

---

## 1. Typography

### Local font delivery
\`\`\`html
<!-- Font files and @font-face rules ship inside the complete generated project. -->
\`\`\`

**License and integrity receipt:**
\`\`\`html
<!-- See ASSETS.md and FONT-LICENSES.md. Do not add a runtime font CDN. -->
\`\`\`

| Role | Font | Rationale |
|------|------|-----------|
| Display | ${plan.typePairing?.display ?? "–"} | ${plan.typePairing?.rationale?.slice(0, 80) ?? "–"}... |
| Body | ${plan.typePairing?.body ?? "–"} | – |

---

## 2. Color Palette

| Hex | Name | Usage |
|-----|------|-------|
${palette}

---

## 3. Design Tokens

Import the generated \`design-tokens.css\` file:
\`\`\`html
<link rel="stylesheet" href="design-tokens.css">
\`\`\`

Or in CSS:
\`\`\`css
@import './design-tokens.css';
\`\`\`

---

## 4. Signature Element

**"${plan.signatureElement?.name ?? "–"}"**

${plan.signatureElement?.description ?? ""}

Implementation:
\`\`\`
${plan.signatureElement?.implementation ?? "See generated code for implementation details."}
\`\`\`

Justification:
${plan.signatureElement?.justification ?? ""}

---

## 5. Layout Concept

\`\`\`
${plan.layoutConcept?.replace(/\\n/g, "\n") ?? "See generated code for layout implementation."}
\`\`\`

---

## 6. Editing Content

This design uses hardcoded content. To update:

- **Hero headline**: Search for the main h1 element
- **Navigation**: Update the \`<nav>\` links
- **Color changes**: Edit \`design-tokens.css\` — all components use CSS custom properties
- **Font changes**: Update the Typography Contract, local WOFF2 files, and \`FONT-LICENSES.md\` together

---

*Generated by Verve Design Pipeline*
`;
}

// ── Download helpers (browser-side) ──────────────────────────────────────────
export function downloadText(content: string, filename: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSS(plan: DesignPlan, slug = "design"): void {
  downloadText(exportCSSVars(plan, slug), `${slug}-tokens.css`, "text/css");
}

export function downloadFigmaTokens(plan: DesignPlan, slug = "design"): void {
  downloadText(exportFigmaTokens(plan), `${slug}-figma-tokens.json`, "application/json");
}

export function downloadREADME(plan: DesignPlan, brief: string, slug = "design"): void {
  downloadText(exportREADME(plan, brief), `${slug}-README.md`, "text/markdown");
}
