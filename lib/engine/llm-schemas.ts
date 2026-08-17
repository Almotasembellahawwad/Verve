// =========================================================
// lib/engine/llm-schemas.ts
// Zod schemas for validating LLM JSON outputs (Phase 2.2)
//
// PURPOSE: All engine modules that parse LLM JSON must use these
// schemas instead of raw JSON.parse + manual checks.
// Validation errors trigger one automatic retry with feedback.
// =========================================================

import { z } from "zod";

// ── Brief Analysis ────────────────────────────────────────────────────────────
export const BriefAnalysisSchema = z.object({
  subject:              z.string().min(1),
  industry:             z.string().min(1),
  tone:                 z.string().min(1),
  targetAudience:       z.string().min(1),
  primaryGoal:          z.string().min(1),
  keyDifferentiators:   z.array(z.string()).min(1),
  emotionalTone:        z.string().min(1),
  colorDirection:       z.string().optional().default(""),
  avoidElements:        z.array(z.string()).default([]),
  existingBrandStrength: z.enum(["none", "weak", "moderate", "strong"]).optional().default("none"),
});
export type BriefAnalysisOutput = z.infer<typeof BriefAnalysisSchema>;

// ── Brand Archetype ───────────────────────────────────────────────────────────
const ArchetypeIdEnum = z.enum([
  "innocent", "sage", "explorer", "outlaw", "magician", "hero",
  "lover", "jester", "everyman", "caregiver", "ruler", "creator",
]);

export const ArchetypeResolutionSchema = z.object({
  primaryArchetype:   ArchetypeIdEnum,
  secondaryArchetype: ArchetypeIdEnum.optional().nullable(),
  confidence:         z.number().min(0).max(1),
  reasoning:          z.string().min(10),
  emotionalJob:       z.string().min(1),
  archetypeConflict:  z.string().optional().default(""),
  designConstraints:  z.record(z.string(), z.string()).optional().default({}),
});
export type ArchetypeResolutionOutput = z.infer<typeof ArchetypeResolutionSchema>;

// ── Design Plan ───────────────────────────────────────────────────────────────
const ColorPaletteSchema = z.object({
  primary:    z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondary:  z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent:     z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  text:       z.string().regex(/^#[0-9A-Fa-f]{6}$/),
}).passthrough();

export const DesignPlanSchema = z.object({
  signatureElement:   z.string().min(10),
  palette:            ColorPaletteSchema,
  typography:         z.object({
    heading: z.string().min(1),
    body:    z.string().min(1),
  }).passthrough(),
  sections:           z.array(z.object({
    id:      z.string().min(1),
    name:    z.string().min(1),
    purpose: z.string().min(1),
  })).min(3),
  cognitiveStrategy:  z.string().optional().default(""),
  motionLanguage:     z.string().optional().default(""),
}).passthrough();
export type DesignPlanOutput = z.infer<typeof DesignPlanSchema>;

// ── Critique Result ───────────────────────────────────────────────────────────
export const CritiqueResultSchema = z.object({
  passed:            z.boolean(),
  overallVerdict:    z.string().min(1),
  flaggedElements:   z.array(z.string()),
  positiveElements:  z.array(z.string()),
  rawCritique:       z.string().optional().default(""),
  endingCheck:       z.object({
    hasCallToAction:    z.boolean(),
    verdict:            z.string(),
  }).optional(),
  usabilityFloor:    z.object({
    passed:  z.boolean(),
    issues:  z.array(z.string()),
  }).optional(),
  cognitiveScore:    z.number().min(0).max(100).optional(),
  cognitiveFailures: z.array(z.string()).optional().default([]),
}).passthrough();
export type CritiqueResultOutput = z.infer<typeof CritiqueResultSchema>;

// ── Distinctiveness Report ────────────────────────────────────────────────────
export const DistinctivenessReportSchema = z.object({
  score:            z.number().min(0).max(100),
  grade:            z.enum(["S", "A", "B", "C", "D"]),
  critiqueSummary:  z.string(),
  clichesDetected:  z.array(z.string()),
  clichesAvoided:   z.array(z.string()),
  signatureElement: z.string(),
  recommendations:  z.array(z.string()),
}).passthrough();
export type DistinctivenessReportOutput = z.infer<typeof DistinctivenessReportSchema>;

// ── Validation helper ─────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; raw: unknown };

/**
 * Validates parsed JSON against a Zod schema.
 * Returns success+data or failure+error message for retry feedback.
 */
export function validateLLMOutput<T>(
  schema: z.ZodType<T>,
  parsed: unknown,
  moduleName: string
): { success: true; data: T } | { success: false; error: string; raw: unknown } {
  const result = schema.safeParse(parsed);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues
    .slice(0, 5) // Keep feedback concise for retry prompt
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");

  console.warn(`[${moduleName}] LLM output schema validation failed:\n${issues}`);
  return {
    success: false,
    error:   `Schema validation failed:\n${issues}`,
    raw:     parsed,
  };
}
