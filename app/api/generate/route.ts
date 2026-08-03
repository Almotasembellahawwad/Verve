import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/engine/pipeline";
import { z } from "zod";

const RequestSchema = z.object({
  brief: z.string().min(10).max(5000),
  existingCode: z.string().max(20000).optional(),
  framework: z.enum(["nextjs", "react", "html"]).optional().default("nextjs"),
  apiKey: z.string().optional(), // User-provided API key
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

    // If user provides their own API key, inject it into the environment for this request
    if (parsed.data.apiKey) {
      process.env.ANTHROPIC_API_KEY = parsed.data.apiKey;
    }

    // Check that we have an API key (either from env or user-provided)
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error: "No API key configured. Please provide your Anthropic API key in the settings panel.",
          code: "NO_API_KEY",
        },
        { status: 401 }
      );
    }

    const result = await runPipeline(parsed.data);

    return NextResponse.json({
      plan: result.designPlan,
      briefAnalysis: result.briefAnalysis,
      blocklistMatches: result.blocklistResult.matches,
      critique: {
        passed: result.finalCritique.passed,
        flaggedElements: result.finalCritique.flaggedElements,
        positiveElements: result.finalCritique.positiveElements,
        verdict: result.finalCritique.overallVerdict,
        transcript: result.finalCritique.rawCritique,
      },
      code: result.generatedCode,
      distinctivenessReport: result.distinctivenessReport,
      revisionCount: result.revisionCount,
      durationMs: result.durationMs,
    });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
