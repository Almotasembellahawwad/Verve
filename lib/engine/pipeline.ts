// =========================================================
// lib/engine/pipeline.ts
// Verve Design Pipeline — Full orchestration
//
// Pipeline sequence:
// [01] Brief Analyzer          → BriefAnalysis
// [02] Asset Sourcer (H)       → AssetBundle        ┐ parallel
// [02] Blocklist Filter        → BlocklistResult     ┘
// [02.5] Brand Archetype (I)   → ArchetypeResolution
// [02.6] Animation Language (K)→ AnimationLanguage
// [03] Plan Generator          → DesignPlan          ┐ loop
// [04] Critique Loop           → CritiqueResult      ┘ (max N)
// [05] Code Generator          → GeneratedCode
// [06] Scorer (J)              → DistinctivenessReport
// =========================================================

import { analyzeBrief, type BriefAnalysis }                           from "./brief-analyzer";
import { runBlocklistFilter, type BlocklistResult }                    from "./blocklist-filter";
import { generateDesignPlan, type DesignPlan }                        from "./plan-generator";
import { runSelfCritique, formatCritiqueForRegeneration, type CritiqueResult } from "./critique-loop";
import { generateCode, type GeneratedCode }                            from "./code-generator";
import { generateDistinctivenessReport, type DistinctivenessReport }   from "./scorer";
import { sourceAssets, type AssetBundle }                              from "./asset-sourcer";
import { resolveArchetype, formatArchetypeForPlanGenerator, type ArchetypeResolution } from "./brand-archetype-resolver";
import { buildAnimationLanguage, formatAnimationForCodeGen, type AnimationLanguage } from "./animation-language";
import { createAdapter, resetLLMAdapter }                              from "../llm-adapter";
import type { Provider }                                               from "../llm-adapter/types";

// ── Result type ───────────────────────────────────────────────────────────────
export type PipelineResult = {
  briefAnalysis:          BriefAnalysis;
  blocklistResult:        BlocklistResult;
  assetBundle:            AssetBundle;            // Module H
  archetypeResolution:    ArchetypeResolution;    // Module I
  animationLanguage:      AnimationLanguage;       // Module K
  designPlan:             DesignPlan;
  finalCritique:          CritiqueResult;
  generatedCode:          GeneratedCode;
  distinctivenessReport:  DistinctivenessReport;  // Module J (3-level)
  revisionCount:          number;
  durationMs:             number;
};

// ── Input type ────────────────────────────────────────────────────────────────
export type PipelineInput = {
  brief:        string;
  existingCode?: string;
  framework?:   string;
  maxRevisions?: number;
  // Multi-provider
  provider?: Provider;
  apiKey?:   string;
  model?:    string;
  // Module H
  pexelsKey?: string;
};

const MAX_REVISION_CYCLES = 2;

// ── Main pipeline ─────────────────────────────────────────────────────────────
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const start = Date.now();
  const {
    brief,
    existingCode,
    framework    = "nextjs",
    maxRevisions = MAX_REVISION_CYCLES,
    provider     = "anthropic",
    apiKey,
    model,
    pexelsKey,
  } = input;

  // ── API key injection ────────────────────────────────────────────────────
  if (apiKey) {
    process.env.ANTHROPIC_API_KEY  = provider === "anthropic" ? apiKey : (process.env.ANTHROPIC_API_KEY ?? "");
    process.env.OPENAI_API_KEY     = provider === "openai"    ? apiKey : (process.env.OPENAI_API_KEY    ?? "");
    process.env.GOOGLE_AI_API_KEY  = provider === "gemini"    ? apiKey : (process.env.GOOGLE_AI_API_KEY ?? "");
    resetLLMAdapter();
  }

  const _adapter = apiKey ? createAdapter(provider, apiKey, model) : null;
  void _adapter;

  // ── [01] Brief Analysis ──────────────────────────────────────────────────
  const briefAnalysis = await analyzeBrief(brief, existingCode);

  // ── [02] Asset Sourcing + Blocklist — parallel ───────────────────────────
  const [blocklistResult, assetBundle] = await Promise.all([
    Promise.resolve(runBlocklistFilter(brief, existingCode)),
    sourceAssets(briefAnalysis, pexelsKey),
  ]);

  // ── [02.5] Brand Archetype Resolution (Module I) ─────────────────────────
  const archetypeResolution = await resolveArchetype(briefAnalysis);

  // ── [02.6] Animation Language (Module K) — synchronous, no LLM call ──────
  const animationLanguage = buildAnimationLanguage(archetypeResolution);

  // ── Build system prompt context for plan generator ───────────────────────
  const archetypeContext  = formatArchetypeForPlanGenerator(archetypeResolution);
  const animationContext  = formatAnimationForCodeGen(animationLanguage);

  const blocklistAndAssetContext = [
    blocklistResult.systemPromptInjection,
    "",
    assetBundle.assetSummary,
  ].join("\n");

  // ── [03] Design Plan + [04] Critique loop ────────────────────────────────
  let designPlan:      DesignPlan;
  let finalCritique:   CritiqueResult;
  let revisionCount  = 0;
  let previousCritique: string | undefined;

  designPlan    = await generateDesignPlan(
    briefAnalysis,
    blocklistAndAssetContext,
    previousCritique,
    archetypeContext,
    animationContext
  );
  finalCritique = await runSelfCritique(designPlan, briefAnalysis);

  while (!finalCritique.passed && revisionCount < maxRevisions) {
    revisionCount++;
    previousCritique = formatCritiqueForRegeneration(finalCritique);
    designPlan = await generateDesignPlan(
      briefAnalysis,
      blocklistAndAssetContext,
      previousCritique,
      archetypeContext,
      animationContext
    );
    finalCritique = await runSelfCritique(designPlan, briefAnalysis);
  }

  // ── [05] Code Generation ─────────────────────────────────────────────────
  const generatedCode = await generateCode(
    briefAnalysis,
    designPlan,
    [blocklistResult.systemPromptInjection, animationContext].join("\n\n"),
    framework
  );

  // ── [06] Distinctiveness Report (Module J — 3-level Norman) ─────────────
  const distinctivenessReport = generateDistinctivenessReport(
    blocklistResult,
    designPlan,
    finalCritique,
    revisionCount,
    archetypeResolution        // Module J uses archetype for reflective score
  );

  return {
    briefAnalysis,
    blocklistResult,
    assetBundle,
    archetypeResolution,
    animationLanguage,
    designPlan,
    finalCritique,
    generatedCode,
    distinctivenessReport,
    revisionCount,
    durationMs: Date.now() - start,
  };
}
