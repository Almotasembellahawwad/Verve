import type { LLMAdapter } from "./llm-utils";
import type { BriefAnalysis } from "./brief-analyzer";
import type { DesignPlan } from "./plan-generator";
import type { VerveProjectSpec } from "../domain/project-spec";
import { formatVerveProjectSpecForGeneration } from "./project-spec-builder";
import type { GenerationMode } from "../domain/generation-mode";
import { extractJSON } from "./llm-utils";

export type GeneratedSourceFile = { path: string; content: string; language: string };

export type GeneratedCode = {
  code: string;
  framework: string;
  componentName: string;
  imports: string[];
  setupNotes: string;
  entryPath?: string;
  files?: GeneratedSourceFile[];
};

/**
 * Return the complete delivered source, not only the compatibility entry file.
 * Deterministic evaluators use this view so a secondary component or stylesheet
 * cannot bypass the same policy and diversity checks applied to the entry.
 */
export function generatedSourceText(generated: GeneratedCode): string {
  if (!generated.files?.length) return generated.code;
  return generated.files
    .map((file) => `/* ${file.path} */\n${file.content}`)
    .join("\n\n");
}

const FRAMEWORK_NOTES: Record<string, string> = {
  nextjs: "Next.js 16 App Router app/page.tsx on React 19. It MUST have a default export. Add 'use client' only when browser state, effects, or event handlers require it.",
  react: "React 19 src/App.tsx with TypeScript and accessible semantic markup. It MUST have a default export.",
  html: "Pure valid HTML5 + CSS with no build step.",
};

const ENTRY_PATHS: Record<string, string> = { nextjs: "app/page.tsx", react: "src/App.tsx", html: "index.html" };
const SAFE_SOURCE_PATH = /^(?:app\/(?:[a-z0-9_-]+\/)*page\.tsx|components\/[A-Za-z0-9_-]+\.tsx|src\/(?:components|routes)\/[A-Za-z0-9_-]+\.tsx|src\/App\.tsx|(?:[a-z0-9_-]+\/)*index\.html|[a-z0-9_-]+\.html|(?:app|src)\/[A-Za-z0-9_/-]+\.css|styles\.css|script\.js)$/;

function languageFor(path: string): string {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".js")) return "javascript";
  return "text";
}

function parseGeneratedArtifact(raw: string, framework: string, maxFiles: number): { entryPath: string; files: GeneratedSourceFile[] } {
  const defaultEntry = ENTRY_PATHS[framework] ?? ENTRY_PATHS.nextjs;
  try {
    const parsed = extractJSON<{ files?: { path?: string; content?: string; language?: string }[] }>(raw, "Code Generator");
    const files = (parsed.files ?? [])
      .filter((candidate): candidate is { path: string; content: string; language?: string } => Boolean(candidate.path && candidate.content))
      .filter((candidate) => SAFE_SOURCE_PATH.test(candidate.path) && !candidate.path.includes(".."))
      .slice(0, maxFiles)
      .map((candidate) => ({ path: candidate.path.replace(/\\/g, "/"), content: candidate.content.trim(), language: candidate.language ?? languageFor(candidate.path) }));
    const entry = files.find((file) => file.path === defaultEntry) ?? files[0];
    if (entry) return { entryPath: entry.path, files };
  } catch {
    // Providers without reliable structured code output keep the legacy entry-file path.
  }
  const cleaned = raw.replace(/^```[\w]*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
  return { entryPath: defaultEntry, files: [{ path: defaultEntry, content: cleaned, language: languageFor(defaultEntry) }] };
}

const GENERATED_ARTIFACT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  properties: { files: { type: "array", minItems: 1, maxItems: 16, items: { type: "object", additionalProperties: false, properties: { path: { type: "string" }, content: { type: "string" }, language: { type: "string" } }, required: ["path", "content", "language"] } } },
  required: ["files"],
};

export async function generateCode(
  llm: LLMAdapter,
  analysis: BriefAnalysis,
  plan: DesignPlan,
  injectionContext: string,
  framework = "nextjs",
  mode: GenerationMode = "creative",
  projectSpec?: VerveProjectSpec
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

${projectSpec ? formatVerveProjectSpecForGeneration(projectSpec) : ""}

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
7. Obey the MEDIA POLICY in AVAILABLE ASSETS. Use images ONLY when exact URLs are listed. When the policy is REQUIRED but approved images are missing, make prominent, honest, labeled asset slots with the suggested subject and never disguise CSS texture as photography. When the policy is AVOID, prioritize real interface/data evidence over decorative stock imagery.
8. Every interaction must be truthful and operational. Never show fake form success. A form without a backend must clearly say it is a demo and must not claim submission.
9. Do not use innerHTML or dangerouslySetInnerHTML. Avoid runtime font imports and unnecessary third-party dependencies. Build dynamic content with safe DOM APIs or framework rendering.
10. Navigation targets must exist. Include an intentional ending and a real footer when the page format needs them.
11. Return ONLY a JSON object with a files array. Implement every declared route within ${projectSpec?.complexity.maxSourceFiles ?? (mode === "fast" ? 8 : 16)} source files. Required entry: ${ENTRY_PATHS[framework] ?? ENTRY_PATHS.nextjs}. No markdown or prose.
12. Split meaningful route or component boundaries into files. A local CSS file may be included in the files array and imported normally. Avoid package imports beyond React unless essential.
13. Every mapped React item must have an explicit unique stable id and use that id as its key. Never use visible copy such as label, title, name, result, or measurement as a key.
14. Do not use overflow:hidden on html, body, #root, or the page shell to conceal responsive overflow. Fix the child layout, use minmax(0, 1fr), and make deliberate wide data tables individually scrollable.
15. Do not reference a named font unless AVAILABLE ASSETS includes a bundled/local font file. A remote font name without the font file is not available. Otherwise use the exact system stack supplied by the plan. Keep all readable text at 10px or larger.
16. Preserve the plan's domain-native topology. Opening scale is unrestricted: a compact task surface and a viewport-filling visual composition are both valid. A large opening must carry verified task information and the immediate primary action; do not postpone the job behind atmospheric copy and stacked manifesto sections. The compound house style of huge sans type, one italic serif phrase, repeated viewport-height panels, and a bright accent remains forbidden.
17. FACTUAL SAFETY OVERRIDES THE DESIGN PLAN: if the plan contains a metric, clinical result, timeframe, participant count, ingredient, product, award, testimonial, or factual claim absent from the source brief below, do not render it. Replace it with an explicit "Verified value pending" label.
18. STRUCTURAL NOVELTY: Never combine a split opening, vertical rail/datum, numbered ledger rows, a full-width image interruption, and a dark closing folio. That is Verve's retired editorial-register template even when the class names or domain labels differ. Use the enforced direction's actual interaction and information topology instead.
19. FIRST VIEWPORT EVIDENCE: On the initial route, mark at least two distinct, visible, task-bearing elements with data-verve-task="primary-object" and data-verve-task="decision-evidence". Mark the immediately available primary control with the boolean data-verve-primary-action attribute. These markers are measurement hooks, not styling hooks. Do not put a marker on an empty wrapper or mark atmospheric copy as task evidence.
20. STORY GRAPH: Implement the declared visualNarrative as connected scenes, not interchangeable stacked sections. Each scene needs one dominant focal object, its declared evidence or interaction, and the stated visible consequence. A title plus paragraph does not fulfill a scene contract.
21. VISUAL RICHNESS: Fulfil every required functional layer in visualNarrative.richness. Concentrate detail locally around the active object while keeping the global composition legible. Texture, glow, gradient, or motion count only when they clarify material, hierarchy, space, evidence, or state.
22. ART DIRECTION: Treat compositionGrammar, materialVocabulary, imageLanguage, typographyVoice, and motionChoreography as one coherent system. Do not mix the selected layout with an unrelated palette or generic component-library styling.
23. VISUAL INTENT EVIDENCE: Put the exact data-verve-scene="scene-id" on every authored scene root. Mark each visible functional visual with one exact data-verve-layer value (media, data, shape, motion, or interaction) and a concise data-verve-visual-purpose explaining what it helps the audience understand or do. When using an assigned catalog asset, put its exact ID in data-verve-asset-id on the image or media element. Mark purely decorative visuals with data-verve-decoration. These are measurement hooks, never styling selectors, and an unsupported marker does not replace real content or state.

DELIVERY MODE: ${mode === "fast" ? "FAST — concise implementation; preserve correctness before decorative depth." : "CREATIVE — complete production-quality implementation with careful responsive details."}

Framework: ${frameworkNote}`;

  const userMessage = `Implement the design plan above as a complete ${framework} page for:
Subject: ${analysis.subject}
Audience: ${analysis.audience}
Primary Job: ${analysis.primaryJob}
Tone: ${analysis.tone}
Source brief - the sole authority for factual claims:
${analysis.rawBrief}`;

  const raw = await llm.complete([{ role: "user", content: userMessage }], {
    systemPrompt,
    temperature: 0.5,
    maxTokens: mode === "fast" ? 8000 : 14000,
    reasoningEffort: mode === "fast" ? "low" : "medium",
    timeoutMs: mode === "fast" ? 90_000 : 110_000,
    responseFormat: { name: "generated_project_sources", schema: GENERATED_ARTIFACT_JSON_SCHEMA },
  });
  const artifact = parseGeneratedArtifact(raw, framework, projectSpec?.complexity.maxSourceFiles ?? (mode === "fast" ? 8 : 16));
  const cleaned = artifact.files.find((file) => file.path === artifact.entryPath)?.content ?? artifact.files[0]?.content ?? "";

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
    entryPath: artifact.entryPath,
    files: artifact.files,
  };
}
