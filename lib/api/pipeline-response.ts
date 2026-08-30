import type { PipelineResult } from "@/lib/engine/pipeline";
import { buildQualityReport } from "@/lib/engine/quality-report";

/** One public response contract shared by JSON, SSE, and background jobs. */
export function serializePipelineResult(result: PipelineResult, requestId?: string) {
  const qualityReport = buildQualityReport(result.project, result.assetUsage, result.finalCritique);
  return {
    mode: result.mode,
    effectiveMode: result.execution.effectiveMode.startsWith("creative") ? "creative" : "fast",
    directionBoard: result.directionBoard,
    selectedDirection: result.designPlan.directionPortfolio?.candidates.find((candidate) =>
      candidate.id === result.designPlan.directionPortfolio?.selectedDirectionId
    ),
    briefAnalysis: result.briefAnalysis,
    plan: result.designPlan,
    projectSpec: result.projectSpec,
    directionDiversity: result.directionDiversity,
    diversityEvidence: {
      passed: result.directionDiversity.passed,
      medianPairDistance: result.directionDiversity.medianPairDistance,
      minimumPairDistance: result.directionDiversity.minimumPairDistance,
      distinctStructureCount: result.directionDiversity.distinctStructureCount,
      archiveDistance: result.directionDiversity.historicalNoveltyScore == null
        ? null
        : result.directionDiversity.historicalNoveltyScore / 100,
      warnings: result.directionDiversity.warnings,
    },
    qualityReport,
    experienceReview: {
      kind: "descriptive-not-novelty-score",
      visceral: result.distinctivenessReport.normanLevels?.visceral,
      behavioral: result.distinctivenessReport.normanLevels?.behavioral,
      reflective: result.distinctivenessReport.normanLevels?.reflective,
      summary: result.distinctivenessReport.normanSummary,
    },
    inputBlocklistMatches: result.inputBlocklistResult.matches,
    blocklistMatches: result.blocklistResult.matches,
    assetBundle: result.assetBundle,
    assetUsage: result.assetUsage,
    execution: result.execution,
    competitiveField: {
      industry: result.competitiveAnalysis.industry,
      matched: result.competitiveAnalysis.matched,
      temperature: result.competitiveAnalysis.industryTemperature,
      opportunity: result.competitiveAnalysis.distinctivenessOpportunity,
      patterns: result.competitiveAnalysis.patterns.map((pattern) => pattern.pattern),
    },
    archetype: {
      id: result.archetypeResolution.primaryArchetype,
      name: result.archetypeResolution.primaryProfile.name,
      secondaryId: result.archetypeResolution.secondaryArchetype,
      confidence: result.archetypeResolution.confidence,
      reasoning: result.archetypeResolution.reasoning,
      emotionalJob: result.archetypeResolution.emotionalJob,
      archetypeConflict: result.archetypeResolution.archetypeConflict,
      designConstraints: result.archetypeResolution.designConstraints,
    },
    animationLanguage: {
      archetypeId: result.animationLanguage.archetypeId,
      primaryEasing: result.animationLanguage.primaryEasing,
      durations: result.animationLanguage.durations,
      codeGenHint: result.animationLanguage.codeGenHint,
      cssTokens: result.animationLanguage.cssTokens,
      keyframes: result.animationLanguage.keyframes,
    },
    contrastReport: {
      fixesApplied: result.contrastReport.fixesApplied,
      allPass: result.contrastReport.allPass,
      checks: result.contrastReport.checked,
    },
    critique: {
      passed: result.finalCritique.passed,
      flaggedElements: result.finalCritique.flaggedElements,
      positiveElements: result.finalCritique.positiveElements,
      verdict: result.finalCritique.overallVerdict,
      transcript: result.finalCritique.rawCritique,
      endingCheck: result.finalCritique.endingCheck,
      usabilityFloor: result.finalCritique.usabilityFloor,
      cognitiveScore: result.finalCritique.cognitiveScore,
      cognitiveFailures: result.finalCritique.cognitiveFailures,
    },
    code: result.generatedCode,
    codeQuality: result.codeQualityResult,
    restraintResult: result.restraintResult,
    engineeringResult: result.engineeringResult,
    diversityResult: result.diversityResult,
    distinctivenessReport: {
      ...result.distinctivenessReport,
      revisionCount: result.revisionCount,
    },
    revisionCount: result.revisionCount,
    durationMs: result.durationMs,
    project: result.project,
    ...(requestId ? { requestId } : {}),
  };
}

export type SerializedPipelineResult = ReturnType<typeof serializePipelineResult>;
