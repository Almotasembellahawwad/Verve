import type { RenderedEvaluationEvidence } from "../engine/evaluation-coherence";
import type { RenderEvidenceMatrix } from "../project/render-gate";
import type { DirectionRealizationReport } from "../project/visual-truth";

export function summarizeRenderAudit(
  render: RenderEvidenceMatrix,
  direction: DirectionRealizationReport | null,
  visualArchiveDistance: number | null
): RenderedEvaluationEvidence {
  return {
    version: 1,
    capturedAt: Date.now(),
    status: render.status,
    covered: render.covered,
    complete: render.complete,
    score: render.score,
    failures: render.failures,
    warnings: render.warnings,
    firstViewportScore: render.firstViewportScore,
    functionalVisualScore: render.functionalVisualScore,
    renderedEvidenceScore: render.renderedEvidenceScore,
    renderedCompositionScore: render.renderedCompositionScore,
    directionFidelity: direction?.fidelity ?? null,
    directionStatus: direction?.status ?? null,
    visualArchiveDistance,
    privacy: "numeric-and-hashed-render-summary-only",
  };
}
