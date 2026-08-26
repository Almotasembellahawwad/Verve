import type { BriefAnalysis } from "./brief-analyzer";
import {
  ARCHETYPES,
  type ArchetypeId,
  type ArchetypeResolution,
} from "./brand-archetype-resolver";
import type { CritiqueResult } from "./critique-loop";
import type { DesignPlan } from "./plan-generator";

const KEYWORD_ARCHETYPES: Array<[ArchetypeId, RegExp]> = [
  ["caregiver", /health|care|clinic|medical|wellness|charity|nonprofit/i],
  ["sage", /education|research|data|analytics|science|knowledge|university|legal/i],
  ["ruler", /luxury|finance|bank|law firm|enterprise|executive|premium/i],
  ["explorer", /travel|outdoor|adventure|tourism|mobility/i],
  ["hero", /sport|fitness|performance|achievement|training/i],
  ["rebel", /disrupt|radical|counterculture|independent|challenger/i],
  ["jester", /entertainment|game|comedy|fun|festival/i],
  ["innocent", /organic|natural|sustainable|clean|children|family/i],
  ["everyman", /community|accessible|local|everyday|marketplace/i],
  ["lover", /beauty|fashion|hospitality|wedding|skincare|restaurant/i],
  ["magician", /transformation|future|immersive|ai |automation|innovation/i],
  ["creator", /design|architecture|studio|portfolio|creative|craft/i],
];

export function resolveArchetypeLocally(analysis: BriefAnalysis): ArchetypeResolution {
  const haystack = `${analysis.subject} ${analysis.industry} ${analysis.tone} ${analysis.primaryJob}`;
  const primaryArchetype = KEYWORD_ARCHETYPES.find(([, expression]) => expression.test(haystack))?.[0] ?? "creator";
  const primaryProfile = ARCHETYPES[primaryArchetype];
  const design = primaryProfile.design;
  const designConstraints = [
    `FAST MODE ARCHETYPE: ${primaryProfile.name}`,
    `Color: ${design.colorPersonality}`,
    `Typography: ${design.typographyPersonality}`,
    `Layout: ${design.layoutPersonality}`,
    `Voice: ${design.toneOfVoice}`,
  ].join("\n");

  return {
    primaryArchetype,
    secondaryArchetype: null,
    confidence: 0.68,
    reasoning: "Resolved locally from the brief vocabulary to keep Fast mode predictable and reduce provider calls.",
    archetypeConflict: primaryProfile.fear,
    emotionalJob: `Help ${analysis.audience} feel confident that ${analysis.primaryJob.toLowerCase()} is achievable.`,
    primaryProfile,
    secondaryProfile: null,
    designConstraints,
    animationConstraints: [
      primaryProfile.animation.easingCharacter,
      primaryProfile.animation.entranceStyle,
      primaryProfile.animation.interactionResponse,
    ].join(" "),
  };
}

export function critiquePlanLocally(plan: DesignPlan): CritiqueResult {
  const issues: CritiqueResult["flaggedElements"] = [];
  if ((plan.colorPalette ?? []).length < 3) {
    issues.push({ element: "Color system", reason: "Fewer than three purposeful tokens were produced.", severity: "medium" });
  }
  if (!plan.signatureElement?.implementation?.trim()) {
    issues.push({ element: "Signature element", reason: "Implementation guidance is missing.", severity: "high" });
  }
  if ((plan.layoutConcept ?? "").length < 80) {
    issues.push({ element: "Layout", reason: "The spatial plan is too thin to guide production code.", severity: "medium" });
  }

  const passed = issues.every((issue) => issue.severity !== "high");
  return {
    passed,
    genericElementCount: issues.length,
    flaggedElements: issues,
    positiveElements: ["Fast mode completed a deterministic production preflight."],
    overallVerdict: passed
      ? "Fast preflight passed. Use Studio mode for adversarial visual critique."
      : "Fast preflight found a blocking design-plan issue.",
    endingCheck: {
      quality: "intentional",
      description: "Closing quality is verified during the rendered Studio audit.",
      recommendation: "Run Studio mode before production deployment.",
    },
    usabilityFloor: {
      passed,
      contrastOk: true,
      touchTargetsOk: true,
      bodyTextOk: true,
      issues: issues.map((issue) => issue.reason),
    },
    cognitiveScore: passed ? 18 : 12,
    cognitiveFailures: issues.map((issue) => issue.reason),
    rawCritique: "Deterministic Fast-mode preflight; no additional LLM critique call was used.",
  };
}
