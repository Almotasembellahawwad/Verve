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
import { analyzeCompetitiveField, type CompetitiveAnalysis }           from "./competitive-field";
import { runRestraintCheck, type RestraintResult }                     from "./restraint-check";  // Module N
import { scoreEngineering, type EngineeringResult }                   from "./engineering-score"; // Dual Scoring
import { createAdapter }                                              from "../llm-adapter";
import type { Provider }                                               from "../llm-adapter/types";


// ── Result type ───────────────────────────────────────────────────────────────
export type PipelineResult = {
  briefAnalysis:          BriefAnalysis;
  blocklistResult:        BlocklistResult;
  assetBundle:            AssetBundle;            // Module H
  competitiveAnalysis:    CompetitiveAnalysis;    // Module L
  archetypeResolution:    ArchetypeResolution;    // Module I
  animationLanguage:      AnimationLanguage;       // Module K
  designPlan:             DesignPlan;
  finalCritique:          CritiqueResult;
  generatedCode:          GeneratedCode;
  distinctivenessReport:  DistinctivenessReport;  // Module J (3-level Norman)
  restraintResult:        RestraintResult;        // Module N (Dieter Rams)
  engineeringResult:      EngineeringResult;      // Dual Scoring — Engineering axis
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

  // -- Create per-request LLM adapter (no singleton, no process.env leak) ----
  if (!apiKey) throw new Error("API key is required");
  const llm = createAdapter(provider, apiKey, model);

  // ── [01] Brief Analysis ──────────────────────────────────────────────────
  const briefAnalysis = await analyzeBrief(llm, brief, existingCode);

  // ── [02] Asset Sourcing + Blocklist + Competitive Field — parallel ─────────
  const [blocklistResult, assetBundle, competitiveAnalysis] = await Promise.all([
    Promise.resolve(runBlocklistFilter(brief, existingCode)),
    sourceAssets(briefAnalysis, pexelsKey),
    Promise.resolve(analyzeCompetitiveField(briefAnalysis)),
  ]);

  // ── [02.5] Brand Archetype Resolution (Module I) ─────────────────────────
  const archetypeResolution = await resolveArchetype(llm, briefAnalysis);

  // ── [02.6] Animation Language (Module K) — synchronous, no LLM call ──────
  const animationLanguage = buildAnimationLanguage(archetypeResolution);

  // ── Build system prompt context for plan generator ───────────────────────
  const archetypeContext  = formatArchetypeForPlanGenerator(archetypeResolution);
  const animationContext  = formatAnimationForCodeGen(animationLanguage);

  const blocklistAndAssetContext = [
    blocklistResult.systemPromptInjection,
    assetBundle.assetSummary,
    competitiveAnalysis.systemPromptInjection,
  ].filter(Boolean).join("\n\n");

  // ── [03] Design Plan + [04] Critique loop ────────────────────────────────
  let designPlan:      DesignPlan;
  let finalCritique:   CritiqueResult;
  let revisionCount  = 0;
  let previousCritique: string | undefined;

  designPlan    = await generateDesignPlan(
    llm,
    briefAnalysis,
    blocklistAndAssetContext,
    previousCritique,
    archetypeContext,
    animationContext
  );
  finalCritique = await runSelfCritique(llm, designPlan, briefAnalysis);

  while (!finalCritique.passed && revisionCount < maxRevisions) {
    revisionCount++;
    previousCritique = formatCritiqueForRegeneration(finalCritique);
    designPlan = await generateDesignPlan(
      llm,
      briefAnalysis,
      blocklistAndAssetContext,
      previousCritique,
      archetypeContext,
      animationContext
    );
    finalCritique = await runSelfCritique(llm, designPlan, briefAnalysis);
  }

  // ── [05] Code Generation ─────────────────────────────────────────────────
  const fullCodeContext = [
    blocklistResult.systemPromptInjection,
    assetBundle.assetSummary,
    archetypeContext,
    animationContext,
  ].filter(Boolean).join("\n\n");

  const generatedCode = await generateCode(
    llm,
    briefAnalysis,
    designPlan,
    fullCodeContext,
    framework
  );

  // -- [N] Restraint Check (Dieter Rams) -- deterministic, no LLM call ------
  const restraintResult = runRestraintCheck({
    colorPalette:      designPlan.colorPalette,
    typePairing:       designPlan.typePairing,
    signatureElement:  designPlan.signatureElement,
    layoutConcept:     designPlan.layoutConcept,
    referencesSampled: designPlan.referencesSampled ?? [],
  });

  // -- [ENG] Engineering Score -- deterministic, no LLM call ----------------
  const engineeringResult = scoreEngineering(
    generatedCode.code,
    (framework as Parameters<typeof scoreEngineering>[1])
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
    competitiveAnalysis,
    archetypeResolution,
    animationLanguage,
    designPlan,
    finalCritique,
    generatedCode,
    distinctivenessReport,
    restraintResult,
    engineeringResult,
    revisionCount,
    durationMs: Date.now() - start,
  };
}
