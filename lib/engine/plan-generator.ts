import type { LLMAdapter } from "./llm-utils";
import { extractJSON } from "./llm-utils";
import type { BriefAnalysis } from "./brief-analyzer";
import { buildCognitiveGroundingPrompt } from "./cognitive-principles";
import { z } from "zod";
import type { LLMOptions } from "../llm-adapter/types";
import type { ReferenceEntry, ReferenceLibraryRepositoryPort } from "../ports/repositories";

export type DesignPlan = {
  colorPalette: { name: string; hex: string; role: string }[];
  typePairing: { display: string; body: string; rationale: string };
  layoutConcept: string; // ASCII wireframe
  signatureElement: {
    name: string;
    description: string;
    implementation: string;
    justification: string;
  };
  referencesSampled: string[];
  // ── Module G: Cognitive Grounding Layer ────────────────
  cognitiveGrounding: {
    vonRestorffCompliance: string;  // how signature element achieves visual isolation
    gutenbergCompliance: string;    // POA/TA anchoring + fallow zone usage
    signalNoiseRatio: number;       // 0.0–1.0 semantic/decorative ratio
    peakEndDesign: string;          // closing section treatment
    usabilityBaseline: string;      // contrast estimates + touch target confirmation
  };
  rawPlan: string;
};

export type PlanGenerationOptions = {
  timeoutMs?: number;
  reasoningEffort?: LLMOptions["reasoningEffort"];
  allowSchemaRetry?: boolean;
  referenceRepository?: ReferenceLibraryRepositoryPort;
};

const DesignPlanOutputSchema = z.object({
  colorPalette: z.array(z.object({
    name: z.string().min(1),
    hex: z.string().regex(/^#[0-9a-f]{6}$/i),
    role: z.string().min(1),
  })).min(3).max(8),
  typePairing: z.object({
    display: z.string().min(1),
    body: z.string().min(1),
    rationale: z.string().min(10),
  }),
  layoutConcept: z.string().min(20),
  signatureElement: z.object({
    name: z.string().min(2),
    description: z.string().min(10),
    implementation: z.string().min(10),
    justification: z.string().min(10),
  }),
  referencesSampled: z.array(z.string()).default([]),
  cognitiveGrounding: z.object({
    vonRestorffCompliance: z.string().min(1),
    gutenbergCompliance: z.string().min(1),
    signalNoiseRatio: z.number().min(0).max(1),
    peakEndDesign: z.string().min(1),
    usabilityBaseline: z.string().min(1),
  }),
});

const DESIGN_PLAN_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    colorPalette: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          hex: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          role: { type: "string" },
        },
        required: ["name", "hex", "role"],
      },
    },
    typePairing: {
      type: "object",
      additionalProperties: false,
      properties: {
        display: { type: "string" },
        body: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["display", "body", "rationale"],
    },
    layoutConcept: { type: "string" },
    signatureElement: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        implementation: { type: "string" },
        justification: { type: "string" },
      },
      required: ["name", "description", "implementation", "justification"],
    },
    referencesSampled: { type: "array", items: { type: "string" } },
    cognitiveGrounding: {
      type: "object",
      additionalProperties: false,
      properties: {
        vonRestorffCompliance: { type: "string" },
        gutenbergCompliance: { type: "string" },
        signalNoiseRatio: { type: "number", minimum: 0, maximum: 1 },
        peakEndDesign: { type: "string" },
        usabilityBaseline: { type: "string" },
      },
      required: ["vonRestorffCompliance", "gutenbergCompliance", "signalNoiseRatio", "peakEndDesign", "usabilityBaseline"],
    },
  },
  required: ["colorPalette", "typePairing", "layoutConcept", "signatureElement", "referencesSampled", "cognitiveGrounding"],
};

function getRelevantReferences(
  analysis: BriefAnalysis,
  repository?: ReferenceLibraryRepositoryPort
): ReferenceEntry[] {
  const scored = (repository?.list() ?? []).map((ref) => {
    let score = 0;
    if (ref.industry === analysis.industry) score += 3;
    const toneTags = analysis.tone.toLowerCase().split(/[\s,]+/);
    toneTags.forEach((t) => {
      if (ref.mood.some((m) => m.includes(t) || t.includes(m))) score += 1;
      if (ref.tags.some((tag) => tag.includes(t) || t.includes(tag))) score += 1;
    });
    return { ref, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.ref);
}

export async function generateDesignPlan(
  llm: LLMAdapter,
  analysis: BriefAnalysis,
  blocklistInjection: string,
  previousCritique?: string,
  archetypeContext?: string,   // Module I injection
  animationContext?: string,   // Module K injection
  options: PlanGenerationOptions = {}
): Promise<DesignPlan> {
  const refs = getRelevantReferences(analysis, options.referenceRepository);

  const refContext = refs
    .map(
      (r) =>
        `• ${r.name} (${r.industry}): ${r.what_makes_it_work}\n  Techniques: ${r.specific_techniques.join(", ")}`
    )
    .join("\n");

  const critiqueNote = previousCritique
    ? `\n\n=== PREVIOUS CRITIQUE (APPLY AS NEGATIVE FEEDBACK) ===\nThe following elements were flagged as generic defaults. EVERY ONE must be changed:\n${previousCritique}\n=== END CRITIQUE ===\n`
    : "";

  const cognitivePrompt = buildCognitiveGroundingPrompt();

  const archetypeSection = archetypeContext
    ? `\n${archetypeContext}\n`
    : "";

  const animationSection = animationContext
    ? `\n${animationContext}\n`
    : "";

  const systemPrompt = `You are a senior art director generating a design token plan for a specific project.

${blocklistInjection}

${cognitivePrompt}
${archetypeSection}${animationSection}
=== YOUR TASK ===
Generate a COMPACT, OPINIONATED design plan for this specific brief. Not a generic plan — a plan that could ONLY be for this brief.

Rules:
1. Choose colors that are DERIVED from the subject matter, not from a brand guide default. If the subject involves data, color should reference data. If it involves physical materials, reference those materials.
2. The type pairing must be CHOSEN, not defaulted. Explicitly state WHY this pairing works for THIS brief.
3. EXACTLY ONE signature element — a bold, specific, justifiable design risk. Not "use a unique gradient." Something that, if removed, would make the design generic.
4. The layout concept must differ from the 4-card-grid, alternating-sections, centered-hero defaults.
5. ALL archetype constraints above are HARD requirements — color, type, layout decisions must be coherent with the identified archetype.
6. COLOR RULE: Provide high-contrast text and surfaces with an estimated WCAG AA ratio. Derive every color from this brief and obey the blocklist above; do not copy fixed fallback hex values or use gray on gray.
7. SOURCE-OF-TRUTH RULE: Never invent measurements, percentages, study durations, participant counts, clinical outcomes, awards, testimonials, product names, ingredients, addresses, or business facts. If the source brief does not provide a value, the plan must say "verified value pending" rather than proposing an example number. This applies to the signature element and every line of the wireframe.
8. TOPOLOGY RULE: Choose a domain-native information topology before styling: for example a working ledger, menu path, evidence catalog, spatial plan, timeline, comparison field, or tool surface. Do not default to a 90vh oversized hero followed by stacked manifesto sections.
9. HOUSE-STYLE BAN: The compound recipe "huge sans headline + one italic serif phrase + full-viewport sections + one bright accent" is now a Verve cliché. Any one trait may be justified; never use the recipe as a whole.
${critiqueNote}

Respond ONLY in valid JSON with this exact schema:
{
  "colorPalette": [
    { "name": "string", "hex": "#XXXXXX", "role": "string — where/how it's used" }
  ],
  "typePairing": {
    "display": "string — a REAL font name explicitly listed in AVAILABLE ASSETS, or a deliberate system font stack. Never invent a font name or URL.",
    "body": "string — a REAL font name explicitly listed in AVAILABLE ASSETS, or a readable system font stack.",
    "rationale": "string — specific justification for this pairing for this brief"
  },
  "layoutConcept": "string — ASCII wireframe or detailed layout description (use \\n for newlines)",
  "signatureElement": {
    "name": "string — a named design device",
    "description": "string — what it is",
    "implementation": "string — specific CSS/interaction implementation notes",
    "justification": "string — why this and not something else for THIS brief"
  },
  "referencesSampled": ["array of reference names that informed this plan"],
  "cognitiveGrounding": {
    "vonRestorffCompliance": "string — how the signature element achieves visual isolation (contrast delta, scale, spacing)",
    "gutenbergCompliance": "string — where POA and TA sit in your layout, where grid-breaking happens",
    "signalNoiseRatio": 0.0,
    "peakEndDesign": "string — specific description of the closing section (NOT generic footer)",
    "usabilityBaseline": "string — contrast ratio estimates for primary text/bg, touch target confirmation"
  }
}

=== REAL DESIGN REFERENCES (use these as grounding, not imitation) ===
${refContext}
`;

  const userMessage = `Brief Analysis:
Subject: ${analysis.subject}
Audience: ${analysis.audience}
Primary Job: ${analysis.primaryJob}
Tone: ${analysis.tone}
Industry: ${analysis.industry}
Constraints: ${analysis.constraints.join(", ") || "none stated"}
Source brief (the only authority for factual claims): ${analysis.rawBrief}

Generate the design plan now.`;

  let raw = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt,
    temperature: 0.85,
    maxTokens: 3500,
    reasoningEffort: options.reasoningEffort ?? "medium",
    timeoutMs: options.timeoutMs,
    responseFormat: { name: "design_plan", schema: DESIGN_PLAN_JSON_SCHEMA },
  });

  let result = DesignPlanOutputSchema.safeParse(extractJSON<unknown>(raw, "Plan Generator"));
  if (!result.success && options.allowSchemaRetry !== false) {
    const feedback = result.error.issues.slice(0, 6)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    raw = await llm.complete([{
      role: "user",
      content: `${userMessage}\n\nYour previous JSON failed validation:\n${feedback}\nReturn the complete corrected JSON only.`,
    }], {
      systemPrompt,
      temperature: 0.3,
      maxTokens: 3500,
      reasoningEffort: "low",
      timeoutMs: options.timeoutMs,
      responseFormat: { name: "design_plan", schema: DESIGN_PLAN_JSON_SCHEMA },
    });
    result = DesignPlanOutputSchema.safeParse(extractJSON<unknown>(raw, "Plan Generator retry"));
  }
  if (!result.success) throw new Error(`Plan Generator returned invalid structured output: ${result.error.issues[0]?.message ?? "unknown schema error"}`);
  return { ...result.data, rawPlan: raw };
}
