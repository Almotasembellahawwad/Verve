import type { LLMAdapter } from "./llm-utils";
import type { BriefAnalysis } from "./brief-analyzer";
import type { DesignPlan } from "./plan-generator";

export type GeneratedCode = {
  code: string;
  framework: string;
  componentName: string;
  imports: string[];
  setupNotes: string;
};

const FRAMEWORK_NOTES: Record<string, string> = {
  nextjs: "Next.js 16 App Router component on React 19. Add 'use client' only when browser state, effects, or event handlers require it.",
  react: "React 19 functional component with TypeScript and accessible semantic markup.",
  html: "Pure valid HTML5 + CSS with no build step.",
};

export async function generateCode(
  llm: LLMAdapter,
  analysis: BriefAnalysis,
  plan: DesignPlan,
  injectionContext: string,
  framework = "nextjs"
): Promise<GeneratedCode> {
  const frameworkNote = FRAMEWORK_NOTES[framework] ?? FRAMEWORK_NOTES.nextjs;

  // Build compact, non-contradictory color tokens
  const colorTokens = (plan.colorPalette ?? [])
    .map((c) => `  --color-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}: ${c.hex}; /* ${c.role} */`)
    .join("\n");

  // Build compact cognitive context (if available)
  const cognitiveBlock = plan.cognitiveGrounding
    ? [
        plan.cognitiveGrounding.vonRestorffCompliance ? `Von Restorff: ${plan.cognitiveGrounding.vonRestorffCompliance}` : "",
        plan.cognitiveGrounding.gutenbergCompliance ? `Gutenberg: ${plan.cognitiveGrounding.gutenbergCompliance}` : "",
        plan.cognitiveGrounding.peakEndDesign ? `Peak-End: ${plan.cognitiveGrounding.peakEndDesign}` : "",
      ].filter(Boolean).join("\n")
    : "";

  // Signature element — the soul of the design
  const signatureBlock = plan.signatureElement
    ? `SIGNATURE ELEMENT: "${plan.signatureElement.name}"
Description: ${plan.signatureElement.description ?? ""}
Implementation: ${plan.signatureElement.implementation}
Justification: ${plan.signatureElement.justification ?? ""}`
    : "";

  // ─── System prompt: focused, non-contradictory ─────────────────────────
  // KEY CHANGE: Removed fixed 5-section template, forced Unsplash images,
  // "150+ lines" requirement, and "Awwwards" buzzword soup.
  // The prompt now tells the LLM to execute the PLAN, not a generic template.
  const systemPrompt = `You are a senior frontend developer implementing a specific design plan into complete, working code.

${injectionContext}

=== DESIGN PLAN TO IMPLEMENT ===

COLOR PALETTE (use these as CSS custom properties):
${colorTokens}

TYPOGRAPHY:
• Display: ${plan.typePairing.display}
• Body: ${plan.typePairing.body}
• Rationale: ${plan.typePairing.rationale}

${signatureBlock}

${cognitiveBlock}

LAYOUT CONCEPT:
${plan.layoutConcept}

=== IMPLEMENTATION RULES ===
1. EXECUTE THE PLAN ABOVE — not a generic template. The layout, sections, and structure MUST match what the plan describes.
2. Use the EXACT color palette above as CSS custom properties. Text must be high-contrast and legible.
3. Use the exact sourced font from AVAILABLE ASSETS when one is provided. Otherwise use a deliberate system stack; never invent a font URL.
4. The "${plan.signatureElement?.name ?? "signature element"}" MUST be visually prominent and faithfully implemented as described above.
5. Use modern CSS (Grid, clamp(), logical properties). Mobile-responsive. Include prefers-reduced-motion.
6. Every section must have real, contextual copy — not lorem ipsum, not empty divs.
7. Use images ONLY if the design concept calls for them and ONLY use exact URLs listed in AVAILABLE ASSETS. Otherwise create a CSS-only treatment.
8. Return ONLY the complete, standalone code file. No markdown wrapping, no explanations outside the code.

Framework: ${frameworkNote}`;

  const userMessage = `Implement the design plan above as a complete ${framework} page for:
Subject: ${analysis.subject}
Audience: ${analysis.audience}
Primary Job: ${analysis.primaryJob}
Tone: ${analysis.tone}`;

  const code = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt,
    temperature: 0.5,
    maxTokens: 12000,
    reasoningEffort: "medium",
  });

  // Strip markdown code fences if present
  const cleaned = code
    .replace(/^```[\w]*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();

  // Extract component name from code
  const nameMatch = cleaned.match(/(?:function|const|export default function)\s+([A-Z][A-Za-z]+)/);
  const componentName = nameMatch?.[1] ?? "VerveComponent";

  // Extract imports
  const importMatches = cleaned.match(/^import .+$/gm) ?? [];

  return {
    code: cleaned,
    framework,
    componentName,
    imports: importMatches,
    setupNotes: `Typography: ${plan.typePairing.display} for display and ${plan.typePairing.body} for body. Follow the imports embedded in the generated file.`,
  };
}
