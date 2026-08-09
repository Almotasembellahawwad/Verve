import { getLLMAdapter } from "../llm-adapter";
import type { BriefAnalysis } from "./brief-analyzer";
import { buildCognitiveGroundingPrompt } from "./cognitive-principles";
import refraw from "../../data/reference-library.json";

type RefEntry = {
  id: string;
  name: string;
  industry: string;
  mood: string[];
  what_makes_it_work: string;
  specific_techniques: string[];
  color_palette: string[];
  tags: string[];
};

type RefData = {
  entries: RefEntry[];
};

const refData = refraw as RefData;

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

function getRelevantReferences(analysis: BriefAnalysis): RefEntry[] {
  const scored = refData.entries.map((ref) => {
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
  analysis: BriefAnalysis,
  blocklistInjection: string,
  previousCritique?: string
): Promise<DesignPlan> {
  const llm = getLLMAdapter();
  const refs = getRelevantReferences(analysis);

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

  const systemPrompt = `You are a senior art director generating a design token plan for a specific project.

${blocklistInjection}

${cognitivePrompt}

=== REAL DESIGN REFERENCES (use these as grounding, not imitation) ===
${refContext}

=== YOUR TASK ===
Generate a COMPACT, OPINIONATED design plan for this specific brief. Not a generic plan — a plan that could ONLY be for this brief.

Rules:
1. Choose colors that are DERIVED from the subject matter, not from a brand guide default. If the subject involves data, color should reference data. If it involves physical materials, reference those materials.
2. The type pairing must be CHOSEN, not defaulted. Explicitly state WHY this pairing works for THIS brief.
3. EXACTLY ONE signature element — a bold, specific, justifiable design risk. Not "use a unique gradient." Something that, if removed, would make the design generic.
4. The layout concept must differ from the 4-card-grid, alternating-sections, centered-hero defaults.
${critiqueNote}

Respond ONLY in valid JSON with this exact schema:
{
  "colorPalette": [
    { "name": "string", "hex": "#XXXXXX", "role": "string — where/how it's used" }
  ],
  "typePairing": {
    "display": "string — Google Font or system font name",
    "body": "string — Google Font or system font name",
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
}`;

  const userMessage = `Brief Analysis:
Subject: ${analysis.subject}
Audience: ${analysis.audience}
Primary Job: ${analysis.primaryJob}
Tone: ${analysis.tone}
Industry: ${analysis.industry}
Constraints: ${analysis.constraints.join(", ") || "none stated"}

Generate the design plan now.`;

  const raw = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt,
    temperature: 0.85,
    maxTokens: 3000,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Plan generator returned invalid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<DesignPlan, "rawPlan">;
  return { ...parsed, rawPlan: raw };
}
