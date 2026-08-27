import type { BriefAnalysis } from "./brief-analyzer";

export type MediaRequirementLevel = "required" | "recommended" | "optional" | "avoid";

export type MediaRequirement = {
  level: MediaRequirementLevel;
  minimumAssets: number;
  reason: string;
  suggestedSubjects: string[];
};

type MediaRule = {
  pattern: RegExp;
  result: MediaRequirement;
};

const RULES: MediaRule[] = [
  {
    pattern: /architecture|architect|interior|adaptive reuse|real estate|property|restaurant|cafe|café|dining|food|hospitality|hotel|resort|skincare|skin care|beauty|cosmetic|fashion|travel|tourism|portfolio|motion designer|عمارة|معمار|داخلي|عقار|مطعم|مطاعم|مقهى|طعام|فندق|ضيافة|بشرة|تجميل|أزياء|سياحة/i,
    result: {
      level: "required",
      minimumAssets: 3,
      reason: "The offer is judged through visible places, products, craft, or prior work; typography alone cannot provide credible evidence.",
      suggestedSubjects: ["hero context", "proof of craft", "specific product or project detail"],
    },
  },
  {
    pattern: /developer tool|developer docs|documentation|api platform|infrastructure|terminal|code editor|analytics dashboard|data platform|database|أداة مطور|توثيق برمجي|واجهة برمجة|لوحة تحليلات/i,
    result: {
      level: "avoid",
      minimumAssets: 0,
      reason: "Product UI, data, and working interaction are stronger evidence than generic stock photography for this brief.",
      suggestedSubjects: ["real interface state", "data artifact", "working interaction"],
    },
  },
  {
    pattern: /legal|law firm|healthcare|clinic|education|university|nonprofit|consultant|personal brand|محام|قانون|عيادة|صحة|تعليم|جامعة|استشاري/i,
    result: {
      level: "recommended",
      minimumAssets: 1,
      reason: "One authentic person, place, or process image can add trust, but the experience can remain coherent without a photo-led layout.",
      suggestedSubjects: ["authentic team or environment", "service process"],
    },
  },
];

const DEFAULT_REQUIREMENT: MediaRequirement = {
  level: "optional",
  minimumAssets: 0,
  reason: "The brief does not depend on photography for its primary evidence; a strong typographic or interface-led direction is acceptable.",
  suggestedSubjects: ["primary evidence", "product detail"],
};

/** Deterministic pre-generation policy: no model call and no invented business facts. */
export function assessMediaRequirement(analysis: BriefAnalysis): MediaRequirement {
  const evidence = [
    analysis.industry,
    analysis.subject,
    analysis.primaryJob,
    analysis.tone,
    analysis.rawBrief,
  ].join(" ");

  return RULES.find((rule) => rule.pattern.test(evidence))?.result ?? DEFAULT_REQUIREMENT;
}

export function buildMediaReadinessWarnings(
  requirement: MediaRequirement,
  photoCount: number
): string[] {
  if (requirement.level === "required" && photoCount < requirement.minimumAssets) {
    return [
      `BLOCKING: Media Gate requires at least ${requirement.minimumAssets} approved images for this brief; only ${photoCount} available. Add a Pexels key or replace the labeled placeholders with owned photography before launch.`,
    ];
  }

  if (requirement.level === "recommended" && photoCount < requirement.minimumAssets) {
    return [
      `Media Gate recommends at least ${requirement.minimumAssets} authentic image for this brief; none is currently approved.`,
    ];
  }

  return [];
}
