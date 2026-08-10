import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/engine/pipeline";
import { z } from "zod";

export const maxDuration = 120;

const RequestSchema = z.object({
  brief:        z.string().min(10).max(5000),
  existingCode: z.string().max(20000).optional(),
  framework:    z.enum(["nextjs", "react", "html"]).optional().default("nextjs"),
  apiKey:       z.string().optional(),
  provider:     z.enum(["anthropic", "openai", "gemini"]).optional().default("anthropic"),
  model:        z.string().optional(),
  pexelsKey:    z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { apiKey, provider = "anthropic", pexelsKey } = parsed.data;

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key provided. Please add your API key in the provider selector.", code: "NO_API_KEY" },
        { status: 401 }
      );
    }

    const result = await runPipeline({ ...parsed.data, provider, apiKey, pexelsKey });

    return NextResponse.json({
      // Core
      plan:             result.designPlan,
      briefAnalysis:    result.briefAnalysis,
      blocklistMatches: result.blocklistResult.matches,

      // Module H
      assetBundle: result.assetBundle,

      // Module I — Brand Archetype
      archetype: {
        id:                result.archetypeResolution.primaryArchetype,
        name:              result.archetypeResolution.primaryProfile.name,
        secondaryId:       result.archetypeResolution.secondaryArchetype,
        confidence:        result.archetypeResolution.confidence,
        reasoning:         result.archetypeResolution.reasoning,
        emotionalJob:      result.archetypeResolution.emotionalJob,
        archetypeConflict: result.archetypeResolution.archetypeConflict,
        designConstraints: result.archetypeResolution.designConstraints,
      },

      // Module K — Animation Language
      animationLanguage: {
        archetypeId:       result.animationLanguage.archetypeId,
        primaryEasing:     result.animationLanguage.primaryEasing,
        durations:         result.animationLanguage.durations,
        codeGenHint:       result.animationLanguage.codeGenHint,
        cssTokens:         result.animationLanguage.cssTokens,
        keyframes:         result.animationLanguage.keyframes,
      },

      // Critique (Module G additions included)
      critique: {
        passed:            result.finalCritique.passed,
        flaggedElements:   result.finalCritique.flaggedElements,
        positiveElements:  result.finalCritique.positiveElements,
        verdict:           result.finalCritique.overallVerdict,
        transcript:        result.finalCritique.rawCritique,
        endingCheck:       result.finalCritique.endingCheck,
        usabilityFloor:    result.finalCritique.usabilityFloor,
        cognitiveScore:    result.finalCritique.cognitiveScore,
        cognitiveFailures: result.finalCritique.cognitiveFailures,
      },

      // Generated code
      code: result.generatedCode,

      // Module J — Don Norman 3-Level Report
      distinctivenessReport: {
        // Legacy composite
        score:            result.distinctivenessReport.score,
        grade:            result.distinctivenessReport.grade,
        // 3-level breakdown
        normanLevels:     result.distinctivenessReport.normanLevels,
        normanSummary:    result.distinctivenessReport.normanSummary,
        // Module I
        archetypeId:      result.distinctivenessReport.archetypeId,
        archetypeCoherence: result.distinctivenessReport.archetypeCoherence,
        // Module G
        signalNoiseRatio: result.distinctivenessReport.signalNoiseRatio,
        cognitiveScore:   result.distinctivenessReport.cognitiveScore,
        endingQuality:    result.distinctivenessReport.endingQuality,
        accessibilityPass: result.distinctivenessReport.accessibilityPass,
        cognitiveBreakdown: result.distinctivenessReport.cognitiveBreakdown,
        // Content
        clichesAvoided:   result.distinctivenessReport.clichesAvoided,
        clichesDetected:  result.distinctivenessReport.clichesDetected,
        signatureElement: result.distinctivenessReport.signatureElement,
        critiqueSummary:  result.distinctivenessReport.critiqueSummary,
        recommendations:  result.distinctivenessReport.recommendations,
        revisionCount:    result.revisionCount,
      },

      durationMs: result.durationMs,
    });

  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
