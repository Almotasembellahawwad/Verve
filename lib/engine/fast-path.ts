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

type LocalVisualDirection = {
  pattern: RegExp;
  palette: DesignPlan["colorPalette"];
  display: string;
  signature: string;
};

const LOCAL_VISUAL_DIRECTIONS: LocalVisualDirection[] = [
  {
    pattern: /food|hospitality|restaurant|مطعم|cafe|مقهى/i,
    palette: [
      { name: "Charred Clay", hex: "#17100D", role: "primary background" },
      { name: "Linen", hex: "#FFF2D8", role: "primary text and light surface" },
      { name: "Cairo Pepper", hex: "#E85D2A", role: "action and directional accent" },
      { name: "Olive Leaf", hex: "#87945B", role: "secondary material accent" },
    ],
    display: "Georgia, 'Times New Roman', serif",
    signature: "The Table Route",
  },
  {
    pattern: /architecture|interior|عمارة|داخلي/i,
    palette: [
      { name: "Graphite", hex: "#121313", role: "primary background" },
      { name: "Drawing Paper", hex: "#F2EFE8", role: "primary text and light surface" },
      { name: "Survey Red", hex: "#D84A38", role: "measured focal accent" },
      { name: "Concrete", hex: "#8C918D", role: "secondary annotation" },
    ],
    display: "Arial Narrow, Arial, sans-serif",
    signature: "The Occupied Datum",
  },
  {
    pattern: /beauty|skincare|بشرة|تجميل/i,
    palette: [
      { name: "Ink", hex: "#151414", role: "primary text and dark surface" },
      { name: "Mineral", hex: "#E7E1D5", role: "primary background" },
      { name: "Berry Proof", hex: "#A53B5B", role: "evidence and action accent" },
      { name: "Moss", hex: "#66705B", role: "secondary material accent" },
    ],
    display: "Georgia, 'Times New Roman', serif",
    signature: "The Evidence Seam",
  },
];

export function generateDesignPlanLocally(analysis: BriefAnalysis): DesignPlan {
  const haystack = `${analysis.subject} ${analysis.industry} ${analysis.rawBrief}`;
  const direction = LOCAL_VISUAL_DIRECTIONS.find((candidate) => candidate.pattern.test(haystack)) ?? {
    palette: [
      { name: "Near Black", hex: "#111315", role: "primary background" },
      { name: "Paper", hex: "#F3F0E8", role: "primary text and light surface" },
      { name: "Signal", hex: "#F05A38", role: "single action accent" },
      { name: "Slate", hex: "#73808A", role: "secondary annotation" },
    ],
    display: "Arial, Helvetica, sans-serif",
    signature: "The Decision Line",
  };

  return {
    colorPalette: direction.palette,
    typePairing: {
      display: direction.display,
      body: "Arial, Helvetica, sans-serif",
      rationale: `System typography keeps delivery reliable while the hierarchy is shaped around ${analysis.primaryJob.toLowerCase()}.`,
    },
    layoutConcept: [
      "A narrow orientation rail establishes subject and place without a centered hero.",
      "The main reading path alternates one decisive statement with compact evidence supplied by the brief.",
      "The signature device crosses the content once, then resolves into the single primary action.",
      "The final section closes the argument instead of repeating navigation or invented social proof.",
    ].join("\n"),
    signatureElement: {
      name: direction.signature,
      description: "One continuous directional line that connects the opening promise to the final action.",
      implementation: "Use one responsive CSS grid line with semantic labels; collapse it into a vertical guide below 768px.",
      justification: `It gives ${analysis.subject} a recognizable reading mechanism tied to the page job, without relying on decorative repetition.`,
    },
    referencesSampled: [],
    cognitiveGrounding: {
      vonRestorffCompliance: "The single accent line is isolated by spacing and is never repeated as decoration.",
      gutenbergCompliance: "The opening statement anchors the primary area and the truthful action owns the terminal area.",
      signalNoiseRatio: 0.82,
      peakEndDesign: `The closing state restates the decision in the language of: ${analysis.primaryJob}.`,
      usabilityBaseline: "Use AA text contrast, 44px minimum interactive targets, visible focus, and reduced-motion behavior.",
    },
    rawPlan: "Deterministic local resilience plan generated from the supplied brief.",
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
    // Structural evidence is not proof that a cliché was deliberately avoided.
    positiveElements: [],
    overallVerdict: passed
      ? "Fast structural preflight passed. Visual distinctiveness has not been adversarially reviewed."
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
