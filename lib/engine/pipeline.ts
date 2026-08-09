import { analyzeBrief, type BriefAnalysis } from "./brief-analyzer";
import { runBlocklistFilter, type BlocklistResult } from "./blocklist-filter";
import { generateDesignPlan, type DesignPlan } from "./plan-generator";
import { runSelfCritique, formatCritiqueForRegeneration, type CritiqueResult } from "./critique-loop";
import { generateCode, type GeneratedCode } from "./code-generator";
import { generateDistinctivenessReport, type DistinctivenessReport } from "./scorer";
import { sourceAssets, type AssetBundle } from "./asset-sourcer";
import { createAdapter, resetLLMAdapter } from "../llm-adapter";
import type { Provider } from "../llm-adapter/types";

export type PipelineResult = {
  briefAnalysis: BriefAnalysis;
  blocklistResult: BlocklistResult;
  assetBundle: AssetBundle;           // Module H
  designPlan: DesignPlan;
  finalCritique: CritiqueResult;
  generatedCode: GeneratedCode;
  distinctivenessReport: DistinctivenessReport;
  revisionCount: number;
  durationMs: number;
};

export type PipelineInput = {
  brief: string;
  existingCode?: string;
  framework?: string;
  maxRevisions?: number;
  // Multi-provider support
  provider?: Provider;
  apiKey?: string;
  model?: string;
  // Module H
  pexelsKey?: string;
};

const MAX_REVISION_CYCLES = 2;

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const start = Date.now();
  const {
    brief,
    existingCode,
    framework = "nextjs",
    maxRevisions = MAX_REVISION_CYCLES,
    provider = "anthropic",
    apiKey,
    model,
    pexelsKey,
  } = input;

  // Inject user-provided API key into the legacy singleton
  if (apiKey) {
    process.env.ANTHROPIC_API_KEY  = provider === "anthropic" ? apiKey : (process.env.ANTHROPIC_API_KEY ?? "");
    process.env.OPENAI_API_KEY     = provider === "openai"    ? apiKey : (process.env.OPENAI_API_KEY ?? "");
    process.env.GOOGLE_AI_API_KEY  = provider === "gemini"    ? apiKey : (process.env.GOOGLE_AI_API_KEY ?? "");
    resetLLMAdapter();
  }

  const _adapter = apiKey ? createAdapter(provider, apiKey, model) : null;
  void _adapter;

  // ── [01] Brief Analysis ──────────────────────────────────────────────────
  const briefAnalysis = await analyzeBrief(brief, existingCode);

  // ── [02] Asset Sourcing (Module H) — runs in parallel with Blocklist ────
  const [blocklistResult, assetBundle] = await Promise.all([
    Promise.resolve(runBlocklistFilter(brief, existingCode)),
    sourceAssets(briefAnalysis, pexelsKey),
  ]);

  // ── [03] Blocklist injection already done above ──────────────────────────

  // ── [04] Design Plan + [05] Adversarial Critique loop ───────────────────
  let designPlan: DesignPlan;
  let finalCritique: CritiqueResult;
  let revisionCount = 0;
  let previousCritique: string | undefined;

  // Build blocklist injection + asset context for plan generator
  const blocklistAndAssetContext = [
    blocklistResult.systemPromptInjection,
    "",
    assetBundle.assetSummary,
  ].join("\n");

  designPlan = await generateDesignPlan(
    briefAnalysis,
    blocklistAndAssetContext,
    previousCritique
  );
  finalCritique = await runSelfCritique(designPlan, briefAnalysis);

  while (!finalCritique.passed && revisionCount < maxRevisions) {
    revisionCount++;
    previousCritique = formatCritiqueForRegeneration(finalCritique);
    designPlan = await generateDesignPlan(
      briefAnalysis,
      blocklistAndAssetContext,
      previousCritique
    );
    finalCritique = await runSelfCritique(designPlan, briefAnalysis);
  }

  // ── [06] Code Generation ─────────────────────────────────────────────────
  const generatedCode = await generateCode(
    briefAnalysis,
    designPlan,
    blocklistResult.systemPromptInjection,
    framework
  );

  // ── [07] Distinctiveness Report ──────────────────────────────────────────
  const distinctivenessReport = generateDistinctivenessReport(
    blocklistResult,
    designPlan,
    finalCritique,
    revisionCount
  );

  return {
    briefAnalysis,
    blocklistResult,
    assetBundle,
    designPlan,
    finalCritique,
    generatedCode,
    distinctivenessReport,
    revisionCount,
    durationMs: Date.now() - start,
  };
}
