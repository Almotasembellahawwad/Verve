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
  nextjs: "Next.js 15 App Router component. Use 'use client' directive if you need interactivity. Import fonts from next/font/google or load Google Fonts CDN.",
  react: "React 18 functional component with TypeScript. Standard CSS modules or styled component.",
  html: "Pure HTML5 + CSS. Include valid Google Fonts @import at top of <style> tag.",
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

  const systemPrompt = `You are a world-class award-winning creative technologist (Awwwards / FWA / Studio Freight standard) implementing a design plan into production-quality code.

${blocklistInjection}

CRITICAL PRODUCTION QUALITY RULES:
1. IMAGES: Every <img> or background-image MUST use real, high-resolution Unsplash URLs matching the topic (e.g. "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80"). NEVER use dead placeholders like "image.jpg", "large-image.jpg", or empty gray boxes!
2. COLOR & CONTRAST: Ensure AAA contrast ratio between text and background. Primary text MUST be crisp and readable (#F4F1EA on dark canvas, #14221F on light canvas). NEVER use gray text on gray backgrounds!
3. FONTS: Load ONLY real, verified Google Fonts via valid @import (e.g., Cormorant Garamond, DM Sans, Plus Jakarta Sans, Playfair Display, Space Grotesk). NEVER invent fake font names like "The Creator"!
4. RESPONSIVE LAYOUT: Mobile-first responsive structure with grid/flexbox, rich spatial typography, and luxury editorial hierarchy.
5. ACCESSIBILITY & MOTION: Keyboard focus states, ARIA labels, and prefers-reduced-motion media query wrapping all keyframes.
6. SIGNATURE ELEMENT: The signature element "${plan.signatureElement.name}" MUST be fully built and rendered prominently.

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

Framework Context: ${frameworkNote}

Return ONLY a complete, standalone, production-grade working component/page code. No explanations.`;

  const userMessage = `Generate the complete production component for:
Subject: ${analysis.subject}
Primary Job: ${analysis.primaryJob}
Audience: ${analysis.audience}
Tone: ${analysis.tone}
Framework: ${framework}`;

  const code = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt,
    temperature: 0.5,
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
    setupNotes: `Font setup: Uses ${plan.typePairing.display} and ${plan.typePairing.body} via Google Fonts CDN.`,
  };
}
