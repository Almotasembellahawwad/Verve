// lib/engine/engineering-score.ts
// Engineering Score -- the second axis of Dual Scoring
//
// Inspired by basement.studio: "beautiful things that actually work."
// Craft Score measures aesthetic boldness. Engineering Score measures
// technical quality. Both must pass. One doesn't substitute for the other.
//
// Evaluates generated code against 6 dimensions:
// 1. Semantic HTML      -- correct element hierarchy, no div soup
// 2. Accessibility      -- ARIA labels, contrast, keyboard nav, alt text
// 3. Performance budget -- no inline base64, no 100kb+ font imports, no layout thrash patterns
// 4. Clean code         -- naming clarity, separation of concerns, no magic numbers
// 5. Responsive design  -- mobile-first patterns, no fixed pixel widths
// 6. CSS quality        -- custom properties usage, no !important abuse, no hardcoded colors

type Framework = string;

export type EngineeringDimension = {
  id: string;
  name: string;
  score: number;       // 0-100
  weight: number;      // 0-1, must sum to 1 across dimensions
  flags: string[];     // specific issues found
  passed: boolean;     // score >= 60
};

export type EngineeringResult = {
  compositeScore: number;  // weighted average 0-100
  grade: string;           // S/A/B/C/D
  dimensions: EngineeringDimension[];
  passed: boolean;         // all dimensions passed (score >= 55)
  criticalFailures: string[];
  recommendations: string[];
};

// ── Heuristic patterns ────────────────────────────────────────────────────────

const SEMANTIC_HTML_CHECKS = {
  good: [
    { pattern: /<header/i,          label: "uses <header>" },
    { pattern: /<main/i,            label: "uses <main>" },
    { pattern: /<footer/i,          label: "uses <footer>" },
    { pattern: /<nav/i,             label: "uses <nav>" },
    { pattern: /<article|<section/i, label: "uses semantic sectioning" },
    { pattern: /<h[1-3]/i,          label: "uses heading hierarchy" },
    { pattern: /<figure|<figcaption/i, label: "uses figure/figcaption" },
  ],
  bad: [
    { pattern: /(<div[^>]*>\s*){5,}/i, penalty: 20, label: "excessive div nesting (div soup)" },
    { pattern: /<span[^>]*>(click|button)/i, penalty: 15, label: "span used as button" },
    { pattern: /<div[^>]*(onClick|onclick)/i, penalty: 10, label: "div used as interactive element without role" },
  ],
};

const ACCESSIBILITY_CHECKS = {
  good: [
    { pattern: /aria-label/i,        label: "uses aria-label" },
    { pattern: /aria-describedby/i,  label: "uses aria-describedby" },
    { pattern: /role=/i,             label: "uses ARIA roles" },
    { pattern: /alt=/i,              label: "uses alt text" },
    { pattern: /tabIndex|tabindex/i, label: "manages focus/tabIndex" },
    { pattern: /htmlFor|for=/i,      label: "label associations" },
    { pattern: /sr-only|visually-hidden/i, label: "screen reader helpers" },
  ],
  bad: [
    { pattern: /<img(?![^>]*alt=)/i, penalty: 25, label: "img without alt attribute" },
    { pattern: /<button(?![^>]*aria)/i, penalty: 10, label: "button without ARIA context" },
    { pattern: /outline:\s*none|outline:\s*0/i, penalty: 20, label: "focus outline removed (keyboard trap)" },
    { pattern: /font-size:\s*[0-9]px;/i, penalty: 15, label: "font-size below 10px (unreadable)" },
  ],
};

const PERFORMANCE_CHECKS = {
  bad: [
    { pattern: /data:image\/[a-z]+;base64,[A-Za-z0-9+/]{200,}/i, penalty: 30, label: "large base64 inline image" },
    { pattern: /animation.*0\.1s|transition.*0\.05s/i, penalty: 8,  label: "animation duration < 100ms (imperceptible)" },
    { pattern: /@import url\([^)]{80,}\)/i, penalty: 10, label: "multiple large font imports" },
    { pattern: /box-shadow:[^;]{0,200}box-shadow:/i, penalty: 12, label: "multiple box-shadows (paint cost)" },
    { pattern: /filter:\s*blur/i, penalty: 15, label: "CSS blur filter (GPU paint cost on mobile)" },
  ],
  good: [
    { pattern: /will-change:\s*transform/i, label: "uses will-change for animations" },
    { pattern: /contain:\s*(layout|paint|strict)/i, label: "uses CSS containment" },
    { pattern: /loading="lazy"|loading='lazy'/i, label: "lazy loads images" },
  ],
};

const CLEAN_CODE_CHECKS = {
  good: [
    { pattern: /\/\*.*\*\/|\/\/.+/,     label: "has comments" },
    { pattern: /const [A-Z_]{3,}/,       label: "uses named constants" },
    { pattern: /type |interface /,        label: "uses TypeScript types" },
  ],
  bad: [
    { pattern: /[0-9]{3,}px/g,           penalty: 8,  label: "magic pixel numbers" },
    { pattern: /style={{[^}]{200,}}}/,    penalty: 15, label: "large inline style objects (CSS-in-JS smell)" },
    { pattern: /TODO|FIXME|HACK/i,        penalty: 5,  label: "unresolved TODO/FIXME" },
    { pattern: /console\.(log|warn|error)\(/i, penalty: 5, label: "console statements in production code" },
  ],
};

const RESPONSIVE_CHECKS = {
  good: [
    { pattern: /@media.*max-width|@media.*min-width/i, label: "has media queries" },
    { pattern: /clamp\(|min\(|max\(/i, label: "uses fluid CSS functions" },
    { pattern: /grid-template-columns.*auto|auto-fill|auto-fit/i, label: "auto-responsive grid" },
    { pattern: /vw|vh|dvh|svh/i, label: "uses viewport units" },
  ],
  bad: [
    { pattern: /width:\s*[7-9][0-9]{2}px|width:\s*1[0-9]{3}px/i, penalty: 25, label: "fixed large pixel width (breaks mobile)" },
    { pattern: /overflow:\s*hidden.*overflow:\s*hidden/i, penalty: 10, label: "multiple overflow: hidden (may clip on mobile)" },
  ],
};

const CSS_QUALITY_CHECKS = {
  good: [
    { pattern: /--[a-z]+-[a-z]+:/i, label: "uses CSS custom properties" },
    { pattern: /var\(--/i, label: "consumes CSS custom properties" },
    { pattern: /hsl\(|oklch\(|lch\(/i, label: "uses perceptual color space" },
  ],
  bad: [
    { pattern: /!important/g, penalty: 12, label: "!important overrides" },
    { pattern: /#[0-9a-fA-F]{3,6}.*#[0-9a-fA-F]{3,6}.*#[0-9a-fA-F]{3,6}.*#[0-9a-fA-F]{3,6}.*#[0-9a-fA-F]{3,6}/i, penalty: 10, label: "5+ hardcoded hex colors (should use custom properties)" },
    { pattern: /z-index:\s*9{3,}/i, penalty: 8, label: "z-index: 999+ (z-index inflation)" },
  ],
};

// ── Main function ─────────────────────────────────────────────────────────────

 
export function scoreEngineering(
  code: string,
  _framework: Framework = "nextjs"
): EngineeringResult {
  const dims: EngineeringDimension[] = [
    scoreDimension("semantic",    "Semantic HTML",    0.15, code, SEMANTIC_HTML_CHECKS),
    scoreDimension("a11y",        "Accessibility",    0.25, code, ACCESSIBILITY_CHECKS),
    scoreDimension("performance", "Performance",      0.20, code, PERFORMANCE_CHECKS),
    scoreDimension("clean",       "Clean Code",       0.15, code, CLEAN_CODE_CHECKS),
    scoreDimension("responsive",  "Responsive Design",0.15, code, RESPONSIVE_CHECKS),
    scoreDimension("css",         "CSS Quality",      0.10, code, CSS_QUALITY_CHECKS),
  ];

  const compositeScore = Math.round(
    dims.reduce((acc, d) => acc + d.score * d.weight, 0)
  );

  const criticalFailures = dims
    .filter((d) => d.score < 40)
    .flatMap((d) => d.flags.slice(0, 2).map((f) => `[${d.name}] ${f}`));

  const recommendations = dims
    .filter((d) => !d.passed)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((d) => {
      const topFlag = d.flags[0];
      return topFlag
        ? `Fix [${d.name}]: ${topFlag}`
        : `Improve [${d.name}] (score: ${d.score})`;
    });

  const passed = dims.every((d) => d.passed);

  return {
    compositeScore,
    grade: engineeringGrade(compositeScore),
    dimensions: dims,
    passed,
    criticalFailures,
    recommendations,
  };
}

function scoreDimension(
  id: string,
  name: string,
  weight: number,
  code: string,
  checks: { good?: { pattern: RegExp; label: string }[]; bad?: { pattern: RegExp; penalty: number; label: string }[] }
): EngineeringDimension {
  let score = 65; // baseline
  const flags: string[] = [];

  // Good patterns add to score
  const goodHits = (checks.good ?? []).filter((c) => c.pattern.test(code));
  score += goodHits.length * 5;

  // Bad patterns subtract
  for (const check of (checks.bad ?? [])) {
    if (check.pattern.test(code)) {
      score -= check.penalty;
      flags.push(check.label);
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    id,
    name,
    score,
    weight,
    flags,
    passed: score >= 55,
  };
}

export function engineeringGrade(score: number): string {
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  return "D";
}
