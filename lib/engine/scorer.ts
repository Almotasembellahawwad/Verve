import type { BlocklistResult } from "./blocklist-filter";
import type { DesignPlan } from "./plan-generator";
import type { CritiqueResult } from "./critique-loop";

export type DistinctivenessReport = {
  score: number; // 0-100
  grade: "S" | "A" | "B" | "C" | "D";
  clichesAvoided: string[];
  clichesDetected: string[];
  signatureElement: string;
  critiqueSummary: string;
  critiqueTranscript: string;
  revisionCount: number;
  recommendations: string[];
};

export function generateDistinctivenessReport(
  blocklistResult: BlocklistResult,
  plan: DesignPlan,
  finalCritique: CritiqueResult,
  revisionCount: number
): DistinctivenessReport {
  // Base score starts at 100, deductions from detected clichés and critique flags
  let score = 100;

  const highSeverityDetected = blocklistResult.matches.filter((m) => m.severity === "high");
  const mediumSeverityDetected = blocklistResult.matches.filter((m) => m.severity === "medium");

  // Deduct for detected clichés in original content
  score -= highSeverityDetected.length * 12;
  score -= mediumSeverityDetected.length * 5;

  // Deduct for critique flags
  const highCritiqueFlags = finalCritique.flaggedElements.filter((e) => e.severity === "high");
  const mediumCritiqueFlags = finalCritique.flaggedElements.filter((e) => e.severity === "medium");
  score -= highCritiqueFlags.length * 10;
  score -= mediumCritiqueFlags.length * 4;

  // Add back for revision cycles (shows the system caught and fixed issues)
  if (revisionCount > 0) score += revisionCount * 5;

  // Add for positive critique elements
  score += Math.min(finalCritique.positiveElements.length * 3, 15);

  // Clamp
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";

  const allClichePatterns = [
    ...blocklistResult.matches.map((m) => m.pattern),
    ...finalCritique.flaggedElements
      .filter((e) => e.severity === "high")
      .map((e) => e.element),
  ];

  const clichesAvoided = finalCritique.positiveElements;

  const recommendations: string[] = [];
  if (highCritiqueFlags.length > 0) {
    recommendations.push(
      `Consider revising: ${highCritiqueFlags.map((e) => e.element).join(", ")}`
    );
  }
  if (score < 70) {
    recommendations.push(
      "This design still has generic elements. Consider manually selecting a more unusual color derived from your subject matter."
    );
  }
  if (!plan.signatureElement.name) {
    recommendations.push("A stronger signature element would significantly increase distinctiveness.");
  }

  return {
    score,
    grade,
    clichesAvoided,
    clichesDetected: [...new Set(allClichePatterns)],
    signatureElement: `${plan.signatureElement.name}: ${plan.signatureElement.description}`,
    critiqueSummary: finalCritique.overallVerdict,
    critiqueTranscript: finalCritique.rawCritique,
    revisionCount,
    recommendations,
  };
}
