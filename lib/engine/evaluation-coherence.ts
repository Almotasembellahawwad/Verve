import type { DirectionDiversityAssessment } from "../domain/design-direction";
import type { GeneratedProject } from "../project/types";
import type { AssetDeliveryReceipt } from "./asset-delivery";
import type { AssetUsageEvidence } from "./asset-usage";
import type { CritiqueResult } from "./critique-loop";
import type { DesignDiversityResult } from "./design-diversity";
import type { ExecutionEvidence } from "./execution-evidence";
import type { QualityReport } from "./quality-report";
import type { RestraintResult } from "./restraint-check";
import type { DistinctivenessReport } from "./scorer";
import type { VisualIntentSourceEvidence } from "./visual-intent";
import type { TypographyDeliveryReceipt } from "../domain/typography";

export type EvaluationAuthority = "release-gate" | "delivered-source" | "plan-diagnostic" | "provenance" | "render-evidence";
export type EvaluationSignalStatus = "pass" | "review" | "fail" | "unavailable";

export type EvaluationSignal = {
  id: string;
  label: string;
  authority: EvaluationAuthority;
  stage: "plan" | "source" | "render" | "release";
  status: EvaluationSignalStatus;
  score: number | null;
  summary: string;
};

export type EvaluationFinding = {
  id: string;
  severity: "blocking" | "warning" | "explanation";
  signalIds: string[];
  message: string;
};

export type EvaluationCoherenceReport = {
  version: 1;
  status: "coherent" | "review" | "incoherent";
  releaseDecision: GeneratedProject["readiness"]["status"];
  creativeClaim: "eligible" | "provisional" | "withheld";
  signals: EvaluationSignal[];
  findings: EvaluationFinding[];
  policy: string[];
};

export type RenderedEvaluationEvidence = {
  version: 1;
  capturedAt: number;
  status: "waiting" | "collecting" | "pass" | "review" | "fail";
  covered: number;
  complete: boolean;
  score: number;
  failures: number;
  warnings: number;
  firstViewportScore: number | null;
  functionalVisualScore: number | null;
  renderedEvidenceScore: number | null;
  renderedCompositionScore: number | null;
  directionFidelity: number | null;
  directionStatus: "pass" | "review" | "fail" | null;
  visualArchiveDistance: number | null;
  privacy: "numeric-and-hashed-render-summary-only";
};

function releaseStatus(status: GeneratedProject["readiness"]["status"]): EvaluationSignalStatus {
  return status === "ready" ? "pass" : status === "blocked" ? "fail" : "review";
}

function qualityStatus(status: QualityReport["status"]): EvaluationSignalStatus {
  return status === "ready" ? "pass" : status === "blocked" ? "fail" : "review";
}

function deliveryStatus(status: AssetDeliveryReceipt["status"]): EvaluationSignalStatus {
  if (status === "complete" || status === "not-required") return "pass";
  return status === "failed" ? "fail" : "review";
}

/**
 * Reconciles unlike signals without averaging them into a misleading score.
 * Release gates have veto power; plan diagnostics remain hypotheses until the
 * delivered source and browser render supply evidence.
 */
export function buildEvaluationCoherence(input: {
  project: GeneratedProject;
  qualityReport: QualityReport;
  assetUsage: AssetUsageEvidence;
  assetDelivery: AssetDeliveryReceipt;
  typographyDelivery: TypographyDeliveryReceipt;
  visualIntentSource: VisualIntentSourceEvidence;
  directionDiversity: DirectionDiversityAssessment;
  diversityResult: DesignDiversityResult;
  execution: ExecutionEvidence;
  critique: CritiqueResult;
  restraint: RestraintResult;
  distinctiveness: DistinctivenessReport;
}): EvaluationCoherenceReport {
  const blockingMedia = input.assetUsage.warnings.some((warning) => warning.startsWith("BLOCKING:"));
  const mediaStatus: EvaluationSignalStatus = blockingMedia
    ? "fail"
    : input.assetUsage.warnings.length > 0
      ? "review"
      : "pass";
  const signals: EvaluationSignal[] = [
    {
      id: "release-readiness",
      label: "Project readiness",
      authority: "release-gate",
      stage: "release",
      status: releaseStatus(input.project.readiness.status),
      score: input.project.readiness.score,
      summary: "Authoritative launch decision compiled from technical, content, and launch blockers.",
    },
    {
      id: "quality-report",
      label: "Quality report",
      authority: "release-gate",
      stage: "release",
      status: qualityStatus(input.qualityReport.status),
      score: null,
      summary: "Axis report over delivered content, functionality, responsiveness, accessibility, and assets.",
    },
    {
      id: "typography-delivery",
      label: "Typography delivery",
      authority: "delivered-source",
      stage: "source",
      status: input.typographyDelivery.status === "ready" ? "pass" : "fail",
      score: null,
      summary: `${input.typographyDelivery.files.length} licensed font binary file(s) delivered.`,
    },
    {
      id: "asset-binary-delivery",
      label: "Asset binary delivery",
      authority: "delivered-source",
      stage: "source",
      status: deliveryStatus(input.assetDelivery.status),
      score: null,
      summary: `${input.assetDelivery.bundled}/${input.assetDelivery.requested} referenced external asset(s) bundled.`,
    },
    {
      id: "media-usage",
      label: "Media usage",
      authority: "release-gate",
      stage: "source",
      status: mediaStatus,
      score: null,
      summary: `${input.assetUsage.used}/${input.assetUsage.required} brief-required asset(s) occur in source; ${input.assetUsage.tracedScenePlacements}/${input.assetUsage.plannedScenePlacements} planned placements are traced.`,
    },
    {
      id: "visual-intent-source",
      label: "Functional visual intent",
      authority: "delivered-source",
      stage: "source",
      status: input.visualIntentSource.status,
      score: input.visualIntentSource.score,
      summary: "Harmonic coverage of declared scenes, composition, functional layers, purposes, and assigned assets.",
    },
    {
      id: "direction-diversity",
      label: "Direction-board diversity",
      authority: "plan-diagnostic",
      stage: "plan",
      status: input.directionDiversity.passed ? "pass" : "fail",
      score: input.directionDiversity.diversityScore,
      summary: "Distance within the candidate board and from recent direction fingerprints.",
    },
    {
      id: "template-diversity",
      label: "Delivered template diversity",
      authority: "delivered-source",
      stage: "source",
      status: input.diversityResult.passed ? "pass" : "fail",
      score: input.diversityResult.scoreCap,
      summary: "Detects configured recurring Verve structural recipes in delivered code.",
    },
    {
      id: "critique-provenance",
      label: "Adversarial critique",
      authority: "provenance",
      stage: "plan",
      status: input.execution.effectiveMode === "creative-degraded" ? "review" : input.critique.passed ? "pass" : "fail",
      score: null,
      summary: `${input.execution.critiqueSource} evidence; confidence is ${input.execution.scoreConfidence}.`,
    },
    {
      id: "norman-behavioral",
      label: "Norman behavioral reading",
      authority: "plan-diagnostic",
      stage: "plan",
      status: input.distinctiveness.normanLevels.behavioral.score >= 70 ? "pass" : "review",
      score: input.distinctiveness.normanLevels.behavioral.score,
      summary: "A plan-level behavioral hypothesis, not a browser-tested release gate.",
    },
    {
      id: "restraint-heuristic",
      label: "Restraint heuristic",
      authority: "plan-diagnostic",
      stage: "plan",
      status: input.restraint.verdict === "disciplined" ? "pass" : "review",
      score: input.restraint.restraintScore,
      summary: "Tests whether the proposed signature earns its prominence; it does not grade visual creativity.",
    },
    {
      id: "render-evidence",
      label: "Browser render evidence",
      authority: "render-evidence",
      stage: "render",
      status: "unavailable",
      score: null,
      summary: "Collected client-side after the initial API result at 360, 768, and 1440; not yet attached to this server report.",
    },
  ];

  const findings: EvaluationFinding[] = [];
  if (input.typographyDelivery.status === "failed" && input.project.readiness.status !== "blocked") {
    findings.push({
      id: "typography-release-mismatch",
      severity: "blocking",
      signalIds: ["typography-delivery", "release-readiness"],
      message: "Typography delivery failed but the release decision did not block the project.",
    });
  }
  if (blockingMedia && input.qualityReport.assets.status !== "fail") {
    findings.push({
      id: "media-quality-mismatch",
      severity: "blocking",
      signalIds: ["media-usage", "quality-report"],
      message: "The Media Gate is blocking, but the assets quality axis did not fail.",
    });
  }
  if (input.execution.effectiveMode === "creative-degraded") {
    findings.push({
      id: "creative-degraded-evidence",
      severity: "warning",
      signalIds: ["critique-provenance"],
      message: "Creative completed with local fallback evidence; high plan scores remain provisional rather than adversarially verified.",
    });
  }
  if (input.assetDelivery.status === "complete" && input.assetUsage.used < input.assetUsage.required) {
    findings.push({
      id: "asset-denominator-explanation",
      severity: "explanation",
      signalIds: ["asset-binary-delivery", "media-usage"],
      message: "Binary delivery can be complete while the Media Gate fails: delivery counts referenced files, whereas Media Gate counts the brief-level minimum used in assigned scenes.",
    });
  }
  if (
    input.project.readiness.status === "blocked"
    && (input.distinctiveness.score >= 85 || input.distinctiveness.normanLevels.behavioral.score >= 85)
  ) {
    findings.push({
      id: "plan-score-vs-release",
      severity: "explanation",
      signalIds: ["norman-behavioral", "release-readiness"],
      message: "A high plan diagnostic coexists with a blocked artifact. The values describe different stages; the release gate has veto authority.",
    });
  }
  if (!input.diversityResult.passed && input.distinctiveness.score >= 85) {
    findings.push({
      id: "distinctiveness-vs-template",
      severity: "warning",
      signalIds: ["template-diversity"],
      message: "The conceptual distinctiveness score is high, but delivered code matches a recurring house structure; uniqueness cannot be claimed.",
    });
  }
  if (Math.abs(input.restraint.restraintScore - input.distinctiveness.normanLevels.behavioral.score) >= 25) {
    findings.push({
      id: "diagnostic-domain-divergence",
      severity: "explanation",
      signalIds: ["restraint-heuristic", "norman-behavioral"],
      message: "Restraint and behavioral readings diverge because they test different questions; they must not be averaged or presented as competing release verdicts.",
    });
  }
  findings.push({
    id: "render-evidence-pending",
    severity: "explanation",
    signalIds: ["render-evidence"],
    message: "Visual claims remain provisional until the browser Render Gate is persisted back into the result history.",
  });

  const blocking = findings.some((finding) => finding.severity === "blocking");
  const warning = findings.some((finding) => finding.severity === "warning");
  const creativeClaim = input.project.readiness.status === "blocked"
    || !input.directionDiversity.passed
    || !input.diversityResult.passed
      ? "withheld" as const
      : input.execution.effectiveMode === "creative-degraded"
        ? "provisional" as const
        : "provisional" as const;

  return {
    version: 1,
    status: blocking ? "incoherent" : warning ? "review" : "coherent",
    releaseDecision: input.project.readiness.status,
    creativeClaim,
    signals,
    findings,
    policy: [
      "Release gates may veto diagnostics; diagnostics may never override a blocker.",
      "Plan scores, delivered-source evidence, and browser-render evidence are separate stages and are not averaged.",
      "Creative uniqueness is provisional until persisted multi-viewport render evidence exists.",
    ],
  };
}

/** Attach client-side browser evidence after the initial API response. */
export function applyRenderedEvaluationEvidence(
  report: EvaluationCoherenceReport,
  evidence: RenderedEvaluationEvidence,
  visualDiversityThreshold: number
): EvaluationCoherenceReport {
  const renderStatus: EvaluationSignalStatus = !evidence.complete
    ? "unavailable"
    : evidence.status === "pass"
      ? "pass"
      : evidence.status === "fail"
        ? "fail"
        : "review";
  const signals = report.signals.map((signal) => signal.id === "render-evidence"
    ? {
        ...signal,
        status: renderStatus,
        score: evidence.score,
        summary: `${evidence.covered}/3 viewports; FVE ${evidence.firstViewportScore ?? "pending"}, FVF ${evidence.functionalVisualScore ?? "pending"}, RES ${evidence.renderedEvidenceScore ?? "pending"}, RCR ${evidence.renderedCompositionScore ?? "pending"}, DF ${evidence.directionFidelity ?? "pending"}.`,
      }
    : signal);
  const findings = report.findings.filter((finding) => finding.id !== "render-evidence-pending" && finding.id !== "render-gate-review");
  if (!evidence.complete) {
    findings.push({
      id: "render-evidence-pending",
      severity: "explanation",
      signalIds: ["render-evidence"],
      message: `Browser evidence is persisted but incomplete (${evidence.covered}/3 viewports).`,
    });
  } else if (renderStatus !== "pass") {
    findings.push({
      id: "render-gate-review",
      severity: "warning",
      signalIds: ["render-evidence", "release-readiness"],
      message: "The delivered browser render did not fully pass; the initial server release decision cannot establish visual readiness by itself.",
    });
  }
  const archivePass = evidence.visualArchiveDistance === null || evidence.visualArchiveDistance >= visualDiversityThreshold;
  const directionPass = evidence.directionStatus === null || evidence.directionStatus === "pass";
  const hasPriorVeto = report.releaseDecision === "blocked"
    || report.findings.some((finding) => finding.severity === "blocking")
    || report.signals.some((signal) => signal.id === "direction-diversity" && signal.status === "fail")
    || report.signals.some((signal) => signal.id === "template-diversity" && signal.status === "fail");
  const degraded = report.findings.some((finding) => finding.id === "creative-degraded-evidence");
  const creativeClaim = hasPriorVeto || renderStatus === "fail" || !archivePass || !directionPass
    ? "withheld" as const
    : evidence.complete && renderStatus === "pass" && !degraded
      ? "eligible" as const
      : "provisional" as const;
  const blocking = findings.some((finding) => finding.severity === "blocking");
  const warning = findings.some((finding) => finding.severity === "warning");
  return {
    ...report,
    status: blocking ? "incoherent" : warning ? "review" : "coherent",
    creativeClaim,
    signals,
    findings,
  };
}
