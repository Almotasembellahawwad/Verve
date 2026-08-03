// =========================================================
// app/api/compare/route.ts
// Compare Mode: "Plain LLM" vs "Verve Pipeline" — parallel execution
//
// The baseline call sends a simple, unenhanced prompt to the same model
// the user chose — this is exactly what they'd get from ChatGPT/Claude
// without Verve. The Verve call runs the full 6-step pipeline.
// Both run in parallel via Promise.allSettled for resilience.
// =========================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdapter } from "@/lib/llm-adapter";
import { runPipeline } from "@/lib/engine/pipeline";
import { runBlocklistFilter } from "@/lib/engine/blocklist-filter";
import type { Provider } from "@/lib/llm-adapter/types";

export const maxDuration = 120;

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
  try {
    const body = await req.json();
    const {
      brief,
      framework = "nextjs",
      provider = "anthropic",
      apiKey,
      model,
    } = body as {
      brief: string;
      framework: string;
      provider: Provider;
      apiKey: string;
      model?: string;
    };

    if (!apiKey) {
      return NextResponse.json({ error: "API key required", code: "NO_API_KEY" }, { status: 401 });
    }
    if (!brief?.trim() || brief.length < 10) {
      return NextResponse.json({ error: "Brief too short" }, { status: 400 });
    }

    const adapter = createAdapter(provider, apiKey, model);

    // ── Run both in parallel ──────────────────────────────────────────────
    const [baselineResult, verveResult] = await Promise.allSettled([
      // 1. Baseline: plain LLM, no pipeline
      adapter.complete(
        [{ role: "user", content: buildBaselinePrompt(brief, framework) }],
        { systemPrompt: BASELINE_SYSTEM, temperature: 0.8, maxTokens: 4000 }
      ),

      // 2. Verve: full 6-step pipeline
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
        error: baselineResult.reason?.message ?? "Baseline failed",
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
        code: "// Verve pipeline failed",
        score: 0,
        grade: "D",
        clichesAvoided: [],
        clichesDetected: [],
        plan: null,
        signatureElement: "",
        revisionCount: 0,
        error: verveResult.reason?.message ?? "Verve pipeline failed",
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

    return NextResponse.json({ baseline, verve, delta, provider, model: model ?? "default" });
  } catch (err) {
    console.error("[/api/compare]", err);
    const message = err instanceof Error ? err.message : "Compare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
