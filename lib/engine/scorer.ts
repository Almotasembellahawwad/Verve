import type { BlocklistResult } from "./blocklist-filter";
import type { DesignPlan } from "./plan-generator";
import type { CritiqueResult } from "./critique-loop";

export type DistinctivenessReport = {
  score: number;           // 0–100 overall distinctiveness
  grade: "S" | "A" | "B" | "C" | "D";
  clichesAvoided: string[];
  clichesDetected: string[];
  signatureElement: string;
  critiqueSummary: string;
  critiqueTranscript: string;
  revisionCount: number;
  recommendations: string[];
  // ── Module G additions ─────────────────────────────────────────
  signalNoiseRatio: number;              // 0.0–1.0 from cognitive grounding
  cognitiveScore: number;                // 0–25 (5 per principle)
  endingQuality: "strong" | "intentional" | "weak" | "filler";
  accessibilityPass: boolean;
  cognitiveBreakdown: {                  // per-principle compliance
    vonRestorff: string;
    gutenberg: string;
    peakEnd: string;
    signalNoise: string;
    aestheticUsability: string;
  };
};

export function generateDistinctivenessReport(
  blocklistResult: BlocklistResult,
  plan: DesignPlan,
  finalCritique: CritiqueResult,
  revisionCount: number
): DistinctivenessReport {
  // ── Base score: 100, deductions from clichés + critique ───────────────────
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

  // ── Module G: Cognitive Grounding bonus/penalty ───────────────────────────
  // Bonus for cognitive compliance (max +15)
  const cogBonus = Math.round((finalCritique.cognitiveScore / 25) * 15);
  score += cogBonus;

  // Penalty for usability failure (−15 — non-negotiable)
  if (!finalCritique.usabilityFloor.passed) {
    score -= 15;
  }

  // Penalty for Peak-End failure
  if (finalCritique.endingCheck.quality === "filler") score -= 8;
  else if (finalCritique.endingCheck.quality === "weak") score -= 4;
  // Bonus for strong ending
  else if (finalCritique.endingCheck.quality === "strong") score += 5;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";

  // ── Signal-to-Noise Ratio ────────────────────────────────────────────────
  const signalNoiseRatio = plan.cognitiveGrounding?.signalNoiseRatio ?? 0.5;

  // ── Cliché lists ──────────────────────────────────────────────────────────
  const allClichePatterns = [
    ...blocklistResult.matches.map((m) => m.pattern),
    ...finalCritique.flaggedElements
      .filter((e) => e.severity === "high")
      .map((e) => e.element),
  ];

  const clichesAvoided = finalCritique.positiveElements;

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations: string[] = [];

  if (!finalCritique.usabilityFloor.passed) {
    finalCritique.usabilityFloor.issues.forEach((issue) =>
      recommendations.push(`⚠ Usability: ${issue}`)
    );
  }

  if (finalCritique.endingCheck.quality === "filler" || finalCritique.endingCheck.quality === "weak") {
    recommendations.push(`Peak-End: ${finalCritique.endingCheck.recommendation}`);
  }

  if (finalCritique.cognitiveFailures.length > 0) {
    finalCritique.cognitiveFailures.slice(0, 2).forEach((f) =>
      recommendations.push(`Cognitive: ${f}`)
    );
  }

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

  if (signalNoiseRatio < 0.65) {
    recommendations.push(
      `Signal-to-Noise: Ratio ${signalNoiseRatio.toFixed(2)} — reduce decorative elements or add more semantic content density.`
    );
  }

  // ── Cognitive breakdown (human-readable per principle) ────────────────────
  const cg = plan.cognitiveGrounding;
  const cognitiveBreakdown = {
    vonRestorff: cg?.vonRestorffCompliance ?? "Not evaluated",
    gutenberg:   cg?.gutenbergCompliance   ?? "Not evaluated",
    peakEnd:     finalCritique.endingCheck.description ?? "Not evaluated",
    signalNoise: cg ? `S/N Ratio: ${cg.signalNoiseRatio.toFixed(2)}` : "Not evaluated",
    aestheticUsability: finalCritique.usabilityFloor.passed
      ? `PASS — ${cg?.usabilityBaseline ?? "Baseline met"}`
      : `FAIL — ${finalCritique.usabilityFloor.issues.join("; ")}`,
  };

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
    // Module G fields
    signalNoiseRatio,
    cognitiveScore: finalCritique.cognitiveScore,
    endingQuality: finalCritique.endingCheck.quality,
    accessibilityPass: finalCritique.usabilityFloor.passed,
    cognitiveBreakdown,
  };
}
