import type { RenderedEvaluationEvidence } from "../engine/evaluation-coherence";
import type { RenderEvidenceMatrix } from "../project/render-gate";
import type { DirectionRealizationReport } from "../project/visual-truth";
import type { VisualTruthMatrix } from "../project/visual-truth";
import { RENDER_RECEIPT_PROBE_VERSION, type ProjectRevision, type RenderReceiptBinding } from "../domain/render-receipt";

export function summarizeRenderAudit(
  render: RenderEvidenceMatrix,
  direction: DirectionRealizationReport | null,
  visualArchiveDistance: number | null,
  revision?: ProjectRevision | null,
  truth?: VisualTruthMatrix
): RenderedEvaluationEvidence {
  const reports = Object.values(truth?.reports ?? render.reports).filter((report) => Boolean(report));
  const surfaces = reports.flatMap((report) => {
    const width = ([360, 768, 1440] as const).find((value) => Math.abs(value - report.viewport.width) <= 2);
    return width && report.surface ? [{ width, routeKey: report.surface.routeKey, stateKey: report.surface.stateKey }] : [];
  });
  const testedSurfaces = [...new Map(surfaces.map((surface) => [`${surface.width}:${surface.routeKey}:${surface.stateKey}`, surface])).values()]
    .sort((left, right) => left.width - right.width || left.routeKey.localeCompare(right.routeKey) || left.stateKey.localeCompare(right.stateKey));
  const binding: RenderReceiptBinding | undefined = revision && reports.every((report) => report.probeVersion === RENDER_RECEIPT_PROBE_VERSION && report.surface)
    ? { version: 1, revision, probeVersion: RENDER_RECEIPT_PROBE_VERSION, testedSurfaces } : undefined;
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
    ...(binding ? { binding } : {}),
    privacy: "numeric-and-hashed-render-summary-only",
  };
}
