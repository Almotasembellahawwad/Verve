import { analyzeBrief, type BriefAnalysis } from "./brief-analyzer";
import { runBlocklistFilter, type BlocklistResult } from "./blocklist-filter";
import { generateDesignPlan, type DesignPlan } from "./plan-generator";
import { runSelfCritique, formatCritiqueForRegeneration, type CritiqueResult } from "./critique-loop";
import { generateCode, type GeneratedCode } from "./code-generator";
import { generateDistinctivenessReport, type DistinctivenessReport } from "./scorer";
import { createAdapter, resetLLMAdapter } from "../llm-adapter";
import type { Provider } from "../llm-adapter/types";

export type PipelineResult = {
  briefAnalysis: BriefAnalysis;
  blocklistResult: BlocklistResult;
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
  } = input;

  // Inject user-provided API key into the legacy singleton
  // (legacy engine modules still use getLLMAdapter() internally)
  if (apiKey) {
    // Set env var so legacy getLLMAdapter() picks it up
    process.env.ANTHROPIC_API_KEY  = provider === "anthropic" ? apiKey : (process.env.ANTHROPIC_API_KEY ?? "");
    process.env.OPENAI_API_KEY     = provider === "openai"    ? apiKey : (process.env.OPENAI_API_KEY ?? "");
    process.env.GOOGLE_AI_API_KEY  = provider === "gemini"    ? apiKey : (process.env.GOOGLE_AI_API_KEY ?? "");
    // Reset cached singleton so it picks up new provider/key on next call
    resetLLMAdapter();
  }

  // Expose createAdapter for future per-module migration
  const _adapter = apiKey ? createAdapter(provider, apiKey, model) : null;
  void _adapter; // will be used when engine modules are migrated to accept adapter param

  // Step 1: Brief Analysis
  const briefAnalysis = await analyzeBrief(brief, existingCode);

  // Step 2: Blocklist Filter
  const blocklistResult = runBlocklistFilter(brief, existingCode);

  // Steps 3 + 4: Design Plan + Self-Critique loop
  let designPlan: DesignPlan;
  let finalCritique: CritiqueResult;
  let revisionCount = 0;
  let previousCritique: string | undefined;

  // Initial plan generation
  designPlan = await generateDesignPlan(briefAnalysis, blocklistResult.systemPromptInjection, previousCritique);
  finalCritique = await runSelfCritique(designPlan, briefAnalysis);

  // Revision loop (cap at maxRevisions)
  while (!finalCritique.passed && revisionCount < maxRevisions) {
    revisionCount++;
    previousCritique = formatCritiqueForRegeneration(finalCritique);
    designPlan = await generateDesignPlan(
      briefAnalysis,
      blocklistResult.systemPromptInjection,
      previousCritique
    );
    finalCritique = await runSelfCritique(designPlan, briefAnalysis);
  }

  // Step 5: Code Generation
  const generatedCode = await generateCode(
    briefAnalysis,
    designPlan,
    blocklistResult.systemPromptInjection,
    framework
  );

  // Step 6: Distinctiveness Report
  const distinctivenessReport = generateDistinctivenessReport(
    blocklistResult,
    designPlan,
    finalCritique,
    revisionCount
  );

  return {
    briefAnalysis,
    blocklistResult,
    designPlan,
    finalCritique,
    generatedCode,
    distinctivenessReport,
    revisionCount,
    durationMs: Date.now() - start,
  };
}
