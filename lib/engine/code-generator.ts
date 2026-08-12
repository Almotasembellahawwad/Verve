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

  // Extract detailed color tokens with roles
  const colorTokensDetailed = (plan.colorPalette ?? [])
    .map((c) => `  --color-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}: ${c.hex}; /* Role: ${c.role} */`)
    .join("\n");

  // Extract Cognitive Grounding directives (Module G)
  const cognitiveContext = plan.cognitiveGrounding
    ? `
COGNITIVE GROUNDING DIRECTIVES (Module G):
• Von Restorff Visual Isolation: ${plan.cognitiveGrounding.vonRestorffCompliance ?? "N/A"}
• Gutenberg Grid & POA/TA Anchoring: ${plan.cognitiveGrounding.gutenbergCompliance ?? "N/A"}
• Peak-End Closing Section Treatment: ${plan.cognitiveGrounding.peakEndDesign ?? "N/A"}
• Target Signal-to-Noise Ratio: ${plan.cognitiveGrounding.signalNoiseRatio ?? 0.8}
• Usability Baseline: ${plan.cognitiveGrounding.usabilityBaseline ?? "N/A"}
`
    : "";

  // Extract full Signature Element details
  const signatureContext = plan.signatureElement
    ? `
SIGNATURE DESIGN ELEMENT (Visual Core):
• Name: ${plan.signatureElement.name}
• Description: ${plan.signatureElement.description ?? ""}
• Implementation Guidelines: ${plan.signatureElement.implementation}
• Strategic Justification: ${plan.signatureElement.justification ?? ""}
`
    : "";

  // Extract raw plan text if available
  const rawPlanBlock = plan.rawPlan
    ? `
RAW DESIGN PLAN SUMMARY:
${plan.rawPlan}
`
    : "";

  const systemPrompt = `You are a world-class award-winning creative technologist (Awwwards / FWA / Studio Freight standard) executing a complete design plan into code.

${blocklistInjection}

=== COMPREHENSIVE DESIGN PLAN TO EXECUTE IN CODE ===

COLOR PALETTE & CSS VARIABLES:
${colorTokensDetailed}

TYPOGRAPHY SPECIFICATION:
• Display Font: ${plan.typePairing.display}
• Body Font: ${plan.typePairing.body}
• Rationale: ${plan.typePairing.rationale}

${signatureContext}
${cognitiveContext}

LAYOUT CONCEPT & STRUCTURE:
${plan.layoutConcept}

${rawPlanBlock}

CRITICAL DIRECTIVES FOR COMPLETE CODE TRANSLATION:
1. FULL PLAN FAITHFULNESS: Every section, layout concept, and cognitive directive specified in the Design Plan above MUST be fully translated into actual HTML/CSS elements. Do NOT skip, summarize, or omit any section specified in the plan!
2. NO EMPTY CONTAINERS OR STUBS: Never output empty <div> tags or stubbed sections (like <div class="image"></div>). Every element MUST have real copy, subheadings, rich paragraphs, specs, or populated images!
3. MANDATORY 5-SECTION RICH PAGE ARCHITECTURE:
   - Section 1: Hero -- Bold Editorial Headline, Subhead, Badge, Primary & Secondary CTAs, Hero Visual.
   - Section 2: Signature Element Showcase -- Fully implementing "${plan.signatureElement?.name ?? "Signature Showcase"}" with visual depth.
   - Section 3: Value Grid / Monograph Breakdown -- Multi-column editorial cards with detailed descriptions.
   - Section 4: Material Specs / Social Proof / Key Statistics Grid.
   - Section 5: Closing Statement (Peak-End design) & Footer with full navigation links and copyright.
4. MANDATORY UNSPLASH IMAGES: You MUST include at least THREE real <img src="https://images.unsplash.com/photo-..."> elements in the layout with object-fit: cover. A layout without images is an automatic failure!
5. AAA COLOR CONTRAST: Text MUST be high-contrast and legible (#F4F1EA on dark, #14221F on sand). NEVER render gray text on gray backgrounds!
6. VERIFIED GOOGLE FONTS ONLY: Include real @import for Google Fonts (e.g., Cormorant Garamond, DM Sans, Plus Jakarta Sans, Playfair Display). If the plan asks for a non-Google font (like Zodiak or Satoshi), silently fall back to a Google Font equivalent (e.g., Playfair Display or Inter). NEVER invent fake font names!

AWWWARDS CSS ARCHITECTURE & DESIGN ENGINEERING:
- Asymmetrical Layouts: Avoid boring center-aligned stacked blocks. Use CSS Grid to create dynamic, overlapping, or asymmetrical editorial layouts.
- Luxury Spacing: Use massive padding/margins (e.g., padding: 12vh 8vw) to let elements breathe.
- Display Typography: Use clamp() for massive responsive headlines (e.g., font-size: clamp(3rem, 8vw, 7rem)). Apply tight tracking to display headings (letter-spacing: -0.02em).
- Depth & Physicality: Use subtle borders (rgba(255,255,255,0.1) or rgba(0,0,0,0.1)) and shadows to separate cards from the background.
- Responsive & Accessible: Mobile-first responsive flex/grid, focus states, and prefers-reduced-motion media query.

Framework Context: ${frameworkNote}

Return ONLY a complete, standalone, highly detailed, production-grade working code file (150+ lines of rich HTML/CSS). No markdown text outside code.`;

  const userMessage = `Execute the complete design plan into production code for:
Subject: ${analysis.subject}
Primary Job: ${analysis.primaryJob}
Audience: ${analysis.audience}
Tone: ${analysis.tone}
Framework: ${framework}`;

  const code = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt,
    temperature: 0.5,
    maxTokens: 12000, // Rich full-page code: ~300-400 lines of HTML/CSS/JSX
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
