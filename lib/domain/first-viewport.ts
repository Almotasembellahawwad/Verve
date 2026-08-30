export const FIRST_VIEWPORT_POLICY_VERSION = 1 as const;

export type FirstViewportEvidence = {
  taskSignalCount: number;
  taskCoverage: number;
  informationSalience: number;
  primaryActionVisible: boolean;
  actionClarity: number;
  scrollCost: number;
  score: number;
};

export const FIRST_VIEWPORT_THRESHOLDS = {
  minimumTaskSignals: 2,
  reviewScore: 0.55,
  taskCoverageWeight: 0.45,
  informationSalienceWeight: 0.25,
  actionClarityWeight: 0.3,
  scrollCostWeight: 0.5,
} as const;

function unit(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * First Viewport Effectiveness (FVE).
 *
 * Scale is deliberately absent. A large visual opening can score fully when
 * it carries task information and a clear action; a compact but empty opening
 * cannot pass merely because it is small.
 */
export function calculateFirstViewportEffectiveness(input: Omit<FirstViewportEvidence, "score">): number {
  const weightedUtility = unit(input.taskCoverage) * FIRST_VIEWPORT_THRESHOLDS.taskCoverageWeight
    + unit(input.informationSalience) * FIRST_VIEWPORT_THRESHOLDS.informationSalienceWeight
    + unit(input.actionClarity) * FIRST_VIEWPORT_THRESHOLDS.actionClarityWeight;
  const navigationCost = 1 + unit(input.scrollCost) * FIRST_VIEWPORT_THRESHOLDS.scrollCostWeight;
  return Number(unit(weightedUtility / navigationCost).toFixed(3));
}

export function firstViewportNeedsReview(evidence: FirstViewportEvidence): boolean {
  return evidence.taskSignalCount < FIRST_VIEWPORT_THRESHOLDS.minimumTaskSignals
    || !evidence.primaryActionVisible
    || evidence.score < FIRST_VIEWPORT_THRESHOLDS.reviewScore;
}
