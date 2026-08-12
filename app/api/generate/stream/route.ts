// app/api/generate/stream/route.ts
// Server-Sent Events streaming pipeline
// Emits per-stage progress events so the frontend shows real-time updates.
//
// Event types:
//   stage_start  { id, name, module }
//   stage_done   { id, name, durationMs, extra? }
//   stage_flag   { id, name, reason }   -- critique flagged, retrying
//   result       { ...full pipeline result }
//   error        { message }
//
// SSE Resume: each event includes an `id:` field (stage ID).
// The client can send Last-Event-ID header to indicate where it left off.
// Stage outputs are included in the final `result` event for client caching.

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
import { fixPaletteContrast }              from "@/lib/engine/contrast-fixer";
import { buildGrainCSS, getGrainCodeHint } from "@/lib/engine/grain-texture";
import { selectFontsForArchetype }         from "@/lib/engine/fonts-intelligence";
import { resetLLMAdapter }                 from "@/lib/llm-adapter";
import type { Provider }                   from "@/lib/llm-adapter/types";
import { z } from "zod";

export const maxDuration = 300;

const RequestSchema = z.object({
  brief:        z.string().min(10).max(5000),
  existingCode: z.string().max(20000).optional(),
  framework:    z.enum(["nextjs", "react", "html"]).optional().default("nextjs"),
  apiKey:       z.string().optional(),
  provider:     z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
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
  let   eventSeq = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // SSE event sender -- includes id: field for Last-Event-ID support
      const send = (event: string, data: unknown, stageId?: string) => {
        try {
          const id = stageId ?? String(++eventSeq);
          controller.enqueue(
            encoder.encode(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // controller might be closed
        }
      };

      const t = (_label: string) => {
        const start = Date.now();
        return () => Date.now() - start;
      };

      try {
        // -- API key setup -------------------------------------------------------
        if (!apiKey) {
          send("error", { message: "No API key provided. Add your API key in the settings." });
          controller.close();
          return;
        }

        process.env.ANTHROPIC_API_KEY  = provider === "anthropic"  ? apiKey : (process.env.ANTHROPIC_API_KEY  ?? "");
        process.env.OPENAI_API_KEY     = provider === "openai"     ? apiKey : (process.env.OPENAI_API_KEY     ?? "");
        process.env.GOOGLE_AI_API_KEY  = provider === "gemini"     ? apiKey : (process.env.GOOGLE_AI_API_KEY  ?? "");
        process.env.OPENROUTER_API_KEY = provider === "openrouter" ? apiKey : (process.env.OPENROUTER_API_KEY ?? "");
        resetLLMAdapter();

        const pipelineStart = Date.now();

        // -- [01] Brief Analysis -------------------------------------------------
        send("stage_start", { id: "01", name: "Brief Analysis", module: "BriefAnalyzer" }, "01-start");
        let elapsed = t("01");
        const briefAnalysis = await analyzeBrief(brief, existingCode);
        send("stage_done", { id: "01", name: "Brief Analysis", durationMs: elapsed() }, "01-done");

        // -- [02] Asset Sourcing + Blocklist + Competitive Field - parallel -------
        send("stage_start", { id: "02", name: "Asset Sourcing + Blocklist + Competitive Field", module: "H+Blocklist+L" }, "02-start");
        elapsed = t("02");
        const [blocklistResult, assetBundle, competitiveAnalysis] = await Promise.all([
          Promise.resolve(runBlocklistFilter(brief, existingCode)),
          sourceAssets(briefAnalysis, pexelsKey),
          Promise.resolve(analyzeCompetitiveField(briefAnalysis)),
        ]);
        send("stage_done", { id: "02", name: "Asset Sourcing + Blocklist + Competitive", durationMs: elapsed() }, "02-done");

        // -- [02.5] Brand Archetype ----------------------------------------------
        send("stage_start", { id: "02.5", name: "Brand Archetype Resolution", module: "Module I" }, "025-start");
        elapsed = t("02.5");
        const archetypeResolution = await resolveArchetype(briefAnalysis);
        send("stage_done", { id: "02.5", name: "Brand Archetype", durationMs: elapsed(),
          extra: { archetype: archetypeResolution.primaryArchetype, confidence: archetypeResolution.confidence } }, "025-done");

        // -- [02.6] Animation Language - synchronous -----------------------------
        send("stage_start", { id: "02.6", name: "Animation Language", module: "Module K" }, "026-start");
        const animationLanguage = buildAnimationLanguage(archetypeResolution);
        send("stage_done", { id: "02.6", name: "Animation Language", durationMs: 0,
          extra: { easing: animationLanguage.primaryEasing.name } }, "026-done");

        // -- [02.7] Material Texture + Font Intelligence - synchronous -----------
        send("stage_start", { id: "02.7", name: "Material Texture + Font Intelligence", module: "Module P+Q" }, "027-start");
        const grainCSS    = buildGrainCSS(archetypeResolution.primaryArchetype);
        const grainHint   = getGrainCodeHint(archetypeResolution.primaryArchetype);
        const fontResult  = await selectFontsForArchetype(
          archetypeResolution.primaryArchetype,
          archetypeResolution.primaryProfile?.name // pass archetype name as font context
        );
        send("stage_done", { id: "02.7", name: "Material + Fonts", durationMs: 0,
          extra: { material: grainCSS.materialName, display: fontResult.display.family } }, "027-done");

        // -- Build injection context ---------------------------------------------
        const archetypeContext   = formatArchetypeForPlanGenerator(archetypeResolution);
        const animationContext   = formatAnimationForCodeGen(animationLanguage);
        const blocklistAndAssets = [
          blocklistResult.systemPromptInjection,
          assetBundle.assetSummary,
          competitiveAnalysis.systemPromptInjection,
        ].join("\n\n");

        // Font + grain hints for code generator
        const materialContext = [
          grainHint,
          `FONTS: ${fontResult.rationale}`,
          `FONT IMPORT: ${fontResult.importBlock.split("\n")[0]}`,
          `Display font: ${fontResult.display.family} (${fontResult.display.fallback})`,
          `Body font: ${fontResult.body.family} (${fontResult.body.fallback})`,
        ].join("\n");

        // -- [03+04] Plan + Critique loop ----------------------------------------
        let revisionCount      = 0;
        let previousCritique: string | undefined;
        let designPlan;
        let finalCritique;

        send("stage_start", { id: "03", name: "Design Plan Generation", module: "PlanGenerator + G" }, "03-start");
        elapsed = t("03");
        designPlan    = await generateDesignPlan(briefAnalysis, blocklistAndAssets, previousCritique, archetypeContext, animationContext);
        finalCritique = await runSelfCritique(designPlan, briefAnalysis);
        send("stage_done", { id: "03", name: "Design Plan", durationMs: elapsed(),
          extra: { signature: designPlan.signatureElement?.name } }, "03-done");

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

        // -- [04] Contrast Auto-Fix (Module O) - synchronous -------------------
        send("stage_start", { id: "04", name: "Contrast Auto-Fix", module: "Module O" }, "04-start");
        const { fixedPalette, report: contrastReport } = fixPaletteContrast(
          designPlan.colorPalette ?? []
        );
        // Apply fixes back to designPlan
        if (contrastReport.fixesApplied > 0) {
          designPlan = { ...designPlan, colorPalette: fixedPalette };
        }
        send("stage_done", { id: "04", name: "Contrast Auto-Fix", durationMs: 0,
          extra: { fixes: contrastReport.fixesApplied, allPass: contrastReport.allPass } }, "04-done");

        // -- [05] Code Generation -----------------------------------------------
        send("stage_start", { id: "05", name: "Code Generation", module: "CodeGenerator" }, "05-start");
        elapsed = t("05");
        const generatedCode = await generateCode(
          briefAnalysis, designPlan,
          [blocklistResult.systemPromptInjection, animationContext, materialContext].join("\n\n"),
          framework
        );
        send("stage_done", { id: "05", name: "Code Generation", durationMs: elapsed(),
          extra: { lines: generatedCode.code.split("\n").length } }, "05-done");

        // -- [06] Distinctiveness Report ----------------------------------------
        send("stage_start", { id: "06", name: "Distinctiveness Report (Norman 3-Level)", module: "Module J" }, "06-start");
        const distinctivenessReport = generateDistinctivenessReport(
          blocklistResult, designPlan, finalCritique, revisionCount, archetypeResolution
        );
        send("stage_done", { id: "06", name: "Norman 3-Level Report", durationMs: 0,
          extra: { score: distinctivenessReport.score, grade: distinctivenessReport.grade } }, "06-done");

        // -- Emit full result ---------------------------------------------------
        send("result", {
          briefAnalysis,
          plan: { ...designPlan, colorPalette: fixedPalette },
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
          // Module P -- Physical Grain Texture
          grainTexture: {
            materialName:        grainCSS.materialName,
            description:         grainCSS.description,
            cssVars:             grainCSS.cssVars,
            pseudoElementRule:   grainCSS.pseudoElementRule,
          },
          // Module Q -- Font Intelligence
          fontIntelligence: {
            display:     fontResult.display,
            body:        fontResult.body,
            mono:        fontResult.mono,
            importBlock: fontResult.importBlock,
            rationale:   fontResult.rationale,
          },
          // Module O -- Contrast Report
          contrastReport: {
            fixesApplied: contrastReport.fixesApplied,
            allPass:      contrastReport.allPass,
            checks:       contrastReport.checked,
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
        }, "result");

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
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-store",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
