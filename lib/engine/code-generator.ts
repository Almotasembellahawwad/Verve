import type { LLMAdapter } from "./llm-utils";
import type { BriefAnalysis } from "./brief-analyzer";
import type { DesignPlan } from "./plan-generator";
import type { VerveProjectSpec } from "../domain/project-spec";
import { formatVerveProjectSpecForGeneration } from "./project-spec-builder";
import type { GenerationMode } from "../domain/generation-mode";
import { extractJSON } from "./llm-utils";
import { ProviderResponseError } from "../errors/provider-response-error";

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
const SAFE_TYPED_SOURCE_PATH = /^(?:app|src|components|lib)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:ts|tsx)$/;
const SAFE_BROWSER_SOURCE_PATH = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:html|css|js|mjs)$/;
const RESERVED_SOURCE_PATH = /(?:^|\/)(?:node_modules|dist|build|out|coverage|__verve_render_probe)(?:\/|\.|$)|(?:^|\/)(?:next|vite|eslint|postcss|tailwind)\.config\.[^/]+$|(?:^|\/)verve-design\.css$|^app\/layout\.tsx$|^src\/main\.(?:ts|tsx)$/i;
const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i;
const MAX_SOURCE_FILE_CHARS = 120_000;
const MAX_SOURCE_TOTAL_CHARS = 500_000;

/** Validate before consuming provider paths; generated files cannot replace owned scaffolding. */
function normalizeGeneratedSourcePath(path: string, framework: string): string | undefined {
  if (!path || path.length > 240 || path !== path.trim() || /[\u0000-\u001f\u007f:%?#]/.test(path)) return undefined;
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === ".." || WINDOWS_RESERVED_SEGMENT.test(part))) return undefined;
  if (RESERVED_SOURCE_PATH.test(normalized)) return undefined;
  const typedSourceAllowed = framework !== "html" && SAFE_TYPED_SOURCE_PATH.test(normalized);
  const browserSourceAllowed = SAFE_BROWSER_SOURCE_PATH.test(normalized) && (framework === "html" || !normalized.endsWith(".html"));
  return typedSourceAllowed || browserSourceAllowed ? normalized : undefined;
}

export class GeneratedSourceDeliveryError extends ProviderResponseError {
  constructor(message: string) {
    super(`Generated source delivery failed: ${message}`, "malformed_output");
    this.name = "GeneratedSourceDeliveryError";
  }
}

function languageFor(path: string): string {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (/\.(?:js|mjs)$/.test(path)) return "javascript";
  return "text";
}

export function parseGeneratedArtifact(raw: string, framework: string, maxFiles: number): { entryPath: string; files: GeneratedSourceFile[] } {
  const defaultEntry = ENTRY_PATHS[framework] ?? ENTRY_PATHS.nextjs;
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 16) throw new GeneratedSourceDeliveryError("the source-file budget must be an integer between 1 and 16.");
  const cleaned = raw.replace(/^```[\w]*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
  const legacyEntry = (): { entryPath: string; files: GeneratedSourceFile[] } => {
    if (!cleaned || cleaned.length > MAX_SOURCE_FILE_CHARS) throw new GeneratedSourceDeliveryError("the legacy entry source is empty or oversized.");
    return { entryPath: defaultEntry, files: [{ path: defaultEntry, content: cleaned, language: languageFor(defaultEntry) }] };
  };
  // JSON embedded inside an HTML script or component is application data, not
  // the provider's file manifest. Preserve legacy source before JSON recovery.
  if (/^(?:<!doctype\s+html\b|<html(?:\s|>)|(?:import|export|function|const|let|var)\b|["']use client["'])/i.test(cleaned)) return legacyEntry();
  let parsed: unknown;
  try {
    parsed = extractJSON<unknown>(raw, "Code Generator");
  } catch {
    // Providers without reliable structured code output keep the legacy entry-file path.
    // A broken manifest must not be mistaken for HTML/TSX source, however.
    if (/^\s*\{|^\s*```json\b/.test(raw)) {
      throw new GeneratedSourceDeliveryError("the provider returned a malformed source manifest.");
    }
  }

  if (parsed && typeof parsed === "object" && "files" in parsed) {
    const candidates = (parsed as { files: unknown }).files;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new GeneratedSourceDeliveryError("the source manifest must contain a nonempty files array.");
    }
    if (candidates.length > maxFiles) {
      throw new GeneratedSourceDeliveryError(`the source manifest exceeds the ${maxFiles}-file budget; dependency files were not truncated.`);
    }

    const files: GeneratedSourceFile[] = [];
    const paths = new Set<string>();
    let totalChars = 0;
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object" || typeof candidate.path !== "string" || typeof candidate.content !== "string") {
        throw new GeneratedSourceDeliveryError("every source file must have a string path and content.");
      }
      const path = normalizeGeneratedSourcePath(candidate.path, framework);
      if (!path) throw new GeneratedSourceDeliveryError("the source manifest contains an unsafe or reserved path.");
      if (paths.has(path.toLowerCase())) throw new GeneratedSourceDeliveryError(`the source manifest contains a duplicate path: ${path}.`);
      paths.add(path.toLowerCase());
      const content = candidate.content.trim();
      totalChars += content.length;
      if (!content || content.length > MAX_SOURCE_FILE_CHARS || totalChars > MAX_SOURCE_TOTAL_CHARS) {
        throw new GeneratedSourceDeliveryError("the source manifest contains an empty or oversized source file.");
      }
      files.push({ path, content, language: languageFor(path) });
    }
    if (!files.some((file) => file.path === defaultEntry)) {
      throw new GeneratedSourceDeliveryError(`the source manifest is missing its required entry: ${defaultEntry}.`);
    }
    return { entryPath: defaultEntry, files };
  }

  if (/^\s*\{|^\s*```json\b/.test(raw)) {
    throw new GeneratedSourceDeliveryError("the provider returned JSON without a source files array.");
  }
  return legacyEntry();
}

export const generatedArtifactJsonSchema = (maxFiles: number): Record<string, unknown> => ({
  type: "object", additionalProperties: false,
  properties: { files: { type: "array", minItems: 1, maxItems: maxFiles, items: { type: "object", additionalProperties: false, properties: { path: { type: "string" }, content: { type: "string" }, language: { type: "string" } }, required: ["path", "content", "language"] } } },
  required: ["files"],
});

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
  const modeFileLimit = mode === "fast" ? 8 : 16;
  const requestedFileLimit = projectSpec?.complexity.maxSourceFiles ?? modeFileLimit;
  if (!Number.isInteger(requestedFileLimit) || requestedFileLimit < 1) throw new GeneratedSourceDeliveryError("the source-file budget must be a positive integer.");
  const maxFiles = Math.min(requestedFileLimit, modeFileLimit);
  const declaredRoutePaths = projectSpec?.experience.routes.map((route) => route.path) ?? ["/"];

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
7. Obey the MEDIA POLICY in AVAILABLE ASSETS. Use images ONLY when exact URLs are listed. When the policy is REQUIRED but approved images are missing, keep an honest, clearly labeled media reservation for each required scene, but do not turn repeated giant "Photography required" panels into the page's focal objects. Build the remaining experience from useful original spatial diagrams, material comparisons, and working controls; the missing photography still blocks release. Never disguise CSS texture as a real project photograph. When the policy is AVOID, prioritize real interface/data evidence over decorative stock imagery.
8. Every interaction must be truthful and operational. Never show fake form success. A form without a backend must clearly say it is a demo and must not claim submission.
9. Do not use innerHTML or dangerouslySetInnerHTML. Avoid runtime font imports and unnecessary third-party dependencies. Build dynamic content with safe DOM APIs or framework rendering.
10. Navigation targets must exist. Include an intentional ending and a real footer when the page format needs them.
11. Return ONLY a JSON object with a files array. Implement all and ONLY the declared page routes within ${maxFiles} source files. Declared page routes (exclusive): ${JSON.stringify(declaredRoutePaths)}. The route and file budgets are ceilings, not quotas: never invent extra pages to fill them. Never add an automatic comparison page; /compare is permitted only when it is already in the declared page routes. Older plan prose or checkpoint notes cannot authorize an undeclared route. Required entry: ${ENTRY_PATHS[framework] ?? ENTRY_PATHS.nextjs}. No markdown or prose. Include the complete dependency closure: every referenced local script, imported module, and stylesheet must be present in files, not merely linked from HTML. If the budget is tight, consolidate your implementation before returning it; never omit a dependency file.
12. Split meaningful route or component boundaries into files. Safe relative .css, .js, and .mjs source paths (including app.js, scripts/app.js, and styles/main.css) are supported. Only HTML projects may author .html pages. React/Next.js instead use nested .ts/.tsx modules under app/, src/, components/, or lib/; never add an authored .html page to a React/Next.js project or replace React's engine-owned index.html scaffold. HTML has no transpilation step, so never include TypeScript or TSX source in an HTML project. Paths must be relative, unique, and free of traversal, hidden directories, URLs, or generated configuration overrides. Do not author engine-owned app/layout.tsx, src/main.tsx, src/main.ts, verve-design.css, or __verve_render_probe.js files. Use route-relative links to shared scripts/styles. HTML controls need actual included JavaScript event handlers (or truthful native HTML behavior); do not deliver only data attributes on inert controls. Avoid package imports beyond React unless essential.
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
24. COMPOSITE KEYBOARD CONTRACT: If you author role="tablist" or another ARIA composite, implement one Tab stop with roving tabindex. Arrow keys move inside the composite; Home/End are supported for tabs; activation updates aria-selected and the visible panel either on focus or on Enter/Space. Do not leave every tab at tabindex 0. A global focus ring is necessary but does not replace component keyboard behavior.
25. EVIDENCE-LED DETAIL: When Brief Evidence supplies records, attributes, comparison dimensions, exclusions, or gaps, make them the visible information architecture. Do not replace a real specification ledger with generic feature cards or marketing adjectives. Never synthesize the missing members of a declared collection; label the exact evidence gap and provide a truthful route for obtaining it.
26. RENDERED EVIDENCE HOOKS: For every scene-bound Brief Evidence item, put its exact evidence ID in data-verve-evidence-id on the smallest meaningful visible element or group that renders it. A hidden node, empty wrapper, comment, or unrelated ancestor is invalid. Keep these hooks out of CSS selectors and never put the private evidence text in telemetry attributes; the ID is the only measurement value.
27. COMPOSITION GENOME: Implement each visualNarrative.compositionGenome assignment as real CSS/layout behavior, not metadata. On the same scene root that carries data-verve-scene, put the exact structure in data-verve-composition, flow in data-verve-flow, and depth in data-verve-depth. Do not style through these measurement attributes. Use classes/components for the declared focal position, overlap, density, media frame, continuity, and mobile transform. Adjacent scenes must remain recognizably different after responsive recomposition; a repeated centered title/paragraph stack fails the contract.
28. COPY BOUNDARY: The plan, Story Graph, topology, scene contract, source brief, and composition notes are private director instructions. Never quote, paraphrase, explain, or expose them in visitor-facing copy. Write only in the subject's own voice. Say "product information is pending" when necessary, never "the brief did not supply it" or "the page topology changes".
29. FIRST-VIEWPORT REALIZATION: At 360, 768, and 1440, the initial viewport must visibly contain the primary object, one decision-bearing fact or state, and the immediately usable primary action. Media may lead the composition, but it must not push all task information and action below the fold. Entrance motion may enrich the reveal but must not make these three signals absent on first paint or under reduced motion.

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
    responseFormat: { name: "generated_project_sources", schema: generatedArtifactJsonSchema(maxFiles) },
  });
  const artifact = parseGeneratedArtifact(raw, framework, maxFiles);
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
