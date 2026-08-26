// =========================================================
// app/api/compare/route.ts
// Compare Mode: "Plain LLM" vs "Verve Pipeline" — parallel execution
//
// The baseline call sends a simple, unenhanced prompt to the same model
// the user chose — this is exactly what they'd get from ChatGPT/Claude
// without Verve. The Verve call runs the Studio pipeline and Project Engine.
// Both run in parallel via Promise.allSettled for resilience.
// =========================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdapter } from "@/lib/llm-adapter";
import { runPipeline } from "@/lib/engine/pipeline";
import { runBlocklistFilter } from "@/lib/engine/blocklist-filter";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { errorResponse, classifyError } from "@/lib/middleware/error-handler";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

export const maxDuration = 120;

const RequestSchema = z.object({
  brief: z.string().min(10).max(5000),
  framework: z.enum(["nextjs", "react", "html"]).default("nextjs"),
  provider: z.enum(["anthropic", "openai", "gemini", "openrouter"]).default("anthropic"),
  apiKey: z.string().min(1).max(500),
  model: z.string().max(100).optional(),
});

// ── Baseline prompt: exactly what any user would send to a generic AI ────────
const BASELINE_SYSTEM = `You are a UI/UX designer. Generate a complete, production-ready landing page component based on the brief provided.`;

function buildBaselinePrompt(brief: string, framework: string): string {
  return `Design a landing page for: ${brief}

Output a complete ${framework === "nextjs" ? "Next.js React" : framework === "react" ? "React" : "HTML/CSS"} component with:
- A hero section with headline, subheading, and CTA button
- A features section (3-4 items)  
- Clean, modern styling
- Professional color scheme

Provide only the code, no explanation.`;
}

// ── Score the baseline output against the blocklist ──────────────────────────
async function scoreBaseline(code: string): Promise<{
  score: number;
  grade: string;
  clichesDetected: string[];
}> {
  const blocklistResult = runBlocklistFilter("", code);
  const high = blocklistResult.matches.filter((m) => m.severity === "high").length;
  const med  = blocklistResult.matches.filter((m) => m.severity === "medium").length;

  let score = 100 - (high * 12) - (med * 5);
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";

  return {
    score,
    grade,
    clichesDetected: blocklistResult.matches.map((m) => m.pattern),
  };
}

export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS["compare"]!);
  if (rateLimited) return rateLimited;

  const requestId = uuidv4();
  const release   = acquireConcurrentSlot(req, ROUTE_LIMITS["compare"]!);

  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST", requestId, details: parsed.error.issues }, { status: 400 });
    }
    const { brief, framework, provider, apiKey, model } = parsed.data;

    const adapter = createAdapter(provider, apiKey, model);

    // ── Run both in parallel ──────────────────────────────────────────────
    const [baselineResult, verveResult] = await Promise.allSettled([
      // 1. Baseline: plain LLM, no pipeline
      adapter.complete(
        [{ role: "user", content: buildBaselinePrompt(brief, framework) }],
        { systemPrompt: BASELINE_SYSTEM, temperature: 0.8, maxTokens: 4000 }
      ),

      // 2. Verve: Studio pipeline + complete project assembly
      runPipeline({ brief, framework, apiKey, provider, model }),
    ]);

    // ── Process baseline ──────────────────────────────────────────────────
    let baseline;
    if (baselineResult.status === "fulfilled") {
      const code = baselineResult.value;
      const scored = await scoreBaseline(code);
      baseline = { code, ...scored, error: null };
    } else {
      baseline = {
        code: "// Baseline generation failed",
        score: 0,
        grade: "D",
        clichesDetected: [],
        error: "BASELINE_FAILED",
      };
    }

    // ── Process Verve result ──────────────────────────────────────────────
    let verve;
    if (verveResult.status === "fulfilled") {
      const r = verveResult.value;
      verve = {
        code: r.generatedCode.code,
        score: r.distinctivenessReport.score,
        grade: r.distinctivenessReport.grade,
        clichesAvoided: r.distinctivenessReport.clichesAvoided,
        clichesDetected: r.distinctivenessReport.clichesDetected,
        plan: r.designPlan,
        signatureElement: r.distinctivenessReport.signatureElement,
        revisionCount: r.revisionCount,
        error: null,
      };
    } else {
      verve = {
        code:            "// Verve pipeline failed",
        score:           0,
        grade:           "D",
        clichesAvoided:  [],
        clichesDetected: [],
        plan:            null,
        signatureElement: "",
        revisionCount:   0,
        // Don't leak internal error message to client
        error: "PIPELINE_FAILED",
      };
    }

    // ── Delta: the documented difference ─────────────────────────────────
    const delta = {
      scoreDelta:          verve.score - baseline.score,
      clichesEliminated:   (baseline.clichesDetected as string[]).filter(
        (c) => !(verve.clichesDetected as string[]).includes(c)
      ).length,
      signatureElement:    verve.signatureElement,
      verdict:
        verve.score > baseline.score
          ? `Verve scored ${verve.score - baseline.score} points higher by eliminating ${baseline.clichesDetected.length} known AI-design clichés.`
          : "Both outputs scored similarly — this brief may already be specific enough to resist generic defaults.",
    };

    return NextResponse.json({ baseline, verve, delta, provider, model: model ?? "default", requestId });
  } catch (err) {
    const { code, status } = classifyError(err);
    return errorResponse(err, code, status, requestId);
  } finally {
    release();
  }
}
