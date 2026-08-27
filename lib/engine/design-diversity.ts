export type DesignDiversityResult = {
  passed: boolean;
  fingerprints: string[];
  scoreCap: number | null;
  warnings: string[];
  recommendation: string | null;
};

/**
 * Detects Verve's own emerging house-template, independently of the industry
 * cliché list. A single trait is allowed; the compound recipe is not.
 */
export function inspectDesignDiversity(code: string): DesignDiversityResult {
  const fingerprints: string[] = [];
  const tallOpening = /(?:\.hero|<section[^>]+className?=["'][^"']*hero)[\s\S]{0,900}min-height\s*:\s*(?:calc\(100v|[789]\d?vh|100vh)/i.test(code);
  const oversizedHeading = /(?:\.hero\s+)?h1[\s\S]{0,450}font-size\s*:\s*clamp\([^)]*(?:1[01](?:\.\d+)?vw|[89]\d?(?:\.\d+)?vw)/i.test(code)
    || /font-size\s*:\s*clamp\((?:4|5|6)[^)]*,\s*(?:1[01]|[89])(?:\.\d+)?vw/i.test(code);
  const serifAccent = /(?:h1|headline)[\s\S]{0,500}(?:\bem\b|italic)[\s\S]{0,300}(?:Georgia|Times New Roman|serif)/i.test(code)
    || /(?:Georgia|Times New Roman|serif)[\s\S]{0,300}(?:font-style\s*:\s*italic|<em)/i.test(code);
  const repeatedViewportStages = (code.match(/min-height\s*:\s*(?:8\d|9\d|100)vh/gi)?.length ?? 0) >= 3;

  if (tallOpening && oversizedHeading && serifAccent) {
    fingerprints.push("oversized viewport hero + contrasting serif/italic phrase");
  }
  if (oversizedHeading && repeatedViewportStages) {
    fingerprints.push("repeated full-viewport editorial stages");
  }

  const passed = fingerprints.length === 0;
  return {
    passed,
    fingerprints,
    scoreCap: passed ? null : 84,
    warnings: passed ? [] : [`Template Diversity Gate: ${fingerprints.join("; ")}. The composition resembles Verve's recurring house style and needs a different information topology.`],
    recommendation: passed ? null : "Change the page topology—not only its palette. Prefer a domain-native structure such as a ledger, catalog, plan canvas, menu, timeline, or working interface.",
  };
}
