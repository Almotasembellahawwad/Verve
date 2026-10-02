import { z } from "zod";
import type { BriefAnalysis } from "./brief-analyzer";
import type { DesignPlan } from "./plan-generator";
import { CREATIVITY_CLASSES, EXPERIENCE_MODELS, NAVIGATION_MODELS, OPENING_MODES } from "../domain/design-direction";
import { applySelectedDirection } from "./direction-portfolio";

const LimitedString = z.string().max(12_000);

const BriefAnalysisCheckpointSchema = z.object({
  subject: z.string().min(1).max(500),
  audience: z.string().min(1).max(500),
  primaryJob: z.string().min(1).max(500),
  tone: z.string().min(1).max(500),
  industry: z.string().min(1).max(200),
  constraints: z.array(z.string().max(500)).max(30),
  rawBrief: z.string().min(1).max(5000),
});

const DirectionCandidateCheckpointSchema = z.object({
  id: z.string().min(2).max(80),
  concept: z.string().min(10).max(500),
  justification: z.string().min(10).max(1200),
  distinction: z.string().min(10).max(800),
  briefFit: z.number().min(0).max(100),
  feasibility: z.number().min(0).max(100),
  descriptors: z.object({
    creativityClass: z.enum(CREATIVITY_CLASSES), experienceModel: z.enum(EXPERIENCE_MODELS),
    openingMode: z.enum(OPENING_MODES), navigationModel: z.enum(NAVIGATION_MODELS),
    density: z.enum(["airy", "balanced", "dense"]), spatialSystem: z.string().min(2).max(400),
    mediaRole: z.enum(["none", "supporting", "evidence", "primary", "interactive"]),
    motionRole: z.enum(["none", "feedback", "narrative", "spatial", "data"]),
    typographyVoice: z.string().min(2).max(300), colorStrategy: z.string().min(2).max(300),
  }),
  identity: z.object({
    palette: z.array(z.object({
      name: z.string().min(1).max(80), hex: z.string().regex(/^#[0-9a-f]{6}$/i), role: z.string().min(1).max(160),
    })).min(3).max(6),
    displayTypeface: z.string().min(2).max(180), bodyTypeface: z.string().min(2).max(180),
  }),
  quality: z.object({
    briefCoverage: z.number().min(0).max(100), factualSafety: z.number().min(0).max(100),
    responsiveFeasibility: z.number().min(0).max(100), interactionTruth: z.number().min(0).max(100),
    mediaFeasibility: z.number().min(0).max(100), passed: z.boolean(),
  }),
  dimensions: z.object({
    topology: z.string().min(3).max(700), hierarchy: z.string().min(3).max(700),
    spatialRhythm: z.string().min(3).max(700), typographyRole: z.string().min(3).max(700),
    mediaStrategy: z.string().min(3).max(700), interactionMetaphor: z.string().min(3).max(700),
    signatureMechanism: z.string().min(3).max(700),
  }),
});

const DirectionPortfolioCheckpointSchema = z.object({
  source: z.enum(["provider", "provider-creative", "local-fallback"]),
  candidates: z.array(DirectionCandidateCheckpointSchema).length(6),
  selectedDirectionId: z.string().min(2).max(80),
  selectionRationale: z.string().min(1).max(1200),
}).superRefine((portfolio, context) => {
  if (new Set(portfolio.candidates.map((candidate) => candidate.id)).size !== portfolio.candidates.length) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "Checkpoint direction IDs must be unique." });
  }
  if (!portfolio.candidates.some((candidate) => candidate.id === portfolio.selectedDirectionId)) {
    context.addIssue({ code: "custom", path: ["selectedDirectionId"], message: "Checkpoint selection must reference a candidate." });
  }
});

const DesignPlanCheckpointSchema = z.object({
  colorPalette: z.array(z.object({
    name: z.string().min(1).max(100),
    hex: z.string().regex(/^#[0-9a-f]{6}$/i),
    role: z.string().min(1).max(500),
  })).min(3).max(8),
  typePairing: z.object({
    display: z.string().min(1).max(500),
    body: z.string().min(1).max(500),
    rationale: z.string().min(1).max(2000),
  }),
  layoutConcept: LimitedString,
  signatureElement: z.object({
    name: z.string().min(1).max(300),
    description: z.string().min(1).max(3000),
    implementation: z.string().min(1).max(5000),
    justification: z.string().min(1).max(3000),
  }),
  referencesSampled: z.array(z.string().max(500)).max(20),
  cognitiveGrounding: z.object({
    vonRestorffCompliance: z.string().max(3000),
    gutenbergCompliance: z.string().max(3000),
    signalNoiseRatio: z.number().min(0).max(1),
    peakEndDesign: z.string().max(3000),
    usabilityBaseline: z.string().max(3000),
  }),
  rawPlan: z.string().max(25_000),
  // Optional for old v1 receipts. New receipts preserve the whole selected
  // direction, not only its prose layout, so resume cannot silently pick a
  // different palette, mechanism, or experience from a fresh local portfolio.
  directionPortfolio: DirectionPortfolioCheckpointSchema.optional(),
});

export const PipelineCheckpointSchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.literal("fast"),
  completedStage: z.enum(["01", "04"]),
  inputFingerprint: z.string().regex(/^[0-9a-f]{8}$/),
  briefAnalysis: BriefAnalysisCheckpointSchema,
  designPlan: DesignPlanCheckpointSchema.optional(),
  createdAt: z.number().int().positive(),
}).superRefine((checkpoint, context) => {
  if (checkpoint.completedStage === "04" && !checkpoint.designPlan) {
    context.addIssue({
      code: "custom",
      path: ["designPlan"],
      message: "Stage 04 checkpoints require a design plan.",
    });
  }
});

export type PipelineCheckpoint = z.infer<typeof PipelineCheckpointSchema>;

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function fingerprintPipelineInput(input: {
  brief: string;
  existingCode?: string;
  framework: string;
  mode: string;
  brandContext?: string;
}): string {
  return fnv1a([input.mode, input.framework, input.brief.trim(), input.existingCode?.trim() ?? "", input.brandContext ?? ""].join("\u001f"));
}

export function createPipelineCheckpoint(
  input: { brief: string; existingCode?: string; framework: string; mode: "fast"; brandContext?: string },
  completedStage: "01" | "04",
  briefAnalysis: BriefAnalysis,
  designPlan?: DesignPlan
): PipelineCheckpoint {
  return PipelineCheckpointSchema.parse({
    schemaVersion: 1,
    mode: "fast",
    completedStage,
    inputFingerprint: fingerprintPipelineInput(input),
    briefAnalysis,
    designPlan,
    createdAt: Date.now(),
  });
}

export function checkpointMatchesInput(
  checkpoint: PipelineCheckpoint | undefined,
  input: { brief: string; existingCode?: string; framework: string; mode: string; brandContext?: string }
): checkpoint is PipelineCheckpoint {
  return Boolean(
    checkpoint
    && PipelineCheckpointSchema.safeParse(checkpoint).success
    && checkpoint.mode === "fast"
    && input.mode === "fast"
    && checkpoint.inputFingerprint === fingerprintPipelineInput(input)
  );
}

/** Resume an identity atomically; a new user selection must not inherit old styling. */
export function resolveResumedDesignPlan(
  savedPlan: DesignPlan | undefined,
  selectedDirectionId?: string,
  boardPlan?: DesignPlan
): DesignPlan | undefined {
  if (!savedPlan) return undefined;
  if (!selectedDirectionId || savedPlan.directionPortfolio?.selectedDirectionId === selectedDirectionId) return savedPlan;
  if (boardPlan?.directionPortfolio?.selectedDirectionId === selectedDirectionId) return boardPlan;
  if (!savedPlan.directionPortfolio?.candidates.some((candidate) => candidate.id === selectedDirectionId)) return undefined;
  return applySelectedDirection(savedPlan, selectedDirectionId, "User selected a different complete direction before resuming generation.");
}

export function isPipelineCheckpoint(value: unknown): value is PipelineCheckpoint {
  return PipelineCheckpointSchema.safeParse(value).success;
}
