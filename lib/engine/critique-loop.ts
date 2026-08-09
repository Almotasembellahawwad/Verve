import { getLLMAdapter } from "../llm-adapter";
import type { DesignPlan } from "./plan-generator";
import type { BriefAnalysis } from "./brief-analyzer";
import { evaluateCognitiveCompliance } from "./cognitive-principles";

export type EndingCheck = {
  quality: "strong" | "intentional" | "weak" | "filler";
  description: string;
  recommendation: string;
};

export type UsabilityFloorCheck = {
  passed: boolean;
  contrastOk: boolean;
  touchTargetsOk: boolean;
  bodyTextOk: boolean;
  issues: string[];
};

export type CritiqueResult = {
  passed: boolean;
  genericElementCount: number;
  flaggedElements: { element: string; reason: string; severity: "high" | "medium" | "low" }[];
  positiveElements: string[];
  overallVerdict: string;
  // ── Module G additions ──────────────────────────────────
  endingCheck: EndingCheck;
  usabilityFloor: UsabilityFloorCheck;
  cognitiveScore: number; // 0–25
  cognitiveFailures: string[];
  rawCritique: string;
};

// ── Main adversarial critique prompt ─────────────────────────────────────────
const CRITIQUE_SYSTEM_PROMPT = `You are an adversarial design critic. Your job is to identify generic, AI-default design decisions.

You will receive a design plan. Your ONLY job is to answer: "Would a generic LLM, given a similar brief with no special instruction, produce this same plan?"

For each element in the plan (colors, typography, layout, signature element), evaluate:
1. Is this a deliberate choice specific to this brief? Or is it a statistical default?
2. What percentage of AI-generated designs for a similar brief would make the same choice?

Be harsh. Be specific. Do NOT praise things just because they exist. A signature element that is vague ("use an interesting animation") is NOT a real signature element — call it out.

Respond ONLY in valid JSON:
{
  "flaggedElements": [
    {
      "element": "string — what specifically",
      "reason": "string — why it reads as a generic default",
      "severity": "high | medium | low"
    }
  ],
  "positiveElements": ["string — elements that ARE genuinely specific to this brief"],
  "overallVerdict": "string — 2-3 sentence summary verdict",
  "genericElementCount": number
}`;

// ── Peak-End Rule: Ending Check prompt ───────────────────────────────────────
const ENDING_CHECK_PROMPT = `You are evaluating a design plan against the Peak-End Rule (Kahneman & Tversky).

The Peak-End Rule states: people judge an experience based on its most intense moment and its FINAL moment.
A generic footer or closing section causes negative last-impression — even if the rest of the design is strong.

Evaluate the provided layout concept and design plan:
- Is the closing section (footer area / final content block) specifically designed and distinctive?
- Or is it a generic link grid, empty whitespace, or "contact us" filler?

Quality levels:
- "strong": Closing section has a signature design treatment matching the brand concept
- "intentional": Closing section is simple but purposefully designed (not default)
- "weak": Closing section is mentioned but not distinctive
- "filler": Generic footer / link grid / empty space — Peak-End failure

Respond ONLY in valid JSON:
{
  "quality": "strong | intentional | weak | filler",
  "description": "string — what the closing section actually contains",
  "recommendation": "string — specific improvement if quality is weak or filler"
}`;

// ── Aesthetic-Usability Effect: Usability Floor Check prompt ─────────────────
const USABILITY_FLOOR_PROMPT = `You are a strict accessibility and usability auditor. 
IMPORTANT: You MUST IGNORE how beautiful or distinctive the design is. Aesthetics are IRRELEVANT here.
You are ONLY checking: does this design meet minimum functional usability standards?

Evaluate the provided design plan for:
1. CONTRAST: Are the stated colors likely to meet WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text)?
   - Dark text on light background: likely ok
   - Light text on white: fail
   - Low-saturation color on similar color: likely fail
   - Very saturated colors: check carefully

2. TOUCH TARGETS: Does the plan describe or imply interactive elements ≥ 44×44px?
   - Buttons described as "small", "minimal", "text-only": likely fail
   - Standard buttons, clear CTAs: likely ok

3. BODY TEXT LEGIBILITY: Is body text ≥ 16px with line-height ≥ 1.5?
   - Dense, tight, small body text: fail
   - Normal body text: ok

Respond ONLY in valid JSON:
{
  "contrastOk": boolean,
  "touchTargetsOk": boolean,
  "bodyTextOk": boolean,
  "issues": ["string — specific usability issue if failed"],
  "passed": boolean
}`;

const CRITIQUE_THRESHOLD = 3; // more than 3 high/medium flags → regenerate

// ── Main function ─────────────────────────────────────────────────────────────
export async function runSelfCritique(
  plan: DesignPlan,
  analysis: BriefAnalysis
): Promise<CritiqueResult> {
  const llm = getLLMAdapter();

  const planSummary = `Brief context (do NOT use this to judge the plan differently — just for calibration):
Subject: ${analysis.subject}
Primary Job: ${analysis.primaryJob}
Tone: ${analysis.tone}

Design Plan to critique:
Colors: ${plan.colorPalette.map((c) => `${c.name} (${c.hex}): ${c.role}`).join("; ")}
Type: ${plan.typePairing.display} (display) + ${plan.typePairing.body} (body) — Rationale: ${plan.typePairing.rationale}
Layout: ${plan.layoutConcept.slice(0, 500)}
Signature Element: "${plan.signatureElement.name}" — ${plan.signatureElement.description}
  Justification: ${plan.signatureElement.justification}`;

  const planForEndingCheck = `Layout concept: ${plan.layoutConcept}
Signature element: ${plan.signatureElement.name} — ${plan.signatureElement.description}
Color palette: ${plan.colorPalette.map((c) => `${c.name}`).join(", ")}
Stated closing/peak-end design: ${plan.cognitiveGrounding?.peakEndDesign ?? "not stated"}`;

  const planForUsability = `Colors: ${plan.colorPalette.map((c) => `${c.name} (${c.hex}) as ${c.role}`).join("; ")}
Typography: display=${plan.typePairing.display}, body=${plan.typePairing.body}
Layout: ${plan.layoutConcept.slice(0, 300)}
Usability baseline stated by designer: ${plan.cognitiveGrounding?.usabilityBaseline ?? "not stated"}`;

  // Run all 3 checks in parallel
  const [critiqueRaw, endingRaw, usabilityRaw] = await Promise.all([
    llm.complete([{ role: "user", content: planSummary }], {
      systemPrompt: CRITIQUE_SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 2000,
    }),
    llm.complete([{ role: "user", content: planForEndingCheck }], {
      systemPrompt: ENDING_CHECK_PROMPT,
      temperature: 0.3,
      maxTokens: 600,
    }),
    llm.complete([{ role: "user", content: planForUsability }], {
      systemPrompt: USABILITY_FLOOR_PROMPT,
      temperature: 0.2,
      maxTokens: 600,
    }),
  ]);

  // Parse main critique
  const critiqueMatch = critiqueRaw.match(/\{[\s\S]*\}/);
  if (!critiqueMatch) throw new Error("Critique returned invalid JSON");
  const parsed = JSON.parse(critiqueMatch[0]) as Omit<
    CritiqueResult,
    "passed" | "rawCritique" | "endingCheck" | "usabilityFloor" | "cognitiveScore" | "cognitiveFailures"
  >;

  // Parse ending check
  let endingCheck: EndingCheck = {
    quality: "weak",
    description: "Not evaluated",
    recommendation: "Add a distinctive closing section",
  };
  try {
    const endingMatch = endingRaw.match(/\{[\s\S]*\}/);
    if (endingMatch) endingCheck = JSON.parse(endingMatch[0]) as EndingCheck;
  } catch {
    // silently use default
  }

  // Parse usability floor
  let usabilityFloor: UsabilityFloorCheck = {
    passed: false,
    contrastOk: false,
    touchTargetsOk: false,
    bodyTextOk: false,
    issues: ["Usability check could not be evaluated"],
  };
  try {
    const usabilityMatch = usabilityRaw.match(/\{[\s\S]*\}/);
    if (usabilityMatch) usabilityFloor = JSON.parse(usabilityMatch[0]) as UsabilityFloorCheck;
  } catch {
    // silently use default
  }

  // Evaluate cognitive grounding compliance
  const cognitiveEval = plan.cognitiveGrounding
    ? evaluateCognitiveCompliance(plan.cognitiveGrounding)
    : { passed: false, score: 0, failures: ["No cognitive grounding provided in plan"] };

  const highAndMedium = parsed.flaggedElements.filter(
    (e) => e.severity === "high" || e.severity === "medium"
  ).length;

  return {
    ...parsed,
    passed: highAndMedium <= CRITIQUE_THRESHOLD && usabilityFloor.passed,
    rawCritique: critiqueRaw,
    endingCheck,
    usabilityFloor,
    cognitiveScore: cognitiveEval.score,
    cognitiveFailures: cognitiveEval.failures,
  };
}

export function formatCritiqueForRegeneration(critique: CritiqueResult): string {
  const lines = critique.flaggedElements
    .map((e) => `[${e.severity.toUpperCase()}] ${e.element}: ${e.reason}`);

  if (!critique.usabilityFloor.passed) {
    critique.usabilityFloor.issues.forEach((issue) =>
      lines.push(`[HIGH] USABILITY FAILURE: ${issue}`)
    );
  }

  if (critique.endingCheck.quality === "filler" || critique.endingCheck.quality === "weak") {
    lines.push(`[MEDIUM] PEAK-END FAILURE: ${critique.endingCheck.recommendation}`);
  }

  if (critique.cognitiveFailures.length > 0) {
    critique.cognitiveFailures.forEach((f) =>
      lines.push(`[MEDIUM] COGNITIVE GROUNDING: ${f}`)
    );
  }

  return lines.join("\n");
}
