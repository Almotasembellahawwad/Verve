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
  nextjs: "Next.js 16 App Router app/page.tsx on React 19. It MUST have a default export. Add 'use client' only when browser state, effects, or event handlers require it.",
  react: "React 19 src/App.tsx with TypeScript and accessible semantic markup. It MUST have a default export.",
  html: "Pure valid HTML5 + CSS with no build step.",
};

export async function generateCode(
  llm: LLMAdapter,
  analysis: BriefAnalysis,
  plan: DesignPlan,
  injectionContext: string,
  framework = "nextjs",
  mode: "fast" | "studio" = "studio"
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
  const systemPrompt = `You are a senior frontend developer implementing a specific design plan into production-minded, working code.

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
3. Use an exact bundled/local font from AVAILABLE ASSETS when one is provided. If the supplied font would require a runtime CDN fetch, use a deliberate system stack instead. Never invent a font URL, never use CSS @import, and limit web fonts to the two weights actually needed.
4. The "${plan.signatureElement?.name ?? "signature element"}" must be implemented once as a purposeful focal point. Do not repeat a decorative motif across every section.
5. Use modern CSS (Grid, clamp(), logical properties), focus-visible states, semantic landmarks, 360/768/1440 responsive behavior, and prefers-reduced-motion.
6. Every section must contain concise, contextual copy. Never invent client names, testimonials, awards, metrics, addresses, or project facts that were not supplied. A supplied total count does NOT authorize inventing item-level records: if names, dates, places, descriptions, or images are missing, label the UI "Project material pending" (or equivalent) and use neutral numbered placeholders rather than fabricated portfolio evidence.
7. Use images ONLY when exact URLs are listed in AVAILABLE ASSETS. For image-dependent businesses, make honest labeled placeholders instead of pretending CSS textures are portfolio photography.
8. Every interaction must be truthful and operational. Never show fake form success. A form without a backend must clearly say it is a demo and must not claim submission.
9. Do not use innerHTML or dangerouslySetInnerHTML. Avoid runtime font imports and unnecessary third-party dependencies. Build dynamic content with safe DOM APIs or framework rendering.
10. Navigation targets must exist. Include an intentional ending and a real footer when the page format needs them.
11. Return ONLY one complete entry file for the selected framework. Verve will create the remaining project files deterministically. No markdown or explanations.
12. Keep styling inside the entry component using a plain <style> element. Do not import a local CSS file that Verve has not supplied. Avoid package imports beyond React unless essential.

DELIVERY MODE: ${mode === "fast" ? "FAST — concise implementation; preserve correctness before decorative depth." : "STUDIO — complete production-quality implementation with careful responsive details."}

Framework: ${frameworkNote}`;

  const userMessage = `Implement the design plan above as a complete ${framework} page for:
Subject: ${analysis.subject}
Audience: ${analysis.audience}
Primary Job: ${analysis.primaryJob}
Tone: ${analysis.tone}`;

  const code = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt,
    temperature: 0.5,
    maxTokens: mode === "fast" ? 8000 : 14000,
    reasoningEffort: mode === "fast" ? "low" : "medium",
    timeoutMs: mode === "fast" ? 90_000 : 110_000,
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
