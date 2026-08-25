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
import { runCodeQualityLoop, type CodeQualityResult }             from "./code-quality-loop"; // Phase 3.5
import { fixPaletteContrast, type ContrastFixReport }             from "./contrast-fixer";
import { createAdapter }                                              from "../llm-adapter";
import type { Provider }                                               from "../llm-adapter/types";


// ── Result type ───────────────────────────────────────────────────────────────
export type PipelineResult = {
  briefAnalysis:          BriefAnalysis;
  inputBlocklistResult:   BlocklistResult;
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
  codeQualityResult:      CodeQualityResult;      // Phase 3.5: post-gen repair
  contrastReport:         ContrastFixReport;
  revisionCount:          number;
  durationMs:             number;
};

export type PipelineEvent = {
  event: "stage_start" | "stage_done" | "stage_flag" | "stage_retry";
  data: Record<string, unknown>;
  stageId?: string;
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
  signal?: AbortSignal;
  onEvent?: (event: PipelineEvent) => void;
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
    signal,
    onEvent,
  } = input;

  const emit = (event: PipelineEvent["event"], data: Record<string, unknown>, stageId?: string) => {
    onEvent?.({ event, data, stageId });
  };

  const timer = () => {
    const startedAt = Date.now();
    return () => Date.now() - startedAt;
  };

  // -- Create per-request LLM adapter (no singleton, no process.env leak) ----
  if (!apiKey) throw new Error("API key is required");
  const llm = createAdapter(provider, apiKey, model, signal, (attempt, waitMs, retryModel) => {
    emit("stage_retry", { attempt, waitMs, model: retryModel });
  });

  // ── [01] Brief Analysis ──────────────────────────────────────────────────
  emit("stage_start", { id: "01", name: "Brief Analysis", module: "BriefAnalyzer" }, "01-start");
  let elapsed = timer();
  const briefAnalysis = await analyzeBrief(llm, brief, existingCode);
  emit("stage_done", { id: "01", name: "Brief Analysis", durationMs: elapsed() }, "01-done");

  // ── [02] Asset Sourcing + Blocklist + Competitive Field — parallel ─────────
  emit("stage_start", { id: "02", name: "Asset Sourcing + Blocklist + Competitive Field", module: "H+Blocklist+L" }, "02-start");
  elapsed = timer();
  const [inputBlocklistResult, assetBundle, competitiveAnalysis] = await Promise.all([
    Promise.resolve(runBlocklistFilter(brief, existingCode)),
    sourceAssets(briefAnalysis, pexelsKey),
    Promise.resolve(analyzeCompetitiveField(briefAnalysis)),
  ]);
  emit("stage_done", { id: "02", name: "Asset Sourcing + Blocklist + Competitive", durationMs: elapsed() }, "02-done");

  // ── [02.5] Brand Archetype Resolution (Module I) ─────────────────────────
  emit("stage_start", { id: "02.5", name: "Brand Archetype Resolution", module: "Module I" }, "025-start");
  elapsed = timer();
  const archetypeResolution = await resolveArchetype(llm, briefAnalysis);
  emit("stage_done", {
    id: "02.5",
    name: "Brand Archetype",
    durationMs: elapsed(),
    extra: { archetype: archetypeResolution.primaryArchetype, confidence: archetypeResolution.confidence },
  }, "025-done");

  // ── [02.6] Animation Language (Module K) — synchronous, no LLM call ──────
  emit("stage_start", { id: "02.6", name: "Animation Language", module: "Module K" }, "026-start");
  const animationLanguage = buildAnimationLanguage(archetypeResolution);
  emit("stage_done", {
    id: "02.6",
    name: "Animation Language",
    durationMs: 0,
    extra: { easing: animationLanguage.primaryEasing.name },
  }, "026-done");

  // ── Build system prompt context for plan generator ───────────────────────
  const archetypeContext  = formatArchetypeForPlanGenerator(archetypeResolution);
  const animationContext  = formatAnimationForCodeGen(animationLanguage);

  const blocklistAndAssetContext = [
    inputBlocklistResult.systemPromptInjection,
    assetBundle.assetSummary,
    competitiveAnalysis.systemPromptInjection,
  ].filter(Boolean).join("\n\n");

  // ── [03] Design Plan + [04] Critique loop ────────────────────────────────
  let designPlan:      DesignPlan;
  let finalCritique:   CritiqueResult;
  let revisionCount  = 0;
  let previousCritique: string | undefined;

  emit("stage_start", { id: "03", name: "Design Plan Generation", module: "PlanGenerator + G" }, "03-start");
  elapsed = timer();
  designPlan    = await generateDesignPlan(
    llm,
    briefAnalysis,
    blocklistAndAssetContext,
    previousCritique,
    archetypeContext,
    animationContext
  );
  finalCritique = await runSelfCritique(llm, designPlan, briefAnalysis);
  emit("stage_done", {
    id: "03",
    name: "Design Plan",
    durationMs: elapsed(),
    extra: { signature: designPlan.signatureElement?.name },
  }, "03-done");

  while (!finalCritique.passed && revisionCount < maxRevisions) {
    revisionCount++;
    emit("stage_flag", {
      id: "03",
      name: "Plan Critique",
      reason: `Revision ${revisionCount}: ${finalCritique.flaggedElements[0]?.element ?? "generic default detected"}`,
    });
    emit("stage_start", { id: `03.r${revisionCount}`, name: `Plan Revision ${revisionCount}`, module: "PlanGenerator" });
    elapsed = timer();
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
    emit("stage_done", { id: `03.r${revisionCount}`, name: `Plan Revision ${revisionCount}`, durationMs: elapsed() });
  }

  // ── [04] Contrast enforcement must run for every delivery path ────────────
  emit("stage_start", { id: "04", name: "Contrast Auto-Fix", module: "Module O" }, "04-start");
  const { fixedPalette, report: contrastReport } = fixPaletteContrast(designPlan.colorPalette ?? []);
  if (contrastReport.fixesApplied > 0) {
    designPlan = { ...designPlan, colorPalette: fixedPalette };
  }
  emit("stage_done", {
    id: "04",
    name: "Contrast Auto-Fix",
    durationMs: 0,
    extra: { fixes: contrastReport.fixesApplied, allPass: contrastReport.allPass },
  }, "04-done");

  // ── [05] Code Generation ─────────────────────────────────────────────────
  const fullCodeContext = [
    inputBlocklistResult.systemPromptInjection,
    assetBundle.assetSummary,
    archetypeContext,
    animationContext,
  ].filter(Boolean).join("\n\n");

  emit("stage_start", { id: "05", name: "Code Generation", module: "CodeGenerator" }, "05-start");
  elapsed = timer();
  const generatedCode = await generateCode(
    llm,
    briefAnalysis,
    designPlan,
    fullCodeContext,
    framework
  );
  emit("stage_done", {
    id: "05",
    name: "Code Generation",
    durationMs: elapsed(),
    extra: { lines: generatedCode.code.split("\n").length },
  }, "05-done");

  // -- [3.5] Code Quality Loop — strip fences, check structure, repair if needed
  const signatureStr = designPlan.signatureElement
    ? `${designPlan.signatureElement.name} ${designPlan.signatureElement.description ?? ""}`
    : "";
  emit("stage_start", { id: "05.5", name: "Code Validation & Repair", module: "CodeQualityLoop" }, "055-start");
  elapsed = timer();
  const codeQualityResult = await runCodeQualityLoop(
    llm,
    generatedCode.code,
    signatureStr,
    framework
  );
  emit("stage_done", {
    id: "05.5",
    name: "Code Validation & Repair",
    durationMs: elapsed(),
    extra: { repaired: codeQualityResult.wasRepaired, issues: codeQualityResult.issues.length },
  }, "055-done");

  // Use quality-checked code from this point forward
  const finalCode: typeof generatedCode = {
    ...generatedCode,
    code: codeQualityResult.code,
  };

  // Score the delivered code, not the user's brief/input. The input scan is
  // retained only as generation guidance and prompt-injection context.
  const blocklistResult = runBlocklistFilter(finalCode.code);

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
    finalCode.code,
    (framework as Parameters<typeof scoreEngineering>[1])
  );

  // ── [06] Distinctiveness Report (Module J — 3-level Norman) ─────────────
  emit("stage_start", { id: "06", name: "Distinctiveness Report (Norman 3-Level)", module: "Module J" }, "06-start");
  const distinctivenessReport = generateDistinctivenessReport(
    blocklistResult,
    designPlan,
    finalCritique,
    revisionCount,
    archetypeResolution        // Module J uses archetype for reflective score
  );
  emit("stage_done", {
    id: "06",
    name: "Norman 3-Level Report",
    durationMs: 0,
    extra: { score: distinctivenessReport.score, grade: distinctivenessReport.grade },
  }, "06-done");

  return {
    briefAnalysis,
    inputBlocklistResult,
    blocklistResult,
    assetBundle,
    competitiveAnalysis,
    archetypeResolution,
    animationLanguage,
    designPlan,
    finalCritique,
    generatedCode:    finalCode,
    codeQualityResult,
    contrastReport,
    distinctivenessReport,
    restraintResult,
    engineeringResult,
    revisionCount,
    durationMs: Date.now() - start,
  };
}
