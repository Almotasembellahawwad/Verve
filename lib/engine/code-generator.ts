import { getLLMAdapter } from "../llm-adapter";
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
  nextjs: "Next.js 15 App Router component. Use 'use client' directive if you need interactivity. Import fonts from next/font/google.",
  react: "React 18 functional component with TypeScript. Use standard CSS imports.",
  html: "Pure HTML5 + CSS. No framework dependencies. Inline <style> tag for component styles.",
};

export async function generateCode(
  analysis: BriefAnalysis,
  plan: DesignPlan,
  blocklistInjection: string,
  framework = "nextjs"
): Promise<GeneratedCode> {
  const llm = getLLMAdapter();

  const frameworkNote = FRAMEWORK_NOTES[framework] ?? FRAMEWORK_NOTES.nextjs;

  const colorTokens = plan.colorPalette
    .map((c) => `  --color-${c.name.toLowerCase().replace(/\s+/g, "-")}: ${c.hex}; /* ${c.role} */`)
    .join("\n");

  const systemPrompt = `You are a senior frontend developer implementing a design plan into production-quality code.

${blocklistInjection}

CRITICAL IMPLEMENTATION RULES:
1. This code must be responsive (mobile-first) with no broken layouts below 375px
2. All interactive elements must be keyboard-accessible (proper focus states, ARIA labels)
3. Respect prefers-reduced-motion — all animations must have a motion-safe conditional
4. No CSS specificity conflicts — use BEM-style class names or CSS variables, not utility-class collisions
5. TypeScript strict mode — no 'any' types
6. The signature element "${plan.signatureElement.name}" MUST appear prominently — it is the visual core of this design
7. Do NOT default to generic patterns from the blocklist above

DESIGN TOKENS TO IMPLEMENT:
CSS Variables:
${colorTokens}

Display Font: ${plan.typePairing.display}
Body Font: ${plan.typePairing.body}
Type Rationale: ${plan.typePairing.rationale}

Signature Element: ${plan.signatureElement.name}
Implementation: ${plan.signatureElement.implementation}

Layout Concept:
${plan.layoutConcept}

Framework: ${frameworkNote}

Output a COMPLETE, working component with:
- Full HTML/JSX structure
- All CSS (either CSS-in-JS, <style> tags, or Tailwind with explicit CSS variable support)
- The signature element fully implemented, not stubbed
- Proper semantic HTML and accessibility attributes

Return ONLY code. No explanation outside code comments.`;

  const userMessage = `Generate the complete component for:
Subject: ${analysis.subject}
Primary Job: ${analysis.primaryJob}
Audience: ${analysis.audience}
Tone: ${analysis.tone}
Framework: ${framework}`;

  const code = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt,
    temperature: 0.6,
    maxTokens: 8000,
  });

  // Extract component name from code
  const nameMatch = code.match(/(?:function|const|export default function)\s+([A-Z][A-Za-z]+)/);
  const componentName = nameMatch?.[1] ?? "VerveComponent";

  // Extract imports
  const importMatches = code.match(/^import .+$/gm) ?? [];

  return {
    code,
    framework,
    componentName,
    imports: importMatches,
    setupNotes: `Font setup: Install ${plan.typePairing.display} and ${plan.typePairing.body} via next/font/google or Google Fonts CDN.`,
  };
}
