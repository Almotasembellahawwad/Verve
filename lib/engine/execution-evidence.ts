import type { Provider } from "../llm-adapter/types";

export type EffectiveGenerationMode = "fast" | "creative" | "creative-degraded";
export type CritiqueEvidenceSource = "provider" | "local-preflight" | "local-fallback";
export type ScoreConfidence = "structural" | "adversarial";

export type PipelineDegradation = {
  stageId: string;
  reason: "timeout" | "provider-unavailable" | "unknown";
  message: string;
};

/**
 * Provenance for a generation result. This is deliberately separate from the
 * score: a high score without its evidence source is not a trustworthy result.
 */
export type ExecutionEvidence = {
  requestedMode: "fast" | "creative" | "studio";
  effectiveMode: EffectiveGenerationMode;
  provider: Provider;
  requestedModel: string;
  resolvedModel: string;
  critiqueSource: CritiqueEvidenceSource;
  scoreConfidence: ScoreConfidence;
  degraded: boolean;
  degradations: PipelineDegradation[];
};

export function buildExecutionEvidence(input: {
  requestedMode: "fast" | "creative" | "studio";
  provider: Provider;
  requestedModel: string;
  resolvedModel: string;
  critiqueSource: CritiqueEvidenceSource;
  degradations: PipelineDegradation[];
}): ExecutionEvidence {
  const degraded = input.degradations.length > 0;
  return {
    ...input,
    effectiveMode: input.requestedMode === "fast"
      ? "fast"
      : degraded || input.critiqueSource === "local-fallback"
        ? "creative-degraded"
        : "creative",
    scoreConfidence: input.critiqueSource === "provider" ? "adversarial" : "structural",
    degraded,
  };
}
