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

import { analyzeBrief, analyzeBriefLocally, type BriefAnalysis }      from "./brief-analyzer";
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
import { buildGeneratedProject }                                      from "../project/project-builder";
import type { GeneratedProject }                                      from "../project/types";
import { critiquePlanLocally, generateDesignPlanLocally, resolveArchetypeLocally } from "./fast-path";
import { runOptionalProviderStep }                                    from "./provider-resilience";
import {
  checkpointMatchesInput,
  createPipelineCheckpoint,
  type PipelineCheckpoint,
} from "./pipeline-checkpoint";


// ── Result type ───────────────────────────────────────────────────────────────
export type PipelineResult = {
  mode:                   GenerationMode;
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
  project:                GeneratedProject;
};

export type GenerationMode = "fast" | "studio";

export type PipelineEvent = {
  event: "stage_start" | "stage_done" | "stage_flag" | "stage_retry" | "stage_degraded" | "checkpoint";
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
  mode?: GenerationMode;
  checkpoint?: PipelineCheckpoint;
};

// The UI promises one Studio repair pass. More cycles add latency and cost
// without giving code generation enough time inside the route budget.
const MAX_REVISION_CYCLES = 1;

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
    mode          = "studio",
    checkpoint,
  } = input;
  const revisionLimit = Math.min(MAX_REVISION_CYCLES, Math.max(0, maxRevisions));
  const checkpointInput = { brief, existingCode, framework, mode };
  const resumeCheckpoint = checkpointMatchesInput(checkpoint, checkpointInput)
    ? checkpoint
    : undefined;

  let activeStageId = "boot";
  const emit = (event: PipelineEvent["event"], data: Record<string, unknown>, stageId?: string) => {
    if (event === "stage_start" && typeof data.id === "string") activeStageId = data.id;
    onEvent?.({ event, data, stageId });
  };

  const timer = () => {
    const startedAt = Date.now();
    return () => Date.now() - startedAt;
  };

  // -- Create per-request LLM adapter (no singleton, no process.env leak) ----
  if (!apiKey) throw new Error("API key is required");
  const llm = createAdapter(provider, apiKey, model, signal, (attempt, waitMs, retryModel) => {
    emit("stage_retry", { attempt, waitMs, model: retryModel, stageId: activeStageId }, `${activeStageId}-retry-${attempt}`);
  });

  // ── [01] Brief Analysis ──────────────────────────────────────────────────
  emit("stage_start", { id: "01", name: "Brief Analysis", module: "BriefAnalyzer" }, "01-start");
  let elapsed = timer();
  const briefStep = resumeCheckpoint
    ? { value: resumeCheckpoint.briefAnalysis, degraded: false, reason: undefined, source: "checkpoint" as const }
    : mode === "fast"
    ? { value: analyzeBriefLocally(brief, existingCode), degraded: false, reason: undefined, source: "local-fast-path" as const }
    : await runOptionalProviderStep(
      () => analyzeBrief(llm, brief, existingCode),
      () => analyzeBriefLocally(brief, existingCode),
      signal
    ).then((result) => ({ ...result, source: result.degraded ? "local-fallback" as const : "provider" as const }));
  const briefAnalysis = briefStep.value;
  if (briefStep.degraded) {
    emit("stage_degraded", {
      id: "01",
      reason: briefStep.reason,
      message: "Provider analysis was unavailable; Verve extracted a conservative brief locally and continued.",
    }, "01-degraded");
  }
  emit("stage_done", {
    id: "01",
    name: "Brief Analysis",
    durationMs: elapsed(),
    extra: { source: briefStep.source },
  }, "01-done");
  if (mode === "fast") {
    emit("checkpoint", {
      checkpoint: createPipelineCheckpoint({ ...checkpointInput, mode: "fast" }, "01", briefAnalysis),
    }, "checkpoint-01");
  }

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
  const archetypeResolution = mode === "fast"
    ? resolveArchetypeLocally(briefAnalysis)
    : await resolveArchetype(llm, briefAnalysis);
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
  let studioReviewDegraded = false;

  emit("stage_start", { id: "03", name: "Design Plan Generation", module: "PlanGenerator + G" }, "03-start");
  elapsed = timer();
  const resumedPlan = resumeCheckpoint?.completedStage === "04"
    ? resumeCheckpoint.designPlan
    : undefined;
  const planStep = resumedPlan
    ? { value: resumedPlan, degraded: false, reason: undefined }
    : await runOptionalProviderStep(
      () => generateDesignPlan(
        llm,
        briefAnalysis,
        blocklistAndAssetContext,
        previousCritique,
        archetypeContext,
        animationContext,
        {
          timeoutMs: mode === "fast" ? 45_000 : 55_000,
          reasoningEffort: mode === "fast" ? "low" : "medium",
        }
      ),
      () => generateDesignPlanLocally(briefAnalysis),
      signal
    );
  designPlan = planStep.value;
  if (planStep.degraded) {
    studioReviewDegraded = true;
    emit("stage_degraded", {
      id: "03",
      reason: planStep.reason,
      message: "The provider could not return a valid plan; a brief-specific local plan preserved code generation.",
    }, "03-plan-degraded");
  }
  if (mode === "fast") {
    finalCritique = critiquePlanLocally(designPlan);
  } else {
    const review = await runOptionalProviderStep(
      () => runSelfCritique(llm, designPlan, briefAnalysis, 30_000),
      () => critiquePlanLocally(designPlan),
      signal
    );
    finalCritique = review.value;
    studioReviewDegraded = review.degraded;
    if (review.degraded) {
      emit("stage_degraded", {
        id: "03",
        reason: review.reason,
        message: "Remote critique exceeded its budget; deterministic review preserved the run.",
      }, "03-degraded");
    }
  }
  emit("stage_done", {
    id: "03",
    name: "Design Plan",
    durationMs: elapsed(),
    extra: {
      signature: designPlan.signatureElement?.name,
      review: resumedPlan ? "resumed checkpoint" : studioReviewDegraded ? "local fallback" : mode === "fast" ? "fast preflight" : "adversarial",
    },
  }, "03-done");

  while (mode === "studio" && !finalCritique.passed && revisionCount < revisionLimit) {
    revisionCount++;
    emit("stage_flag", {
      id: "03",
      name: "Plan Critique",
      reason: `Revision ${revisionCount}: ${finalCritique.flaggedElements[0]?.element ?? "generic default detected"}`,
    });
    emit("stage_start", { id: `03.r${revisionCount}`, name: `Plan Revision ${revisionCount}`, module: "PlanGenerator" });
    elapsed = timer();
    previousCritique = formatCritiqueForRegeneration(finalCritique);
    const revision = await runOptionalProviderStep(
      () => generateDesignPlan(
        llm,
        briefAnalysis,
        blocklistAndAssetContext,
        previousCritique,
        archetypeContext,
        animationContext,
        { timeoutMs: 45_000, reasoningEffort: "low", allowSchemaRetry: false }
      ),
      () => designPlan,
      signal
    );
    if (revision.degraded) {
      studioReviewDegraded = true;
      emit("stage_degraded", {
        id: `03.r${revisionCount}`,
        reason: revision.reason,
        message: "The optional revision exceeded its budget; the last valid plan was retained.",
      }, `03.r${revisionCount}-degraded`);
      emit("stage_done", {
        id: `03.r${revisionCount}`,
        name: `Plan Revision ${revisionCount}`,
        durationMs: elapsed(),
        extra: { revision: "retained previous valid plan" },
      });
      break;
    }

    designPlan = revision.value;
    const revisedReview = await runOptionalProviderStep(
      () => runSelfCritique(llm, designPlan, briefAnalysis, 25_000),
      () => critiquePlanLocally(designPlan),
      signal
    );
    finalCritique = revisedReview.value;
    studioReviewDegraded ||= revisedReview.degraded;
    if (revisedReview.degraded) {
      emit("stage_degraded", {
        id: `03.r${revisionCount}`,
        reason: revisedReview.reason,
        message: "Remote re-review exceeded its budget; deterministic review accepted the valid revision.",
      }, `03.r${revisionCount}-review-degraded`);
    }
    emit("stage_done", {
      id: `03.r${revisionCount}`,
      name: `Plan Revision ${revisionCount}`,
      durationMs: elapsed(),
      extra: { review: revisedReview.degraded ? "local fallback" : "adversarial" },
    });
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
  if (mode === "fast") {
    emit("checkpoint", {
      checkpoint: createPipelineCheckpoint({ ...checkpointInput, mode: "fast" }, "04", briefAnalysis, designPlan),
    }, "checkpoint-04");
  }

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
    framework,
    mode
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
    framework,
    mode === "studio" && provider !== "openrouter",
    briefAnalysis.rawBrief
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
  if (mode === "fast" && blocklistResult.matches.length > 0) {
    finalCritique = {
      ...finalCritique,
      overallVerdict: `Fast structural preflight passed, but the delivered code contains ${blocklistResult.matches.length} blocked visual pattern${blocklistResult.matches.length === 1 ? "" : "s"}. Resolve them or run Studio for adversarial review.`,
    };
  }

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

  emit("stage_start", { id: "07", name: "Project Assembly", module: "ProjectEngine" }, "07-start");
  const project = buildGeneratedProject(
    finalCode,
    briefAnalysis,
    designPlan,
    codeQualityResult.wasRepaired ? [] : codeQualityResult.issues,
    assetBundle.readinessWarnings
  );
  emit("stage_done", {
    id: "07",
    name: "Project Assembly",
    durationMs: 0,
    extra: { files: project.files.length, readiness: project.readiness.score },
  }, "07-done");

  return {
    mode,
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
    project,
  };
}
