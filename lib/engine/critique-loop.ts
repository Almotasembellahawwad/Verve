import { getLLMAdapter } from "../llm-adapter";
import type { DesignPlan } from "./plan-generator";
import type { BriefAnalysis } from "./brief-analyzer";

export type CritiqueResult = {
  passed: boolean;
  genericElementCount: number;
  flaggedElements: { element: string; reason: string; severity: "high" | "medium" | "low" }[];
  positiveElements: string[];
  overallVerdict: string;
  rawCritique: string;
};

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

const CRITIQUE_THRESHOLD = 3; // more than 3 high/medium flags → regenerate

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

  const raw = await llm.complete([{ role: "user", content: planSummary }], {
    systemPrompt: CRITIQUE_SYSTEM_PROMPT,
    temperature: 0.5,
    maxTokens: 2000,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Critique returned invalid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<CritiqueResult, "passed" | "rawCritique">;

  const highAndMedium = parsed.flaggedElements.filter(
    (e) => e.severity === "high" || e.severity === "medium"
  ).length;

  return {
    ...parsed,
    passed: highAndMedium <= CRITIQUE_THRESHOLD,
    rawCritique: raw,
  };
}

export function formatCritiqueForRegeneration(critique: CritiqueResult): string {
  return critique.flaggedElements
    .map((e) => `[${e.severity.toUpperCase()}] ${e.element}: ${e.reason}`)
    .join("\n");
}
