// app/api/generate/stream/route.ts
// Server-Sent Events streaming pipeline
// Emits per-stage progress events so the frontend shows real-time updates
// without a fake progress timer.
//
// Event types:
//   stage_start  { id, name, module }
//   stage_done   { id, name, durationMs }
//   stage_flag   { id, name, reason }    — critique flagged, retrying
//   result       { ...full pipeline result }
//   error        { message }

import { NextRequest } from "next/server";
import { analyzeBrief }                   from "@/lib/engine/brief-analyzer";
import { runBlocklistFilter }              from "@/lib/engine/blocklist-filter";
import { sourceAssets }                    from "@/lib/engine/asset-sourcer";
import { resolveArchetype, formatArchetypeForPlanGenerator } from "@/lib/engine/brand-archetype-resolver";
import { buildAnimationLanguage, formatAnimationForCodeGen } from "@/lib/engine/animation-language";
import { analyzeCompetitiveField }         from "@/lib/engine/competitive-field";
import { generateDesignPlan }              from "@/lib/engine/plan-generator";
import { runSelfCritique, formatCritiqueForRegeneration } from "@/lib/engine/critique-loop";
import { generateCode }                    from "@/lib/engine/code-generator";
import { generateDistinctivenessReport }   from "@/lib/engine/scorer";
import { resetLLMAdapter }                 from "@/lib/llm-adapter";
import type { Provider }                   from "@/lib/llm-adapter/types";
import { z } from "zod";

export const maxDuration = 300;

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
  const body   = await req.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: "Invalid request" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const { brief, existingCode, framework = "nextjs", apiKey, provider = "anthropic", pexelsKey } = parsed.data;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // controller might be closed
        }
      };

      const t = (label: string) => {
        const start = Date.now();
        return () => Date.now() - start;
      };

      try {
        // ── API key setup ────────────────────────────────────────────────
        if (!apiKey) {
          send("error", { message: "No API key provided. Add your API key in the settings." });
          controller.close();
          return;
        }

        process.env.ANTHROPIC_API_KEY = provider === "anthropic" ? apiKey : (process.env.ANTHROPIC_API_KEY ?? "");
        process.env.OPENAI_API_KEY    = provider === "openai"    ? apiKey : (process.env.OPENAI_API_KEY    ?? "");
        process.env.GOOGLE_AI_API_KEY = provider === "gemini"    ? apiKey : (process.env.GOOGLE_AI_API_KEY ?? "");
        resetLLMAdapter();

        const pipelineStart = Date.now();

        // ── [01] Brief Analysis ──────────────────────────────────────────
        send("stage_start", { id: "01", name: "Brief Analysis", module: "BriefAnalyzer" });
        let elapsed = t("01");
        const briefAnalysis = await analyzeBrief(brief, existingCode);
        send("stage_done", { id: "01", name: "Brief Analysis", durationMs: elapsed() });

        // ── [02] Asset Sourcing + Blocklist + Competitive Field — parallel
        send("stage_start", { id: "02", name: "Asset Sourcing + Blocklist + Competitive Field", module: "H+Blocklist+L" });
        elapsed = t("02");
        const [blocklistResult, assetBundle, competitiveAnalysis] = await Promise.all([
          Promise.resolve(runBlocklistFilter(brief, existingCode)),
          sourceAssets(briefAnalysis, pexelsKey),
          Promise.resolve(analyzeCompetitiveField(briefAnalysis)),
        ]);
        send("stage_done", { id: "02", name: "Asset Sourcing + Blocklist + Competitive", durationMs: elapsed() });

        // ── [02.5] Brand Archetype ───────────────────────────────────────
        send("stage_start", { id: "02.5", name: "Brand Archetype Resolution", module: "Module I" });
        elapsed = t("02.5");
        const archetypeResolution = await resolveArchetype(briefAnalysis);
        send("stage_done", { id: "02.5", name: "Brand Archetype", durationMs: elapsed(),
          extra: { archetype: archetypeResolution.primaryArchetype, confidence: archetypeResolution.confidence } });

        // ── [02.6] Animation Language — synchronous ──────────────────────
        send("stage_start", { id: "02.6", name: "Animation Language", module: "Module K" });
        const animationLanguage = buildAnimationLanguage(archetypeResolution);
        send("stage_done", { id: "02.6", name: "Animation Language", durationMs: 0,
          extra: { easing: animationLanguage.primaryEasing.name } });

        // ── Build injection context ──────────────────────────────────────
        const archetypeContext   = formatArchetypeForPlanGenerator(archetypeResolution);
        const animationContext   = formatAnimationForCodeGen(animationLanguage);
        const blocklistAndAssets = [
          blocklistResult.systemPromptInjection,
          assetBundle.assetSummary,
          competitiveAnalysis.systemPromptInjection,
        ].join("\n\n");

        // ── [03+04] Plan + Critique loop ─────────────────────────────────
        let revisionCount      = 0;
        let previousCritique: string | undefined;
        let designPlan;
        let finalCritique;

        send("stage_start", { id: "03", name: "Design Plan Generation", module: "PlanGenerator + G" });
        elapsed = t("03");
        designPlan    = await generateDesignPlan(briefAnalysis, blocklistAndAssets, previousCritique, archetypeContext, animationContext);
        finalCritique = await runSelfCritique(designPlan, briefAnalysis);
        send("stage_done", { id: "03", name: "Design Plan", durationMs: elapsed(),
          extra: { signature: designPlan.signatureElement?.name } });

        while (!finalCritique.passed && revisionCount < 2) {
          revisionCount++;
          send("stage_flag", { id: "03", name: "Plan Critique", reason: `Revision ${revisionCount}: ${finalCritique.flaggedElements[0]?.element ?? "generic default detected"}` });

          send("stage_start", { id: `03.r${revisionCount}`, name: `Plan Revision ${revisionCount}`, module: "PlanGenerator" });
          elapsed = t(`03.r${revisionCount}`);
          previousCritique = formatCritiqueForRegeneration(finalCritique);
          designPlan    = await generateDesignPlan(briefAnalysis, blocklistAndAssets, previousCritique, archetypeContext, animationContext);
          finalCritique = await runSelfCritique(designPlan, briefAnalysis);
          send("stage_done", { id: `03.r${revisionCount}`, name: `Plan Revision ${revisionCount}`, durationMs: elapsed() });
        }

        // ── [05] Code Generation ─────────────────────────────────────────
        send("stage_start", { id: "05", name: "Code Generation", module: "CodeGenerator" });
        elapsed = t("05");
        const generatedCode = await generateCode(
          briefAnalysis, designPlan,
          [blocklistResult.systemPromptInjection, animationContext].join("\n\n"),
          framework
        );
        send("stage_done", { id: "05", name: "Code Generation", durationMs: elapsed(),
          extra: { lines: generatedCode.code.split("\n").length } });

        // ── [06] Distinctiveness Report ──────────────────────────────────
        send("stage_start", { id: "06", name: "Distinctiveness Report (Norman 3-Level)", module: "Module J" });
        const distinctivenessReport = generateDistinctivenessReport(
          blocklistResult, designPlan, finalCritique, revisionCount, archetypeResolution
        );
        send("stage_done", { id: "06", name: "Norman 3-Level Report", durationMs: 0,
          extra: { score: distinctivenessReport.score, grade: distinctivenessReport.grade } });

        // ── Emit full result ─────────────────────────────────────────────
        send("result", {
          briefAnalysis,
          plan: designPlan,
          blocklistMatches: blocklistResult.matches,
          assetBundle,
          competitiveField: {
            industry:    competitiveAnalysis.industry,
            matched:     competitiveAnalysis.matched,
            temperature: competitiveAnalysis.industryTemperature,
            opportunity: competitiveAnalysis.distinctivenessOpportunity,
            patterns:    competitiveAnalysis.patterns.map((p) => p.pattern),
          },
          archetype: {
            id:                archetypeResolution.primaryArchetype,
            name:              archetypeResolution.primaryProfile.name,
            secondaryId:       archetypeResolution.secondaryArchetype,
            confidence:        archetypeResolution.confidence,
            reasoning:         archetypeResolution.reasoning,
            emotionalJob:      archetypeResolution.emotionalJob,
            archetypeConflict: archetypeResolution.archetypeConflict,
          },
          animationLanguage: {
            archetypeId:   animationLanguage.archetypeId,
            primaryEasing: animationLanguage.primaryEasing,
            durations:     animationLanguage.durations,
            codeGenHint:   animationLanguage.codeGenHint,
            cssTokens:     animationLanguage.cssTokens,
            keyframes:     animationLanguage.keyframes,
          },
          critique: {
            passed:            finalCritique.passed,
            flaggedElements:   finalCritique.flaggedElements,
            positiveElements:  finalCritique.positiveElements,
            verdict:           finalCritique.overallVerdict,
            transcript:        finalCritique.rawCritique,
            endingCheck:       finalCritique.endingCheck,
            usabilityFloor:    finalCritique.usabilityFloor,
            cognitiveScore:    finalCritique.cognitiveScore,
            cognitiveFailures: finalCritique.cognitiveFailures,
          },
          code: generatedCode,
          distinctivenessReport: {
            score:             distinctivenessReport.score,
            grade:             distinctivenessReport.grade,
            normanLevels:      distinctivenessReport.normanLevels,
            normanSummary:     distinctivenessReport.normanSummary,
            archetypeId:       distinctivenessReport.archetypeId,
            archetypeCoherence: distinctivenessReport.archetypeCoherence,
            signalNoiseRatio:  distinctivenessReport.signalNoiseRatio,
            cognitiveScore:    distinctivenessReport.cognitiveScore,
            endingQuality:     distinctivenessReport.endingQuality,
            accessibilityPass: distinctivenessReport.accessibilityPass,
            cognitiveBreakdown: distinctivenessReport.cognitiveBreakdown,
            clichesAvoided:    distinctivenessReport.clichesAvoided,
            clichesDetected:   distinctivenessReport.clichesDetected,
            signatureElement:  distinctivenessReport.signatureElement,
            critiqueSummary:   distinctivenessReport.critiqueSummary,
            recommendations:   distinctivenessReport.recommendations,
            revisionCount,
          },
          revisionCount,
          durationMs: Date.now() - pipelineStart,
        });

      } catch (err) {
        const message = err instanceof Error ? err.message : "Pipeline error";
        console.error("[/api/generate/stream]", err);
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
