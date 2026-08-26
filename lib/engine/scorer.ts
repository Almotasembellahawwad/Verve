// =========================================================
// lib/engine/scorer.ts
// Module J: Don Norman 3-Level Distinctiveness Report
//
// Based on: Don Norman — "Emotional Design: Why We Love
// (or Hate) Everyday Things" (2004), Chapter 1.
//
// Norman's Three Levels of Design Processing:
//
// 1. VISCERAL (Instinctive)
//    The automatic, pre-conscious response.
//    "Does this look good, dangerous, safe, attractive?"
//    Measured by: visual boldness, distinctiveness, first-
//    impression contrast vs. the generic field.
//
// 2. BEHAVIORAL (Functional)
//    The experience of use and interaction.
//    "Does this work? Is it easy? Does it perform its job?"
//    Measured by: contrast ratios, navigation clarity,
//    CTA legibility, touch target compliance, SNR.
//    NOTE: Positive visceral/reflective can MASK behavioral
//    failures (the Aesthetic-Usability Effect). This level
//    evaluates BLIND to aesthetics.
//
// 3. REFLECTIVE (Conscious, long-term)
//    The meaning we assign after the experience.
//    "What does this say about me? Would I show this to
//    someone? Am I proud to use/share this?"
//    Measured by: brand archetype coherence, shareability
//    signal, distinctiveness beyond the industry norm,
//    signature element memorability.
//
// =========================================================

import type { BlocklistResult } from "./blocklist-filter";
import type { DesignPlan } from "./plan-generator";
import type { CritiqueResult } from "./critique-loop";
import type { ArchetypeResolution } from "./brand-archetype-resolver";

// ── Score types ───────────────────────────────────────────────────────────────
export type NormanLevelScore = {
  score: number;        // 0–100
  grade: "S" | "A" | "B" | "C" | "D";
  rationale: string;    // why this score
  improvements: string[];
};

export type DistinctivenessReport = {
  // ── Legacy composite (kept for backward compat) ──────────────────────────
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  clichesAvoided: string[];
  clichesDetected: string[];
  signatureElement: string;
  critiqueSummary: string;
  critiqueTranscript: string;
  revisionCount: number;
  recommendations: string[];

  // ── Module G additions ────────────────────────────────────────────────────
  signalNoiseRatio: number;
  cognitiveScore: number;
  endingQuality: "strong" | "intentional" | "weak" | "filler";
  accessibilityPass: boolean;
  cognitiveBreakdown: {
    vonRestorff: string;
    gutenberg: string;
    peakEnd: string;
    signalNoise: string;
    aestheticUsability: string;
  };

  // ── Module I addition ─────────────────────────────────────────────────────
  archetypeId: string;
  archetypeCoherence: number; // 0–100: how well design reflects archetype

  // ── Module J: Don Norman 3-Level Scoring ─────────────────────────────────
  normanLevels: {
    visceral:    NormanLevelScore;   // first impression, visual boldness
    behavioral:  NormanLevelScore;   // usability, functional clarity
    reflective:  NormanLevelScore;   // shareability, pride, brand coherence
  };
  normanSummary: string; // which level is the current weakest link
};

// ── Grade helper ──────────────────────────────────────────────────────────────
function toGrade(s: number): "S" | "A" | "B" | "C" | "D" {
  return s >= 90 ? "S" : s >= 80 ? "A" : s >= 65 ? "B" : s >= 50 ? "C" : "D";
}

// ── Level 1: Visceral Score ───────────────────────────────────────────────────
// "Does it make a strong first impression?"
// High = bold, distinctive, instantly different from the generic field
// Low = could be any brand, forgettable, defaults everywhere
function scoreVisceral(
  blocklistResult: BlocklistResult,
  plan: DesignPlan,
  finalCritique: CritiqueResult
): NormanLevelScore {
  let score = 100;
  const improvements: string[] = [];

  // Deduct for blocklist violations (high-severity = immediately forgettable)
  const highSeverity = blocklistResult.matches.filter((m) => m.severity === "high");
  const medSeverity  = blocklistResult.matches.filter((m) => m.severity === "medium");
  score -= highSeverity.length * 15;
  score -= medSeverity.length  * 6;

  // Deduct for critique flags on visual elements
  // Every flag produced by the design-plan critic concerns the visual concept.
  // Word filtering missed concrete names and allowed rejected plans to score 100.
  const visualFlags = finalCritique.flaggedElements;
  score -= visualFlags.filter((e) => e.severity === "high").length   * 12;
  score -= visualFlags.filter((e) => e.severity === "medium").length * 5;

  const critiqueHigh = visualFlags.filter((e) => e.severity === "high");
  const signatureName = plan.signatureElement.name.toLowerCase();
  const signatureFlagged = visualFlags.some((flag) => {
    const element = flag.element.toLowerCase();
    return flag.severity === "high" &&
      (element.includes("signature") || (signatureName.length > 2 && element.includes(signatureName)));
  });

  // Bonus for no high-severity clichés
  if (highSeverity.length === 0 && critiqueHigh.length === 0) score += 8;

  // Bonus for positive critique elements
  score += Math.min(finalCritique.positiveElements.length * 2, 8);

  // Bonus for strong signature element (non-empty name ≠ "None")
  if (plan.signatureElement.name && plan.signatureElement.name !== "None" && !signatureFlagged) score += 6;

  // A failed adversarial review is a hard ceiling, not a note bonuses can erase.
  if (!finalCritique.passed) score = Math.min(score, 64);
  if (critiqueHigh.length >= 5) score = Math.min(score, 44);
  else if (critiqueHigh.length >= 3) score = Math.min(score, 54);
  else if (critiqueHigh.length > 0) score = Math.min(score, 69);

  score = Math.max(0, Math.min(100, score));

  if (highSeverity.length > 0) improvements.push(`Remove visual clichés: ${highSeverity.map((m) => m.pattern).join(", ")}`);
  if (visualFlags.length > 0)  improvements.push(`Revise flagged visual elements: ${visualFlags.map((e) => e.element).join(", ")}`);
  if (score < 75) improvements.push("Strengthen the Signature Element — it should be visually irreversible");

  return {
    score,
    grade: toGrade(score),
    rationale: `Visceral: First-impression boldness based on ${highSeverity.length} high-severity clichés, ${finalCritique.flaggedElements.length} critique flags, ${finalCritique.positiveElements.length} positive elements. Signature element: "${plan.signatureElement.name}".`,
    improvements,
  };
}

// ── Level 2: Behavioral Score ─────────────────────────────────────────────────
// "Does it actually work? Is it usable?"
// CRITICAL: Evaluated blind to aesthetics (Aesthetic-Usability Effect mitigation)
// High = passes contrast, navigation, touch targets, SNR is functional
// Low = beautiful but unusable — contrast fails, CTA unclear, dense layout
function scoreBehavioral(
  plan: DesignPlan,
  finalCritique: CritiqueResult
): NormanLevelScore {
  let score = 100;
  const improvements: string[] = [];

  // Hard penalty: usability floor failure (non-negotiable behavioral failure)
  if (!finalCritique.usabilityFloor.passed) {
    score -= 30; // severe — this is not a stylistic opinion
    finalCritique.usabilityFloor.issues.forEach((issue) =>
      improvements.push(`[CRITICAL] ${issue}`)
    );
  }

  // Individual usability checks
  if (!finalCritique.usabilityFloor.contrastOk) {
    score -= 10;
    improvements.push("Contrast ratio below WCAG 2.1 AA — increase text/background delta");
  }
  if (!finalCritique.usabilityFloor.touchTargetsOk) {
    score -= 8;
    improvements.push("Touch targets may be below 44×44px — enlarge interactive elements");
  }
  if (!finalCritique.usabilityFloor.bodyTextOk) {
    score -= 8;
    improvements.push("Body text legibility: ensure ≥16px size with ≥1.5 line-height");
  }

  // Signal-to-noise ratio (behavioral clarity — not aesthetic preference)
  const snr = plan.cognitiveGrounding?.signalNoiseRatio ?? 0.5;
  if (snr < 0.5) {
    score -= 12;
    improvements.push(`Low signal-to-noise ratio (${snr.toFixed(2)}) — too much decoration reduces scannability`);
  } else if (snr < 0.65) {
    score -= 5;
    improvements.push(`Signal-to-noise ratio ${snr.toFixed(2)} — consider reducing decorative elements`);
  }

  // Cognitive failures (behavioral layer — not visceral)
  const behavioralCognitiveFailures = finalCritique.cognitiveFailures.filter((f) =>
    f.toLowerCase().includes("contrast") ||
    f.toLowerCase().includes("touch") ||
    f.toLowerCase().includes("legib") ||
    f.toLowerCase().includes("usability") ||
    f.toLowerCase().includes("gutenberg")
  );
  score -= behavioralCognitiveFailures.length * 5;

  // Bonus for strong usability pass
  if (finalCritique.usabilityFloor.passed && snr >= 0.7) score += 10;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: toGrade(score),
    rationale: `Behavioral: Usability floor ${finalCritique.usabilityFloor.passed ? "PASS" : "FAIL"} | Contrast: ${finalCritique.usabilityFloor.contrastOk ? "✓" : "✗"} | Touch targets: ${finalCritique.usabilityFloor.touchTargetsOk ? "✓" : "✗"} | Body text: ${finalCritique.usabilityFloor.bodyTextOk ? "✓" : "✗"} | S/N Ratio: ${snr.toFixed(2)}`,
    improvements,
  };
}

// ── Level 3: Reflective Score ─────────────────────────────────────────────────
// "Would someone be proud to show this? Is this worth sharing?"
// High = design reflects a coherent identity that the target audience
//        would use to signal their own taste/values
// Low = competent but forgettable — not embarrassing, but not notable
function scoreReflective(
  plan: DesignPlan,
  finalCritique: CritiqueResult,
  archetypeResolution?: ArchetypeResolution
): NormanLevelScore {
  let score = 60; // reflective starts at baseline — most designs don't achieve shareability
  const improvements: string[] = [];
  const deterministicPreflight = finalCritique.rawCritique.includes("Deterministic Fast-mode preflight");

  // Archetype coherence: does the design reflect the identified archetype?
  let archetypeCoherence = 50; // default
  if (archetypeResolution) {
    // Heuristic: if there are no archetype-violation flags in critique → high coherence
    const archetypeViolations = finalCritique.flaggedElements.filter((e) =>
      archetypeResolution.primaryProfile.design.avoidInDesign.some((avoid) =>
        e.element.toLowerCase().includes(avoid.split(" ")[0].toLowerCase())
      )
    ).length;
    archetypeCoherence = Math.max(20, 100 - archetypeViolations * 20);
    if (deterministicPreflight) {
      archetypeCoherence = Math.min(archetypeCoherence, Math.round(archetypeResolution.confidence * 100));
    }
    score += (archetypeCoherence - 50) * 0.3; // scaled contribution
  }

  // Peak-End Rule: strong ending drives reflective quality
  // (people remember the peak + the end — a strong ending drives shareability)
  if (finalCritique.endingCheck.quality === "strong")      score += 18;
  else if (finalCritique.endingCheck.quality === "intentional") score += 8;
  else if (finalCritique.endingCheck.quality === "weak")    score -= 5;
  else if (finalCritique.endingCheck.quality === "filler")  score -= 15;

  // Signature element: is it memorable?
  const hasDistinctSignature = plan.signatureElement.name &&
    plan.signatureElement.name !== "None" &&
    plan.signatureElement.justification.length > 80;
  const signatureName = plan.signatureElement.name.toLowerCase();
  const signatureFlagged = finalCritique.flaggedElements.some((flag) => {
    const element = flag.element.toLowerCase();
    return flag.severity === "high" &&
      (element.includes("signature") || (signatureName.length > 2 && element.includes(signatureName)));
  });
  if (hasDistinctSignature && !signatureFlagged) score += 12;

  // Positive critique elements (genuine specificity → shareability signal)
  score += Math.min(finalCritique.positiveElements.length * 5, 15);

  // Cognitive score contribution (high cognitive = principled = proud-able)
  const cogBonus = Math.round((finalCritique.cognitiveScore / 25) * 10);
  score += cogBonus;

  // Von Restorff: if signature element is truly distinctive → shareability
  const vrCompliance = plan.cognitiveGrounding?.vonRestorffCompliance ?? "";
  if (vrCompliance.length > 60 && !signatureFlagged) score += 5; // detailed justification = real isolation

  const highCritiqueFlags = finalCritique.flaggedElements.filter((flag) => flag.severity === "high");
  const mediumCritiqueFlags = finalCritique.flaggedElements.filter((flag) => flag.severity === "medium");
  score -= highCritiqueFlags.length * 7;
  score -= mediumCritiqueFlags.length * 3;
  if (!finalCritique.passed) score = Math.min(score, 69);
  if (deterministicPreflight) score = Math.min(score, 84);

  score = Math.max(0, Math.min(100, score));

  if (!archetypeResolution) improvements.push("Add brand archetype resolution to improve identity coherence");
  if (finalCritique.endingCheck.quality === "filler" || finalCritique.endingCheck.quality === "weak") {
    improvements.push(`Closing section is "${finalCritique.endingCheck.quality}" — strengthen it to improve last-impression memory`);
  }
  if (!hasDistinctSignature) improvements.push("Signature element needs a stronger, specific justification to be memorable");
  if (signatureFlagged) improvements.push("The signature element was rejected as generic; replace it before awarding memorability credit");
  if (score < 70) improvements.push("To improve shareability: ensure the design reflects the brand archetype coherently so the audience sees their own values in it");

  return {
    score,
    grade: toGrade(score),
    rationale: `Reflective: Ending quality "${finalCritique.endingCheck.quality}" | Signature element specificity: ${hasDistinctSignature ? "strong" : "weak"} | Archetype coherence: ${archetypeResolution ? `${archetypeCoherence}% (${archetypeResolution.primaryArchetype})` : "not evaluated"} | Cognitive contribution: ${finalCritique.cognitiveScore}/25`,
    improvements,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────
export function generateDistinctivenessReport(
  blocklistResult: BlocklistResult,
  plan: DesignPlan,
  finalCritique: CritiqueResult,
  revisionCount: number,
  archetypeResolution?: ArchetypeResolution
): DistinctivenessReport {

  // ── Don Norman 3 levels ───────────────────────────────────────────────────
  const visceral   = scoreVisceral(blocklistResult, plan, finalCritique);
  const behavioral = scoreBehavioral(plan, finalCritique);
  const reflective = scoreReflective(plan, finalCritique, archetypeResolution);

  // ── Distinctiveness composite with evidence floors ───────────────────────
  // Visceral:   50% — visible specificity is the primary evidence
  // Behavioral: 20% — usability is a floor, not a distinctiveness bonus
  // Reflective: 30% — long-term value and brand coherence
  const rawComposite = Math.round(
    visceral.score   * 0.50 +
    behavioral.score * 0.20 +
    reflective.score * 0.30
  );
  const highCritiqueCount = finalCritique.flaggedElements.filter((flag) => flag.severity === "high").length;
  const highBlocklistCount = blocklistResult.matches.filter((match) => match.severity === "high").length;
  const mediumBlocklistCount = blocklistResult.matches.filter((match) => match.severity === "medium").length;
  const critiqueCap = highCritiqueCount >= 5 ? 49
    : highCritiqueCount >= 3 ? 59
      : highCritiqueCount > 0 ? 74
        : !finalCritique.passed ? 79
          : 100;
  const blocklistCap = highBlocklistCount >= 2 ? 79
    : highBlocklistCount === 1 ? 84
      : mediumBlocklistCount > 0 ? 89
        : 100;
  const behavioralCap = behavioral.score < 40 ? 49
    : behavioral.score < 55 ? 59
      : behavioral.score < 70 ? 74
        : 100;
  const visualEvidenceCap = visceral.score < 80 ? 89 : 100;
  const composite = Math.min(rawComposite, critiqueCap, blocklistCap, behavioralCap, visualEvidenceCap);
  const compositeGrade = toGrade(composite);

  // ── Archetype coherence ───────────────────────────────────────────────────
  let archetypeCoherence = 50;
  if (archetypeResolution) {
    const violations = finalCritique.flaggedElements.filter((e) =>
      archetypeResolution.primaryProfile.design.avoidInDesign.some((a) =>
        e.element.toLowerCase().includes(a.split(" ")[0].toLowerCase())
      )
    ).length;
    archetypeCoherence = Math.max(20, 100 - violations * 20);
    if (finalCritique.rawCritique.includes("Deterministic Fast-mode preflight")) {
      archetypeCoherence = Math.min(archetypeCoherence, Math.round(archetypeResolution.confidence * 100));
    }
  }

  // ── Cliché lists ──────────────────────────────────────────────────────────
  const clichesDetected = [
    ...blocklistResult.matches.map((m) => m.pattern),
    ...finalCritique.flaggedElements.filter((e) => e.severity === "high").map((e) => e.element),
  ];
  const clichesAvoided = finalCritique.positiveElements;

  // ── Unified recommendations (deduplicated from all 3 levels) ─────────────
  const allRecs = [
    ...visceral.improvements,
    ...behavioral.improvements,
    ...reflective.improvements,
  ].filter((r, i, arr) => arr.indexOf(r) === i);

  // ── Norman summary ────────────────────────────────────────────────────────
  const weakest = [
    { label: "Visceral",   score: visceral.score },
    { label: "Behavioral", score: behavioral.score },
    { label: "Reflective", score: reflective.score },
  ].sort((a, b) => a.score - b.score)[0];

  const weakestSummary = `Weakest level: ${weakest.label} (${weakest.score}/100). ${
    weakest.label === "Visceral"   ? "Focus on visual boldness — the first impression is not yet distinctive enough." :
    weakest.label === "Behavioral" ? "Usability issues are undermining the design — solve function before form." :
    "The design needs a clearer identity narrative to become shareable."
  }`;

  // ── Cognitive breakdown ───────────────────────────────────────────────────
  const normanSummary = weakest.score >= 90 && finalCritique.passed
    ? "All three Norman levels are strong; preserve the current balance while validating the delivered code."
    : weakestSummary;

  const cg = plan.cognitiveGrounding;
  const cognitiveBreakdown = {
    vonRestorff: cg?.vonRestorffCompliance   ?? "Not evaluated",
    gutenberg:   cg?.gutenbergCompliance     ?? "Not evaluated",
    peakEnd:     finalCritique.endingCheck.description ?? "Not evaluated",
    signalNoise: cg ? `S/N Ratio: ${cg.signalNoiseRatio.toFixed(2)}` : "Not evaluated",
    aestheticUsability: finalCritique.usabilityFloor.passed
      ? `PASS — ${cg?.usabilityBaseline ?? "Baseline met"}`
      : `FAIL — ${finalCritique.usabilityFloor.issues.join("; ")}`,
  };

  return {
    // Legacy composite
    score: composite,
    grade: compositeGrade,
    clichesAvoided,
    clichesDetected: [...new Set(clichesDetected)],
    signatureElement: `${plan.signatureElement.name}: ${plan.signatureElement.description}`,
    critiqueSummary: finalCritique.rawCritique.includes("Deterministic Fast-mode preflight") && blocklistResult.matches.length > 0
      ? `Fast structural preflight passed, but the delivered code contains ${blocklistResult.matches.length} blocked visual pattern${blocklistResult.matches.length === 1 ? "" : "s"}. Resolve them or run Studio for adversarial review.`
      : finalCritique.overallVerdict,
    critiqueTranscript: finalCritique.rawCritique,
    revisionCount,
    recommendations: allRecs,

    // Module G
    signalNoiseRatio: cg?.signalNoiseRatio ?? 0.5,
    cognitiveScore:   finalCritique.cognitiveScore,
    endingQuality:    finalCritique.endingCheck.quality,
    accessibilityPass: finalCritique.usabilityFloor.passed,
    cognitiveBreakdown,

    // Module I
    archetypeId: archetypeResolution?.primaryArchetype ?? "unknown",
    archetypeCoherence,

    // Module J — Don Norman 3-Level
    normanLevels: { visceral, behavioral, reflective },
    normanSummary,
  };
}
