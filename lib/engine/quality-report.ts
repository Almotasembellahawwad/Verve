import type { CritiqueResult } from "./critique-loop";
import type { AssetUsageEvidence } from "./asset-usage";
import type { GeneratedProject } from "../project/types";
import type { AssetDeliveryReceipt } from "./asset-delivery";

export type QualityAxis = {
  status: "pass" | "review" | "fail";
  score: number;
  evidence: string[];
};

export type QualityReport = {
  status: "ready" | "review-required" | "blocked";
  content: QualityAxis;
  functionality: QualityAxis;
  responsive: QualityAxis;
  firstViewport: QualityAxis;
  accessibility: QualityAxis;
  assets: QualityAxis;
};

function axis(checks: GeneratedProject["validation"]["checks"], ids: string[]): QualityAxis {
  const relevant = checks.filter((check) => ids.some((id) => check.id.includes(id)));
  const failures = relevant.filter((check) => check.status === "fail");
  const warnings = relevant.filter((check) => check.status === "warning");
  return {
    status: failures.length ? "fail" : warnings.length ? "review" : "pass",
    score: Math.max(0, 100 - failures.length * 35 - warnings.length * 10),
    evidence: relevant.map((check) => check.message).slice(0, 12),
  };
}

export function buildQualityReport(
  project: GeneratedProject,
  assetUsage: AssetUsageEvidence,
  critique: CritiqueResult,
  assetDelivery: AssetDeliveryReceipt
): QualityReport {
  const content = axis(project.validation.checks, ["claim", "content", "placeholder"]);
  if (!critique.passed) {
    content.status = content.status === "fail" ? "fail" : "review";
    content.score = Math.min(content.score, 74);
    content.evidence.push(critique.overallVerdict);
  }
  const functionality = axis(project.validation.checks, ["form", "link", "import", "runtime", "interaction"]);
  const responsive = axis(project.validation.checks, ["overflow", "responsive", "mobile-clipping"]);
  const firstViewport = axis(project.validation.checks, ["first-viewport"]);
  const accessibility = axis(project.validation.checks, ["access", "motion", "font", "label", "alt", "contrast"]);
  const assets: QualityAxis = {
    status: assetDelivery.failed ? "fail" : assetUsage.warnings.length ? "review" : "pass",
    score: assetDelivery.failed ? Math.max(0, 45 - assetDelivery.failed * 15) : Math.max(0, 100 - assetUsage.warnings.length * 15),
    evidence: assetDelivery.failed
      ? [...assetDelivery.warnings, ...assetUsage.warnings]
      : assetUsage.warnings.length
        ? [...assetUsage.warnings]
        : [`${assetUsage.used} approved asset(s) used; ${assetDelivery.bundled} external binary asset(s) bundled locally.`],
  };
  const axes = [content, functionality, responsive, firstViewport, accessibility, assets];
  const status = project.readiness.status === "blocked" || axes.some((item) => item.status === "fail")
    ? "blocked"
    : project.readiness.status === "review-required" || axes.some((item) => item.status === "review")
      ? "review-required"
      : "ready";
  return { status, content, functionality, responsive, firstViewport, accessibility, assets };
}
