import { inferDesignStructure } from "./structural-fingerprint";

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
  const structure = inferDesignStructure(code);
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

  const editorialRegisterTraits = new Set([
    "dark-closing-panel",
    "editorial-rules",
    "full-width-interrupt",
    "numbered-index",
    "oversized-heading",
    "twelve-column-grid",
    "vertical-rail",
  ].filter((trait) => structure.traits.includes(trait)));
  if (
    structure.topologyFamily === "editorial-register"
    && editorialRegisterTraits.has("vertical-rail")
    && editorialRegisterTraits.has("numbered-index")
    && editorialRegisterTraits.size >= 4
  ) {
    fingerprints.push("split editorial register with vertical rail and numbered evidence rows");
  }

  const passed = fingerprints.length === 0;
  return {
    passed,
    fingerprints,
    scoreCap: passed ? null : fingerprints.some((item) => item.includes("editorial register")) ? 78 : 84,
    warnings: passed ? [] : [`Template Diversity Gate: ${fingerprints.join("; ")}. The composition resembles Verve's recurring house style and needs a different information topology.`],
    recommendation: passed ? null : "Change at least three structural axes: opening mode, content rhythm, interaction metaphor, evidence presentation, or ending. Do not rename the same rail-and-register composition.",
  };
}
