// =========================================================
// lib/application/run-generation-use-case.ts
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

import type { BriefAnalysis }                                        from "../engine/brief-analyzer";
import { evaluateBlocklist, type BlocklistResult }                     from "../domain/blocklist";
import { generateDesignPlan, type DesignPlan }                        from "../engine/plan-generator";
import { formatCritiqueForRegeneration, type CritiqueResult } from "../engine/critique-loop";
import { generateCode, generatedSourceText, type GeneratedCode }       from "../engine/code-generator";
import { generateDistinctivenessReport, type DistinctivenessReport }   from "../engine/scorer";
import type { AssetBundle }                                            from "../engine/asset-sourcer";
import { formatArchetypeForPlanGenerator, type ArchetypeResolution } from "../engine/brand-archetype-resolver";
import { buildAnimationLanguage, formatAnimationForCodeGen, type AnimationLanguage } from "../engine/animation-language";
import { analyzeCompetitiveField, type CompetitiveAnalysis }           from "../engine/competitive-field";
import { runRestraintCheck, type RestraintResult }                     from "../engine/restraint-check";
import { scoreEngineering, type EngineeringResult }                   from "../engine/engineering-score";
import { inspectSupportingSource, runCodeQualityLoop, type CodeQualityResult } from "../engine/code-quality-loop";
import { fixPaletteContrast, type ContrastFixReport }             from "../engine/contrast-fixer";
import type { BrandProfile, OwnedAssetManifest } from "../project/brand-kit";
import { inspectDesignDiversity, type DesignDiversityResult } from "../engine/design-diversity";
import { buildGeneratedProject }                                      from "../project/project-builder";
import type { GeneratedProject }                                      from "../project/types";
import { inspectAssetUsage, type AssetUsageEvidence } from "../engine/asset-usage";
import { inspectVisualIntentSource, type VisualIntentSourceEvidence } from "../engine/visual-intent";
import {
  buildExecutionEvidence,
  type CritiqueEvidenceSource,
  type ExecutionEvidence,
  type PipelineDegradation,
} from "../engine/execution-evidence";
import { critiquePlanLocally, generateDesignPlanLocally } from "../engine/fast-path";
import { runOptionalProviderStep }                                    from "../engine/provider-resilience";
import {
  checkpointMatchesInput,
  createPipelineCheckpoint,
  type PipelineCheckpoint,
} from "../engine/pipeline-checkpoint";
import { createGenerationStrategy, type GenerationMode } from "./generation-strategy";
import { DEFAULT_GENERATION_MODE } from "../domain/generation-mode";
import type { LLMPort, Provider } from "../ports/llm";
import type { AssetSourcePort } from "../ports/assets";
import type { AssetDeliveryPort } from "../ports/assets";
import { deliverGeneratedAssets, type AssetDeliveryReceipt } from "../engine/asset-delivery";
import type { BlocklistRepositoryPort, ReferenceLibraryRepositoryPort } from "../ports/repositories";
import { NullProgressPublisher, type ProgressPublisherPort } from "../ports/progress";
import type { VerveProjectSpec } from "../domain/project-spec";
import type { DesignDirectionFingerprint, DirectionDiversityAssessment } from "../domain/design-direction";
import { runGenerationFoundationStages } from "./generation-foundation-stages";
import type { DirectionBoard, DirectionCheckpoint } from "../domain/design-direction";
import { buildPlanFromDirectionBoard, createDirectionCheckpoint, directionCheckpointMatches, generateDirectionBoard } from "../engine/direction-board";


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
  projectSpec:            VerveProjectSpec;
  directionDiversity:     DirectionDiversityAssessment;
  directionBoard?:        DirectionBoard;
  finalCritique:          CritiqueResult;
  generatedCode:          GeneratedCode;
  distinctivenessReport:  DistinctivenessReport;  // Module J (3-level Norman)
  restraintResult:        RestraintResult;        // Module N (Dieter Rams)
  engineeringResult:      EngineeringResult;      // Dual Scoring — Engineering axis
  diversityResult:        DesignDiversityResult;  // Cross-industry house-template gate
  assetUsage:             AssetUsageEvidence;
  visualIntentSource:     VisualIntentSourceEvidence;
  assetDelivery:          AssetDeliveryReceipt;
  execution:              ExecutionEvidence;
  codeQualityResult:      CodeQualityResult;      // Phase 3.5: post-gen repair
  contrastReport:         ContrastFixReport;
  revisionCount:          number;
  durationMs:             number;
  project:                GeneratedProject;
};

export type { GenerationMode } from "./generation-strategy";

export type PipelineEvent = {
  event: "stage_start" | "stage_done" | "stage_flag" | "stage_retry" | "stage_degraded" | "checkpoint" | "diversity:check" | "diversity:retry";
  data: Record<string, unknown>;
  stageId?: string;
};

// ── Input type ────────────────────────────────────────────────────────────────
export type PipelineInput = {
  brief:        string;
  existingCode?: string;
  framework?:   string;
  maxRevisions?: number;
  provider?: Provider;
  model?:    string;
  brandProfile?: BrandProfile;
  ownedAssets?: OwnedAssetManifest[];
  signal?: AbortSignal;
  mode?: GenerationMode;
  checkpoint?: PipelineCheckpoint;
  directionCheckpoint?: DirectionCheckpoint;
  selectedDirectionId?: string;
  recentDirectionFingerprints?: DesignDirectionFingerprint[];
};

export type GenerationDependencies = {
  llm: LLMPort;
  assetSource: AssetSourcePort;
  assetDelivery?: AssetDeliveryPort;
  blocklistRepository: BlocklistRepositoryPort;
  referenceLibraryRepository: ReferenceLibraryRepositoryPort;
  defaultModel: string;
  progress?: ProgressPublisherPort;
  resolvedModel?: () => string;
};

// The UI promises one Creative repair pass. More cycles add latency and cost
// without giving code generation enough time inside the route budget.
const MAX_REVISION_CYCLES = 1;

// ── Main pipeline ─────────────────────────────────────────────────────────────
export async function runGenerationUseCase(
  input: PipelineInput,
  dependencies: GenerationDependencies
): Promise<PipelineResult> {
  const start = Date.now();
  const {
    brief,
    existingCode,
    framework    = "nextjs",
    maxRevisions = MAX_REVISION_CYCLES,
    provider     = "anthropic",
    model,
    brandProfile,
    ownedAssets = [],
    signal,
    mode          = DEFAULT_GENERATION_MODE,
    checkpoint,
    directionCheckpoint,
    selectedDirectionId,
    recentDirectionFingerprints = [],
  } = input;
  const revisionLimit = Math.min(MAX_REVISION_CYCLES, Math.max(0, maxRevisions));
  const strategy = createGenerationStrategy(mode);
  const llm = dependencies.llm;
  const progress = dependencies.progress ?? new NullProgressPublisher();
  const brandContext = JSON.stringify({ brandProfile, ownedAssets });
  const directionBrandContext = brandProfile ? JSON.stringify(brandProfile) : undefined;
  const checkpointInput = { brief, existingCode, framework, mode, brandContext };
  const resumeCheckpoint = checkpointMatchesInput(checkpoint, checkpointInput)
    ? checkpoint
    : undefined;
  const validDirectionCheckpoint = directionCheckpointMatches(directionCheckpoint, {
    brief,
    framework,
    mode,
    brandContext: directionBrandContext,
  }) ? directionCheckpoint : undefined;
  let activeDirectionCheckpoint = validDirectionCheckpoint;

  let activeStageId = "boot";
  const degradations: PipelineDegradation[] = [];
  const resolvedModel = model ?? dependencies.defaultModel;
  const emit = (event: PipelineEvent["event"], data: Record<string, unknown>, stageId?: string) => {
    if (event === "stage_start" && typeof data.id === "string") activeStageId = data.id;
    if (event === "stage_degraded") {
      const reason = data.reason === "timeout" || data.reason === "provider-unavailable" ? data.reason : "unknown";
      degradations.push({
        stageId: typeof data.id === "string" ? data.id : activeStageId,
        reason,
        message: typeof data.message === "string" ? data.message : "An optional provider step used its local fallback.",
      });
    }
    progress.publish({ event, data, stageId });
  };

  const timer = () => {
    const startedAt = Date.now();
    return () => Date.now() - startedAt;
  };

  // ── [01] Brief Analysis ──────────────────────────────────────────────────
  emit("stage_start", { id: "01", name: "Brief Analysis", module: "BriefAnalyzer" }, "01-start");
  let elapsed = timer();
  const briefStep = resumeCheckpoint
    ? { value: resumeCheckpoint.briefAnalysis, degraded: false, reason: undefined, source: "checkpoint" as const }
    : await strategy.analyzeBrief(llm, brief, existingCode, signal);
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
  if (strategy.emitsCheckpoints()) {
    emit("checkpoint", {
      checkpoint: createPipelineCheckpoint({ ...checkpointInput, mode: "fast" }, "01", briefAnalysis),
    }, "checkpoint-01");
  }

  // Compatibility path for clients that call generation directly. The board
  // becomes Fast's first model call; its selected plan is then compiled locally.
  // A stage-04 resume already owns a valid plan and skips this exploration.
  if (!activeDirectionCheckpoint && !resumeCheckpoint) {
    emit("stage_start", { id: "01.5", name: "Direction Board", module: "CreativeEngineV3" }, "015-start");
    elapsed = timer();
    const board = await generateDirectionBoard({
      llm,
      analysis: briefAnalysis,
      mode,
      framework,
      referenceRepository: dependencies.referenceLibraryRepository,
      recentDirectionFingerprints,
      brandContext: directionBrandContext,
    });
    activeDirectionCheckpoint = createDirectionCheckpoint(board);
    emit("stage_done", {
      id: "01.5",
      name: "Direction Board",
      durationMs: elapsed(),
      extra: { candidates: board.portfolio.candidates.length, selectedDirectionId: board.portfolio.selectedDirectionId },
    }, "015-done");
  }

  // ── [02] Asset Sourcing + Blocklist + Competitive Field — parallel ─────────
  emit("stage_start", { id: "02", name: "Asset Sourcing + Blocklist + Competitive Field", module: "H+Blocklist+L" }, "02-start");
  elapsed = timer();
  const [inputBlocklistResult, assetBundle, competitiveAnalysis] = await Promise.all([
    Promise.resolve(evaluateBlocklist(dependencies.blocklistRepository.get(), brief, existingCode)),
    dependencies.assetSource.source({ analysis: briefAnalysis, brandProfile, ownedAssets }),
    Promise.resolve(analyzeCompetitiveField(briefAnalysis)),
  ]);
  emit("stage_done", { id: "02", name: "Asset Sourcing + Blocklist + Competitive", durationMs: elapsed() }, "02-done");

  // ── [02.5] Brand Archetype Resolution (Module I) ─────────────────────────
  emit("stage_start", { id: "02.5", name: "Brand Archetype Resolution", module: "Module I" }, "025-start");
  elapsed = timer();
  const archetypeResolution = await strategy.resolveArchetype(llm, briefAnalysis);
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
  let critiqueSource: CritiqueEvidenceSource = strategy.critiqueSource;

  emit("stage_start", { id: "03", name: "Design Plan Generation", module: "PlanGenerator + G" }, "03-start");
  elapsed = timer();
  const resumedPlan = resumeCheckpoint?.completedStage === "04"
    ? resumeCheckpoint.designPlan
    : undefined;
  const boardPlan = activeDirectionCheckpoint
    ? buildPlanFromDirectionBoard(briefAnalysis, activeDirectionCheckpoint.board, selectedDirectionId)
    : undefined;
  const planStep = resumedPlan
    ? { value: resumedPlan, degraded: false, reason: undefined }
    : boardPlan && strategy.mode === "fast"
      ? { value: boardPlan, degraded: false, reason: undefined }
    : await runOptionalProviderStep(
      () => generateDesignPlan(
        llm,
        briefAnalysis,
        blocklistAndAssetContext,
        previousCritique,
        archetypeContext,
        animationContext,
        {
          ...strategy.planOptions(),
          allowSchemaRetry: !activeDirectionCheckpoint,
          referenceRepository: dependencies.referenceLibraryRepository,
          recentDirectionFingerprints,
          directionBoard: activeDirectionCheckpoint?.board,
          selectedDirectionId,
        }
      ),
      () => boardPlan ?? generateDesignPlanLocally(briefAnalysis),
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
  const review = await strategy.critique(llm, designPlan, briefAnalysis, signal);
  finalCritique = review.value;
  studioReviewDegraded ||= review.degraded;
  critiqueSource = review.degraded ? "local-fallback" : strategy.critiqueSource;
  if (review.degraded) {
    emit("stage_degraded", {
      id: "03",
      reason: review.reason,
      message: "Remote critique exceeded its budget; deterministic review preserved the run.",
    }, "03-degraded");
  }
  emit("stage_done", {
    id: "03",
    name: "Design Plan",
    durationMs: elapsed(),
    extra: {
      signature: designPlan.signatureElement?.name,
      review: resumedPlan ? "resumed checkpoint" : studioReviewDegraded ? "local fallback" : strategy.mode === "fast" ? "fast preflight" : "adversarial",
    },
  }, "03-done");

  while (strategy.allowsRevision() && !finalCritique.passed && revisionCount < revisionLimit) {
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
        {
          timeoutMs: 45_000,
          reasoningEffort: "low",
          allowSchemaRetry: false,
          referenceRepository: dependencies.referenceLibraryRepository,
          recentDirectionFingerprints,
          directionBoard: activeDirectionCheckpoint?.board,
          selectedDirectionId,
        }
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
    // One provider critique plus one optional provider revision is the complete
    // Creative review budget. The revised artifact is rechecked locally so the
    // pipeline cannot silently grow beyond its documented seven-call ceiling.
    finalCritique = critiquePlanLocally(designPlan);
    critiqueSource = "local-preflight";
    emit("stage_done", {
      id: `03.r${revisionCount}`,
      name: `Plan Revision ${revisionCount}`,
      durationMs: elapsed(),
      extra: { review: "local verification after provider revision" },
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
  if (strategy.emitsCheckpoints()) {
    emit("checkpoint", {
      checkpoint: createPipelineCheckpoint({ ...checkpointInput, mode: "fast" }, "04", briefAnalysis, designPlan),
    }, "checkpoint-04");
  }

  const foundation = await runGenerationFoundationStages({
    analysis: briefAnalysis,
    designPlan,
    framework,
    mode,
    assetBundle,
    brandProfile,
    ownedAssets,
    recentDirectionFingerprints,
    selectedDirectionLocked: Boolean(activeDirectionCheckpoint),
  }, progress);
  designPlan = foundation.designPlan;
  let projectSpec = foundation.projectSpec;
  const directionDiversity = foundation.directionDiversity;

  // ── [05] Code Generation ─────────────────────────────────────────────────
  const fullCodeContext = [
    inputBlocklistResult.systemPromptInjection,
    assetBundle.assetSummary,
    archetypeContext,
    animationContext,
  ].filter(Boolean).join("\n\n");

  emit("stage_start", { id: "05", name: "Code Generation", module: "CodeGenerator" }, "05-start");
  elapsed = timer();
  let generatedCode = await generateCode(
    llm,
    briefAnalysis,
    designPlan,
    fullCodeContext,
    framework,
    mode,
    projectSpec
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
  let codeQualityResult = await runCodeQualityLoop(
    llm,
    generatedCode.code,
    signatureStr,
    framework,
    strategy.allowsCodeRepair(provider),
    briefAnalysis.rawBrief
  );
  emit("stage_done", {
    id: "05.5",
    name: "Code Validation & Repair",
    durationMs: elapsed(),
    extra: { repaired: codeQualityResult.wasRepaired, issues: codeQualityResult.issues.length },
  }, "055-done");

  // Use quality-checked code from this point forward
  let finalCode: typeof generatedCode = {
    ...generatedCode,
    code: codeQualityResult.code,
    files: generatedCode.files?.map((file) => file.path === generatedCode.entryPath
      ? { ...file, content: codeQualityResult.code }
      : file),
  };
  let diversityResult = inspectDesignDiversity(generatedSourceText(finalCode));
  emit("diversity:check", {
    attempt: 1,
    passed: diversityResult.passed,
    fingerprints: diversityResult.fingerprints,
  }, "diversity-check-1");

  if (strategy.mode === "creative" && !codeQualityResult.wasRepaired && !diversityResult.passed) {
    emit("diversity:retry", {
      attempt: 2,
      reason: diversityResult.recommendation,
      fingerprints: diversityResult.fingerprints,
    }, "diversity-retry");
    const retryStep = await runOptionalProviderStep(
      () => generateCode(
        llm,
        briefAnalysis,
        designPlan,
        `${fullCodeContext}\n\nDIVERSITY RETRY: ${diversityResult.recommendation ?? "Change the opening, content rhythm, interaction model, and ending."} Retain the chosen direction and facts, but do not reproduce: ${diversityResult.fingerprints.join("; ")}.`,
        framework,
        mode,
        projectSpec
      ),
      () => generatedCode,
      signal
    );
    if (!retryStep.degraded) {
      const retryGenerated = retryStep.value;
      const retryQuality = await runCodeQualityLoop(
        llm,
        retryGenerated.code,
        signatureStr,
        framework,
        false,
        briefAnalysis.rawBrief
      );
      generatedCode = retryGenerated;
      codeQualityResult = retryQuality;
      finalCode = {
        ...retryGenerated,
        code: retryQuality.code,
        files: retryGenerated.files?.map((file) => file.path === retryGenerated.entryPath
          ? { ...file, content: retryQuality.code }
          : file),
      };
      diversityResult = inspectDesignDiversity(generatedSourceText(finalCode));
    } else {
      emit("stage_degraded", {
        id: "05.diversity",
        reason: retryStep.reason,
        message: "The optional Creative diversity retry was unavailable; the first preview remains visible but cannot be marked Ready.",
      }, "diversity-retry-degraded");
    }
    emit("diversity:check", {
      attempt: 2,
      passed: diversityResult.passed,
      fingerprints: diversityResult.fingerprints,
    }, "diversity-check-2");
  }
  const supportingIssues = (finalCode.files ?? [])
    .filter((file) => file.path !== finalCode.entryPath)
    .flatMap((file) => inspectSupportingSource(file.content, file.path, framework, briefAnalysis.rawBrief));
  if (supportingIssues.length > 0) {
    codeQualityResult = { ...codeQualityResult, issues: [...codeQualityResult.issues, ...supportingIssues] };
  }
  // Score the delivered code, not the user's brief/input. The input scan is
  // retained only as generation guidance and prompt-injection context.
  const deliveredSource = generatedSourceText(finalCode);
  const blocklistResult = evaluateBlocklist(dependencies.blocklistRepository.get(), deliveredSource);
  if (strategy.mode === "fast" && blocklistResult.matches.length > 0) {
    finalCritique = {
      ...finalCritique,
      overallVerdict: `Fast structural preflight passed, but the delivered code contains ${blocklistResult.matches.length} blocked visual pattern${blocklistResult.matches.length === 1 ? "" : "s"}. Resolve them or run Creative for adversarial review.`,
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
    deliveredSource,
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
  if (diversityResult.scoreCap !== null && distinctivenessReport.score > diversityResult.scoreCap) {
    distinctivenessReport.score = diversityResult.scoreCap;
    distinctivenessReport.grade = distinctivenessReport.score >= 80 ? "A" : distinctivenessReport.score >= 70 ? "B" : "C";
    if (diversityResult.recommendation) distinctivenessReport.recommendations.unshift(diversityResult.recommendation);
    distinctivenessReport.clichesDetected.push(...diversityResult.fingerprints);
  }
  if (critiqueSource !== "provider" && distinctivenessReport.score > 84) {
    distinctivenessReport.score = 84;
    distinctivenessReport.grade = "A";
    distinctivenessReport.recommendations.unshift(
      critiqueSource === "local-preflight"
        ? "Fast mode provides structural evidence only. Run Creative for an adversarial distinctiveness score."
        : "Creative critique used a local fallback, so the score is capped until adversarial review completes."
    );
  }
  emit("stage_done", {
    id: "06",
    name: "Norman 3-Level Report",
    durationMs: 0,
    extra: { score: distinctivenessReport.score, grade: distinctivenessReport.grade },
  }, "06-done");

  emit("stage_start", { id: "07", name: "Project Assembly", module: "ProjectEngine" }, "07-start");
  const delivery = await deliverGeneratedAssets({
    generatedCode: finalCode,
    projectSpec,
    assetBundle,
    sourceBeforeDelivery: deliveredSource,
    deliveryPort: dependencies.assetDelivery,
    signal,
  });
  const deliveredCode = delivery.generatedCode;
  projectSpec = delivery.projectSpec;
  const localizedSource = generatedSourceText(deliveredCode);
  const assetUsage = inspectAssetUsage(assetBundle, deliveredSource, projectSpec.assetDirection, delivery.receipt);
  const visualIntentSource = inspectVisualIntentSource(projectSpec, localizedSource);
  const diversityWarnings = diversityResult.warnings.map((warning) =>
    strategy.mode === "creative" ? `BLOCKING: ${warning}` : warning
  );
  const project = buildGeneratedProject(
    deliveredCode,
    briefAnalysis,
    designPlan,
    codeQualityResult.wasRepaired ? [] : codeQualityResult.issues,
    [...assetBundle.readinessWarnings, ...assetUsage.warnings, ...delivery.receipt.warnings, ...visualIntentSource.warnings, ...directionDiversity.warnings, ...diversityWarnings],
    projectSpec.assetDirection,
    delivery.receipt,
    delivery.files
  );
  emit("stage_done", {
    id: "07",
    name: "Project Assembly",
    durationMs: 0,
    extra: {
      files: project.files.length,
      readiness: project.readiness.score,
      assetDelivery: delivery.receipt.status,
      assetsBundled: delivery.receipt.bundled,
    },
  }, "07-done");

  const execution = buildExecutionEvidence({
    requestedMode: mode,
    provider,
    requestedModel: model ?? dependencies.defaultModel,
    resolvedModel: dependencies.resolvedModel?.() ?? resolvedModel,
    critiqueSource,
    degradations,
  });

  return {
    mode,
    directionBoard: activeDirectionCheckpoint?.board,
    briefAnalysis,
    inputBlocklistResult,
    blocklistResult,
    assetBundle,
    competitiveAnalysis,
    archetypeResolution,
    animationLanguage,
    designPlan,
    projectSpec,
    directionDiversity,
    finalCritique,
    generatedCode:    deliveredCode,
    codeQualityResult,
    contrastReport,
    distinctivenessReport,
    restraintResult,
    engineeringResult,
    diversityResult,
    assetUsage,
    assetDelivery: delivery.receipt,
    visualIntentSource,
    execution,
    revisionCount,
    durationMs: Date.now() - start,
    project,
  };
}
