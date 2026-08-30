import { z } from "zod";
import type { EffectiveGenerationMode, GenerationMode } from "../domain/generation-mode";
import { effectiveGenerationMode } from "../domain/generation-mode";
import {
  CREATIVITY_CLASSES,
  EXPERIENCE_MODELS,
  NAVIGATION_MODELS,
  OPENING_MODES,
  type DesignDirectionCandidate,
  type DesignDirectionFingerprint,
  type DirectionBoard,
  type DirectionCheckpoint,
  type DirectionPortfolio,
} from "../domain/design-direction";
import type { ReferenceLibraryRepositoryPort } from "../ports/repositories";
import type { LLMPort } from "../ports/llm";
import type { BriefAnalysis } from "./brief-analyzer";
import { extractJSON } from "./llm-utils";
import {
  applySelectedDirection,
  assessDirectionPortfolio,
  createFallbackDirectionPortfolio,
  normalizeDirectionPortfolio,
} from "./direction-portfolio";
import { fingerprintPipelineInput } from "./pipeline-checkpoint";
import { formatReferencePatternsForPrompt, selectReferencePatterns } from "./reference-retrieval";
import type { DesignPlan } from "./plan-generator";

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i);
const CandidateSchema = z.object({
  id: z.string().min(2).max(80),
  concept: z.string().min(10).max(500),
  justification: z.string().min(20).max(1200),
  distinction: z.string().min(10).max(800),
  briefFit: z.number().min(0).max(100),
  feasibility: z.number().min(0).max(100),
  descriptors: z.object({
    creativityClass: z.enum(CREATIVITY_CLASSES),
    experienceModel: z.enum(EXPERIENCE_MODELS),
    openingMode: z.enum(OPENING_MODES),
    navigationModel: z.enum(NAVIGATION_MODELS),
    density: z.enum(["airy", "balanced", "dense"]),
    spatialSystem: z.string().min(5).max(400),
    mediaRole: z.enum(["none", "supporting", "evidence", "primary", "interactive"]),
    motionRole: z.enum(["none", "feedback", "narrative", "spatial", "data"]),
    typographyVoice: z.string().min(5).max(300),
    colorStrategy: z.string().min(5).max(300),
  }),
  identity: z.object({
    palette: z.array(z.object({ name: z.string().min(1).max(80), hex: HexColor, role: z.string().min(2).max(160) })).min(3).max(6),
    displayTypeface: z.string().min(2).max(180),
    bodyTypeface: z.string().min(2).max(180),
  }),
  dimensions: z.object({
    topology: z.string().min(10).max(700),
    hierarchy: z.string().min(10).max(700),
    spatialRhythm: z.string().min(10).max(700),
    typographyRole: z.string().min(10).max(700),
    mediaStrategy: z.string().min(10).max(700),
    interactionMetaphor: z.string().min(10).max(700),
    signatureMechanism: z.string().min(10).max(700),
  }),
});

const BLUEPRINTS = [
  { creativityClass: "combinational", experienceModel: "guided-conversation", openingMode: "question-first", navigationModel: "stepper" },
  { creativityClass: "combinational", experienceModel: "spatial-map", openingMode: "media-first", navigationModel: "spatial" },
  { creativityClass: "exploratory", experienceModel: "task-workbench", openingMode: "task-first", navigationModel: "hub-and-spoke" },
  { creativityClass: "exploratory", experienceModel: "collection-browser", openingMode: "index-first", navigationModel: "filter-and-inspect" },
  { creativityClass: "transformational", experienceModel: "live-canvas", openingMode: "canvas-first", navigationModel: "direct-manipulation" },
  { creativityClass: "transformational", experienceModel: "narrative-scroll", openingMode: "story-first", navigationModel: "linear" },
] as const;

function candidateJsonSchema(count: number): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      candidates: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" }, concept: { type: "string" }, justification: { type: "string" }, distinction: { type: "string" },
            briefFit: { type: "number", minimum: 0, maximum: 100 }, feasibility: { type: "number", minimum: 0, maximum: 100 },
            descriptors: {
              type: "object", additionalProperties: false,
              properties: {
                creativityClass: { type: "string", enum: [...CREATIVITY_CLASSES] }, experienceModel: { type: "string", enum: [...EXPERIENCE_MODELS] },
                openingMode: { type: "string", enum: [...OPENING_MODES] }, navigationModel: { type: "string", enum: [...NAVIGATION_MODELS] },
                density: { type: "string", enum: ["airy", "balanced", "dense"] }, spatialSystem: { type: "string" },
                mediaRole: { type: "string", enum: ["none", "supporting", "evidence", "primary", "interactive"] },
                motionRole: { type: "string", enum: ["none", "feedback", "narrative", "spatial", "data"] },
                typographyVoice: { type: "string" }, colorStrategy: { type: "string" },
              },
              required: ["creativityClass", "experienceModel", "openingMode", "navigationModel", "density", "spatialSystem", "mediaRole", "motionRole", "typographyVoice", "colorStrategy"],
            },
            identity: {
              type: "object", additionalProperties: false,
              properties: {
                palette: { type: "array", minItems: 3, maxItems: 6, items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, hex: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, role: { type: "string" } }, required: ["name", "hex", "role"] } },
                displayTypeface: { type: "string" }, bodyTypeface: { type: "string" },
              }, required: ["palette", "displayTypeface", "bodyTypeface"],
            },
            dimensions: { type: "object", additionalProperties: false, properties: { topology: { type: "string" }, hierarchy: { type: "string" }, spatialRhythm: { type: "string" }, typographyRole: { type: "string" }, mediaStrategy: { type: "string" }, interactionMetaphor: { type: "string" }, signatureMechanism: { type: "string" } }, required: ["topology", "hierarchy", "spatialRhythm", "typographyRole", "mediaStrategy", "interactionMetaphor", "signatureMechanism"] },
          },
          required: ["id", "concept", "justification", "distinction", "briefFit", "feasibility", "descriptors", "identity", "dimensions"],
        },
      },
    },
    required: ["candidates"],
  };
}

function scoreQuality(candidate: z.infer<typeof CandidateSchema>, analysis: BriefAnalysis): DesignDirectionCandidate {
  const text = `${candidate.concept} ${candidate.justification} ${candidate.dimensions.topology}`.toLowerCase();
  const subjectTerms = analysis.subject.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const mentionsSubject = subjectTerms.some((term) => text.includes(term));
  const containsInventedMetric = /\b\d+(?:\.\d+)?\s*(?:%|percent|users|customers|years|days)\b/i.test(text);
  const briefCoverage = Math.min(96, Math.max(64, candidate.briefFit + (mentionsSubject ? 4 : -8)));
  const factualSafety = containsInventedMetric ? 55 : 94;
  const responsiveFeasibility = Math.min(95, Math.max(55, candidate.feasibility));
  const interactionTruth = /submit|purchase|payment|booking confirmed|successfully sent/i.test(text) ? 62 : 90;
  const mediaFeasibility = candidate.descriptors.mediaRole === "primary" && /pending|placeholder/i.test(text) ? 55 : 84;
  return {
    ...candidate,
    quality: {
      briefCoverage,
      factualSafety,
      responsiveFeasibility,
      interactionTruth,
      mediaFeasibility,
      passed: briefCoverage >= 65 && factualSafety >= 70 && responsiveFeasibility >= 60 && interactionTruth >= 70 && mediaFeasibility >= 55,
    },
  };
}

function enforceBlueprints(candidates: DesignDirectionCandidate[], fallback: DesignDirectionCandidate[]): DesignDirectionCandidate[] {
  return BLUEPRINTS.map((blueprint, index) => {
    const candidate = candidates[index] ?? fallback[index];
    return {
      ...candidate,
      id: `${blueprint.creativityClass}-${blueprint.experienceModel}`,
      descriptors: { ...candidate.descriptors, ...blueprint },
    };
  });
}

async function requestCandidates(
  llm: LLMPort,
  analysis: BriefAnalysis,
  referenceContext: string,
  count: 3 | 6,
  batch: "all" | "independent-a" | "independent-b",
  effectiveMode: EffectiveGenerationMode
): Promise<z.infer<typeof CandidateSchema>[]> {
  const blueprintSlice = count === 6 ? BLUEPRINTS : batch === "independent-a" ? BLUEPRINTS.slice(0, 3) : BLUEPRINTS.slice(3);
  const response = await llm.complete([{ role: "user", content: [
    `Create ${count} design directions for this brief.`,
    `Subject: ${analysis.subject}`,
    `Audience: ${analysis.audience}`,
    `Primary job: ${analysis.primaryJob}`,
    `Tone: ${analysis.tone}`,
    `Source brief (the only authority for factual claims): ${analysis.rawBrief}`,
    referenceContext,
    `Required direction cells: ${JSON.stringify(blueprintSlice)}`,
  ].join("\n\n") }], {
    systemPrompt: [
      "You are the divergent ideation stage of Verve Creative Engine v3.",
      "Return structural alternatives, not six skins of a landing page. Every direction must use its required experience/opening/navigation cell.",
      "Never reward statistical likelihood. Do not treat opening size as a quality proxy: a large visual opening is valid when it carries task information and an immediate action. Avoid the generic pattern of an atmospheric slogan that postpones the job into stacked manifesto sections, as well as the retired editorial register or one-accent-line default.",
      "Use system-safe typeface stacks unless assets are explicitly supplied. Do not invent claims, people, metrics, addresses, testimonials, products, or awards.",
      "Each signature mechanism must change how the audience understands or acts; it cannot be a decorative line, glow, grain, or cursor alone.",
    ].join("\n"),
    temperature: effectiveMode === "creative" ? 0.95 : 0.78,
    maxTokens: count === 6 ? 9000 : 6000,
    reasoningEffort: effectiveMode === "creative" ? "medium" : "low",
    timeoutMs: effectiveMode === "creative" ? 70_000 : 55_000,
    responseFormat: { name: `verve_direction_board_${count}`, schema: candidateJsonSchema(count) },
  });
  const parsed = z.object({ candidates: z.array(CandidateSchema).length(count) }).parse(extractJSON(response, "DirectionBoard"));
  return parsed.candidates;
}

export function fingerprintDirectionRequest(input: { brief: string; framework: string; mode: GenerationMode; brandContext?: string }): string {
  return fingerprintPipelineInput({ ...input, mode: effectiveGenerationMode(input.mode) });
}

export async function generateDirectionBoard(input: {
  llm: LLMPort;
  analysis: BriefAnalysis;
  mode: GenerationMode;
  framework: string;
  referenceRepository: ReferenceLibraryRepositoryPort;
  recentDirectionFingerprints?: DesignDirectionFingerprint[];
  brandContext?: string;
}): Promise<DirectionBoard> {
  const effectiveMode = effectiveGenerationMode(input.mode);
  const references = selectReferencePatterns(input.analysis, input.referenceRepository);
  const referenceContext = formatReferencePatternsForPrompt(references);
  const fallbackPlan: DesignPlan = {
    colorPalette: [], typePairing: { display: "Arial, sans-serif", body: "Arial, sans-serif", rationale: "Fallback seed." },
    layoutConcept: `Build the experience around ${input.analysis.primaryJob}.`,
    signatureElement: { name: "Domain mechanism", description: "A mechanism derived from the primary job.", implementation: "Use the primary task as the visible organizing rule.", justification: "The task should determine the identity." },
    referencesSampled: [],
    cognitiveGrounding: { vonRestorffCompliance: "One task-derived mechanism.", gutenbergCompliance: "Primary task first.", signalNoiseRatio: 0.72, peakEndDesign: "End at the truthful task state.", usabilityBaseline: "AA contrast and visible focus." },
    rawPlan: "Direction Board fallback seed.",
  };
  const fallback = createFallbackDirectionPortfolio(fallbackPlan, input.analysis).candidates;
  let candidates: DesignDirectionCandidate[];
  let usedFallback = false;
  try {
    if (effectiveMode === "creative") {
      const [first, second] = await Promise.all([
        requestCandidates(input.llm, input.analysis, referenceContext, 3, "independent-a", effectiveMode),
        requestCandidates(input.llm, input.analysis, referenceContext, 3, "independent-b", effectiveMode),
      ]);
      candidates = [...first, ...second].map((candidate) => scoreQuality(candidate, input.analysis));
    } else {
      candidates = (await requestCandidates(input.llm, input.analysis, referenceContext, 6, "all", effectiveMode))
        .map((candidate) => scoreQuality(candidate, input.analysis));
    }
  } catch {
    candidates = fallback;
    usedFallback = true;
  }
  candidates = enforceBlueprints(candidates, fallback);
  const portfolio: DirectionPortfolio = normalizeDirectionPortfolio({
    source: usedFallback ? "local-fallback" : effectiveMode === "creative" ? "provider-creative" : "provider",
    candidates,
    selectedDirectionId: candidates[0].id,
    selectionRationale: "Auto-selection is quality-first, then maximizes minimum distance from the local archive and Verve house style.",
  });
  const diversity = assessDirectionPortfolio(portfolio, input.recentDirectionFingerprints ?? []);
  portfolio.selectedDirectionId = diversity.recommendedDirectionId;
  return {
    schemaVersion: 1,
    engineVersion: "creative-engine-v3",
    inputHash: fingerprintDirectionRequest({ brief: input.analysis.rawBrief, framework: input.framework, mode: input.mode, brandContext: input.brandContext }),
    requestedMode: input.mode,
    effectiveMode,
    portfolio,
    diversity: assessDirectionPortfolio(portfolio, input.recentDirectionFingerprints ?? []),
    referencePatternIds: [references.near.id, ...references.far.map((entry) => entry.id)],
    createdAt: new Date().toISOString(),
  };
}

export function createDirectionCheckpoint(board: DirectionBoard): DirectionCheckpoint {
  return { schemaVersion: 1, inputHash: board.inputHash, board };
}

export function directionCheckpointMatches(
  checkpoint: DirectionCheckpoint | undefined,
  input: { brief: string; framework: string; mode: GenerationMode; brandContext?: string }
): checkpoint is DirectionCheckpoint {
  return Boolean(checkpoint && checkpoint.schemaVersion === 1 && checkpoint.inputHash === fingerprintDirectionRequest(input));
}

export function buildPlanFromDirectionBoard(analysis: BriefAnalysis, board: DirectionBoard, selectedDirectionId?: string): DesignPlan {
  const portfolio: DirectionPortfolio = {
    ...board.portfolio,
    selectedDirectionId: selectedDirectionId && board.portfolio.candidates.some((candidate) => candidate.id === selectedDirectionId)
      ? selectedDirectionId
      : board.portfolio.selectedDirectionId,
    selectionRationale: selectedDirectionId ? "Selected by the user from the Direction Board." : board.portfolio.selectionRationale,
  };
  const selected = portfolio.candidates.find((candidate) => candidate.id === portfolio.selectedDirectionId) ?? portfolio.candidates[0];
  const base: DesignPlan = {
    colorPalette: selected.identity.palette.map((color) => ({ ...color })),
    typePairing: { display: selected.identity.displayTypeface, body: selected.identity.bodyTypeface, rationale: selected.descriptors.typographyVoice },
    layoutConcept: selected.dimensions.topology,
    signatureElement: { name: selected.concept, description: selected.distinction, implementation: selected.dimensions.signatureMechanism, justification: selected.justification },
    referencesSampled: [...board.referencePatternIds],
    cognitiveGrounding: {
      vonRestorffCompliance: `Isolate the task-derived mechanism: ${selected.dimensions.signatureMechanism}`,
      gutenbergCompliance: `${selected.descriptors.openingMode} establishes the primary area and ${selected.descriptors.navigationModel} resolves it.`,
      signalNoiseRatio: 0.72,
      peakEndDesign: `End when the audience truthfully completes: ${analysis.primaryJob}.`,
      usabilityBaseline: "AA contrast, 44px targets, visible focus, semantic controls, and reduced-motion behavior.",
    },
    rawPlan: `Creative Engine v3 plan derived from direction board ${board.inputHash}.`,
    directionPortfolio: portfolio,
  };
  return applySelectedDirection(base, portfolio.selectedDirectionId, portfolio.selectionRationale);
}
