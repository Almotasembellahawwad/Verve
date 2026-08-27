import { z } from "zod";
import type { BriefAnalysis } from "./brief-analyzer";
import type { DesignPlan } from "./plan-generator";

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
    && checkpoint.mode === "fast"
    && input.mode === "fast"
    && checkpoint.inputFingerprint === fingerprintPipelineInput(input)
  );
}

export function isPipelineCheckpoint(value: unknown): value is PipelineCheckpoint {
  return PipelineCheckpointSchema.safeParse(value).success;
}
