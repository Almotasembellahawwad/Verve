import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/engine/pipeline";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { errorResponse, classifyError } from "@/lib/middleware/error-handler";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 120;

const RequestSchema = z.object({
  brief:        z.string().min(10).max(5000),
  existingCode: z.string().max(20000).optional(),
  framework:    z.enum(["nextjs", "react", "html"]).optional().default("nextjs"),
  apiKey:       z.string().min(1),
  provider:     z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model:        z.string().optional(),
  pexelsKey:    z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS["generate"]!);
  if (rateLimited) return rateLimited;

  const requestId = uuidv4();
  const release   = acquireConcurrentSlot(req, ROUTE_LIMITS["generate"]!);

  try {
    const body   = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", requestId, details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { apiKey, provider = "anthropic", pexelsKey } = parsed.data;
    const result = await runPipeline({ ...parsed.data, provider, apiKey, pexelsKey });

    return NextResponse.json({
      plan:             result.designPlan,
      briefAnalysis:    result.briefAnalysis,
      blocklistMatches: result.blocklistResult.matches,
      assetBundle:      result.assetBundle,
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
      animationLanguage: {
        archetypeId:   result.animationLanguage.archetypeId,
        primaryEasing: result.animationLanguage.primaryEasing,
        durations:     result.animationLanguage.durations,
        codeGenHint:   result.animationLanguage.codeGenHint,
        cssTokens:     result.animationLanguage.cssTokens,
        keyframes:     result.animationLanguage.keyframes,
      },
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
      code: result.generatedCode,
      distinctivenessReport: {
        score:              result.distinctivenessReport.score,
        grade:              result.distinctivenessReport.grade,
        normanLevels:       result.distinctivenessReport.normanLevels,
        normanSummary:      result.distinctivenessReport.normanSummary,
        archetypeId:        result.distinctivenessReport.archetypeId,
        archetypeCoherence: result.distinctivenessReport.archetypeCoherence,
        signalNoiseRatio:   result.distinctivenessReport.signalNoiseRatio,
        cognitiveScore:     result.distinctivenessReport.cognitiveScore,
        endingQuality:      result.distinctivenessReport.endingQuality,
        accessibilityPass:  result.distinctivenessReport.accessibilityPass,
        cognitiveBreakdown: result.distinctivenessReport.cognitiveBreakdown,
        clichesAvoided:     result.distinctivenessReport.clichesAvoided,
        clichesDetected:    result.distinctivenessReport.clichesDetected,
        signatureElement:   result.distinctivenessReport.signatureElement,
        critiqueSummary:    result.distinctivenessReport.critiqueSummary,
        recommendations:    result.distinctivenessReport.recommendations,
        revisionCount:      result.revisionCount,
      },
      durationMs: result.durationMs,
    });

  } catch (err) {
    const { code, status } = classifyError(err);
    return errorResponse(err, code, status, requestId);
  } finally {
    release();
  }
}
