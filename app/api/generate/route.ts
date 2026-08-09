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
  pexelsKey:    z.string().optional(), // Module H — optional asset sourcing
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    const result = await runPipeline({
      ...parsed.data,
      provider,
      apiKey,
      pexelsKey,
    });

    return NextResponse.json({
      plan:              result.designPlan,
      briefAnalysis:     result.briefAnalysis,
      blocklistMatches:  result.blocklistResult.matches,
      assetBundle:       result.assetBundle,             // Module H
      critique: {
        passed:           result.finalCritique.passed,
        flaggedElements:  result.finalCritique.flaggedElements,
        positiveElements: result.finalCritique.positiveElements,
        verdict:          result.finalCritique.overallVerdict,
        transcript:       result.finalCritique.rawCritique,
        // Module G additions
        endingCheck:      result.finalCritique.endingCheck,
        usabilityFloor:   result.finalCritique.usabilityFloor,
        cognitiveScore:   result.finalCritique.cognitiveScore,
        cognitiveFailures: result.finalCritique.cognitiveFailures,
      },
      code:              result.generatedCode,
      distinctivenessReport: result.distinctivenessReport,
      revisionCount:     result.revisionCount,
      durationMs:        result.durationMs,
    });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
