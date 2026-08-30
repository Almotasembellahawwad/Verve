import { z } from "zod";
import { PipelineCheckpointSchema } from "@/lib/engine/pipeline-checkpoint";
import { DEFAULT_GENERATION_MODE, GENERATION_MODES } from "@/lib/domain/generation-mode";
import { CREATIVITY_CLASSES, EXPERIENCE_MODELS, NAVIGATION_MODELS, OPENING_MODES } from "@/lib/domain/design-direction";

const OwnedAssetSchema = z.object({
  path: z.string().regex(/^(?:public\/)?assets\/[a-z0-9][a-z0-9_-]{0,47}\.(?:jpg|png|webp|svg)$/),
  url: z.string().regex(/^(?:\.\/|\/)assets\/[a-z0-9][a-z0-9_-]{0,47}\.(?:jpg|png|webp|svg)$/),
  kind: z.enum(["logo", "image"]),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]),
  alt: z.string().min(1).max(180),
});

export const BrandProfileSchema = z.object({
  name: z.string().max(120).optional(),
  colors: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(8).default([]),
  notes: z.string().max(1200).optional(),
});

export const DirectionFingerprintSchema = z.object({
  directionId: z.string().min(1).max(80),
  topology: z.string().min(1).max(700),
  hierarchy: z.string().min(1).max(700),
  spatialRhythm: z.string().min(1).max(700),
  typographyRole: z.string().min(1).max(700),
  mediaStrategy: z.string().min(1).max(700),
  interactionMetaphor: z.string().min(1).max(700),
  signatureMechanism: z.string().min(1).max(700),
  structure: z.object({
    topologyFamily: z.enum(["editorial-register", "workbench", "dashboard", "timeline", "comparison", "spatial-canvas", "catalog", "form-led", "narrative", "unknown"]),
    openingMode: z.enum(["viewport-hero", "split-opening", "compact-task", "unknown"]),
    sectionRhythm: z.enum(["viewport-stages", "numbered-rows", "panel-grid", "mixed", "unknown"]),
    traits: z.array(z.string().min(1).max(80)).max(20),
  }).optional(),
  descriptors: z.object({
    creativityClass: z.enum(CREATIVITY_CLASSES),
    experienceModel: z.enum(EXPERIENCE_MODELS),
    openingMode: z.enum(OPENING_MODES),
    navigationModel: z.enum(NAVIGATION_MODELS),
    density: z.enum(["airy", "balanced", "dense"]),
    spatialSystem: z.string().max(400),
    mediaRole: z.enum(["none", "supporting", "evidence", "primary", "interactive"]),
    motionRole: z.enum(["none", "feedback", "narrative", "spatial", "data"]),
    typographyVoice: z.string().max(300),
    colorStrategy: z.string().max(300),
  }).optional(),
});

const DirectionCandidateInputSchema = z.object({
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
    palette: z.array(z.object({ name: z.string().min(1).max(80), hex: z.string().regex(/^#[0-9a-f]{6}$/i), role: z.string().min(1).max(160) })).min(3).max(6),
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

export const DirectionCheckpointSchema = z.object({
  schemaVersion: z.literal(1),
  inputHash: z.string().regex(/^[0-9a-f]{8}$/),
  board: z.object({
    schemaVersion: z.literal(1), engineVersion: z.literal("creative-engine-v3"), inputHash: z.string().regex(/^[0-9a-f]{8}$/),
    requestedMode: z.enum(GENERATION_MODES), effectiveMode: z.enum(["fast", "creative"]),
    portfolio: z.object({
      source: z.enum(["provider", "provider-creative", "local-fallback"]),
      candidates: z.array(DirectionCandidateInputSchema).length(6),
      selectedDirectionId: z.string().min(2).max(80), selectionRationale: z.string().min(1).max(1200),
    }),
    diversity: z.object({
      passed: z.boolean(), diversityScore: z.number().min(0).max(100), medianPairDistance: z.number().min(0).max(1),
      minimumPairDistance: z.number().min(0).max(1), distinctStructureCount: z.number().int().min(0).max(6),
      historicalNoveltyScore: z.number().min(0).max(100).nullable(), recommendedDirectionId: z.string().min(2).max(80),
      warnings: z.array(z.string().max(500)).max(20),
    }),
    referencePatternIds: z.array(z.string().min(1).max(120)).min(3).max(4),
    createdAt: z.string().datetime(),
  }),
}).superRefine((checkpoint, context) => {
  if (checkpoint.inputHash !== checkpoint.board.inputHash) context.addIssue({ code: "custom", path: ["inputHash"], message: "Direction checkpoint hash mismatch." });
});

export const DirectionRequestSchema = z.object({
  brief: z.string().min(10).max(5000),
  framework: z.enum(["nextjs", "react", "html"]).optional().default("nextjs"),
  apiKey: z.string().min(1).max(500),
  provider: z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model: z.string().max(100).optional(),
  brandProfile: BrandProfileSchema.optional(),
  mode: z.enum(GENERATION_MODES).optional().default(DEFAULT_GENERATION_MODE),
  recentDirectionFingerprints: z.array(DirectionFingerprintSchema).max(24).optional().default([]),
});

/** Shared by JSON and SSE so both delivery paths accept the exact same contract. */
export const GenerationRequestSchema = z.object({
  brief: z.string().min(10).max(5000),
  existingCode: z.string().max(20000).optional(),
  framework: z.enum(["nextjs", "react", "html"]).optional().default("nextjs"),
  apiKey: z.string().min(1).max(500),
  provider: z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model: z.string().max(100).optional(),
  pexelsKey: z.string().max(500).optional(),
  brandProfile: BrandProfileSchema.optional(),
  ownedAssets: z.array(OwnedAssetSchema).max(4).optional().default([]),
  mode: z.enum(GENERATION_MODES).optional().default(DEFAULT_GENERATION_MODE),
  recentDirectionFingerprints: z.array(DirectionFingerprintSchema).max(12).optional().default([]),
  selectedDirectionId: z.string().min(2).max(80).optional(),
  directionCheckpoint: DirectionCheckpointSchema.optional(),
  checkpoint: PipelineCheckpointSchema.optional(),
}).superRefine((request, context) => {
  if (request.selectedDirectionId && request.directionCheckpoint
    && !request.directionCheckpoint.board.portfolio.candidates.some((candidate) => candidate.id === request.selectedDirectionId)) {
    context.addIssue({ code: "custom", path: ["selectedDirectionId"], message: "Selected direction is not present in the supplied Direction Board." });
  }
});

export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
