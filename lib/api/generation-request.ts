import { z } from "zod";
import { PipelineCheckpointSchema } from "@/lib/engine/pipeline-checkpoint";
import { DEFAULT_GENERATION_MODE, GENERATION_MODES } from "@/lib/domain/generation-mode";

const OwnedAssetSchema = z.object({
  path: z.string().regex(/^(?:public\/)?assets\/[a-z0-9][a-z0-9_-]{0,47}\.(?:jpg|png|webp|svg)$/),
  url: z.string().regex(/^(?:\.\/|\/)assets\/[a-z0-9][a-z0-9_-]{0,47}\.(?:jpg|png|webp|svg)$/),
  kind: z.enum(["logo", "image"]),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]),
  alt: z.string().min(1).max(180),
});

const BrandProfileSchema = z.object({
  name: z.string().max(120).optional(),
  colors: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).max(8).default([]),
  notes: z.string().max(1200).optional(),
});

const DirectionFingerprintSchema = z.object({
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
  checkpoint: PipelineCheckpointSchema.optional(),
});

export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
