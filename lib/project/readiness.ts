import type { ProjectReadiness, ProjectReadinessAxis, ProjectValidation } from "./types";

function axis(
  status: ProjectReadinessAxis["status"],
  score: number,
  blockers: string[],
  warnings: string[]
): ProjectReadinessAxis {
  return { status, score: Math.max(0, Math.min(100, score)), blockers, warnings };
}

function statusFor(blockers: string[], warnings: string[]): ProjectReadinessAxis["status"] {
  return blockers.length > 0 ? "blocked" : warnings.length > 0 ? "review-required" : "ready";
}

/**
 * Policy object for the public readiness contract. Technical correctness,
 * content completeness, and launch safety intentionally cannot mask each other.
 */
export function evaluateProjectReadiness(
  validation: ProjectValidation,
  projectWarnings: string[]
): ProjectReadiness {
  const technicalBlockers = validation.checks
    .filter((item) => item.status === "fail")
    .map((item) => item.message);
  const technicalWarnings = validation.checks
    .filter((item) => item.status === "warning" && item.id !== "content-truth")
    .map((item) => item.message);
  const technical = axis(
    statusFor(technicalBlockers, technicalWarnings),
    validation.score,
    technicalBlockers,
    technicalWarnings
  );

  const contentCheck = validation.checks.find((item) => item.id === "content-truth");
  const contentWarnings = [
    ...(contentCheck?.status === "warning" ? [contentCheck.message] : []),
    ...projectWarnings.filter((warning) => /content|claim|placeholder|verified value|material pending/i.test(warning)),
  ];
  const contentBlockers = projectWarnings
    .filter((warning) => warning.startsWith("BLOCKING:") && /content|claim|verified value|material pending/i.test(warning));
  const contentScore = 100 - contentBlockers.length * 35 - contentWarnings.length * 12;
  const content = axis(statusFor(contentBlockers, contentWarnings), contentScore, contentBlockers, contentWarnings);

  const launchBlockers = [
    ...projectWarnings.filter((warning) => warning.startsWith("BLOCKING:")),
    ...(technical.status === "blocked" ? technical.blockers : []),
    ...(content.status === "blocked" ? content.blockers : []),
  ];
  const launchWarnings = [
    ...projectWarnings.filter((warning) => !warning.startsWith("BLOCKING:")),
    ...(technical.status === "review-required" ? technical.warnings : []),
    ...(content.status === "review-required" ? content.warnings : []),
  ];
  const launchRiskScore = 100 - launchBlockers.length * 35 - launchWarnings.length * 10;
  const launch = axis(
    statusFor(launchBlockers, launchWarnings),
    Math.min(technical.score, content.score, launchRiskScore),
    [...new Set(launchBlockers)],
    [...new Set(launchWarnings)]
  );

  return {
    status: launch.status,
    score: launch.score,
    axes: { technical, content, launch },
  };
}
