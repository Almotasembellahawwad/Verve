import type { LLMPort, Provider } from "../ports/llm";
import { analyzeBrief, analyzeBriefLocally, type BriefAnalysis } from "../engine/brief-analyzer";
import { resolveArchetype, type ArchetypeResolution } from "../engine/brand-archetype-resolver";
import { critiquePlanLocally, resolveArchetypeLocally } from "../engine/fast-path";
import { runSelfCritique, type CritiqueResult } from "../engine/critique-loop";
import type { DesignPlan, PlanGenerationOptions } from "../engine/plan-generator";
import { runOptionalProviderStep, type OptionalProviderResult } from "../engine/provider-resilience";
import type { CritiqueEvidenceSource } from "../engine/execution-evidence";
import type { GenerationMode } from "../domain/generation-mode";

export type { GenerationMode } from "../domain/generation-mode";

export type BriefStrategyResult = OptionalProviderResult<BriefAnalysis> & {
  source: "local-fast-path" | "provider" | "local-fallback";
};

export interface GenerationStrategy {
  readonly mode: GenerationMode;
  readonly critiqueSource: CritiqueEvidenceSource;
  analyzeBrief(llm: LLMPort, brief: string, existingCode?: string, signal?: AbortSignal): Promise<BriefStrategyResult>;
  resolveArchetype(llm: LLMPort, analysis: BriefAnalysis): Promise<ArchetypeResolution>;
  critique(llm: LLMPort, plan: DesignPlan, analysis: BriefAnalysis, signal?: AbortSignal): Promise<OptionalProviderResult<CritiqueResult>>;
  planOptions(): Required<Pick<PlanGenerationOptions, "timeoutMs" | "reasoningEffort">>;
  allowsRevision(): boolean;
  emitsCheckpoints(): boolean;
  allowsCodeRepair(provider: Provider): boolean;
}

export class FastGenerationStrategy implements GenerationStrategy {
  readonly mode = "fast" as const;
  readonly critiqueSource = "local-preflight" as const;

  async analyzeBrief(_llm: LLMPort, brief: string, existingCode?: string): Promise<BriefStrategyResult> {
    return {
      value: analyzeBriefLocally(brief, existingCode),
      degraded: false,
      source: "local-fast-path",
    };
  }

  async resolveArchetype(_llm: LLMPort, analysis: BriefAnalysis): Promise<ArchetypeResolution> {
    return resolveArchetypeLocally(analysis);
  }

  async critique(_llm: LLMPort, plan: DesignPlan): Promise<OptionalProviderResult<CritiqueResult>> {
    return { value: critiquePlanLocally(plan), degraded: false };
  }

  planOptions() {
    return { timeoutMs: 45_000, reasoningEffort: "low" as const };
  }

  allowsRevision(): boolean { return false; }
  emitsCheckpoints(): boolean { return true; }
  allowsCodeRepair(): boolean { return false; }
}

export class StudioGenerationStrategy implements GenerationStrategy {
  readonly mode = "studio" as const;
  readonly critiqueSource = "provider" as const;

  async analyzeBrief(llm: LLMPort, brief: string, existingCode?: string, signal?: AbortSignal): Promise<BriefStrategyResult> {
    const result = await runOptionalProviderStep(
      () => analyzeBrief(llm, brief, existingCode),
      () => analyzeBriefLocally(brief, existingCode),
      signal
    );
    return { ...result, source: result.degraded ? "local-fallback" : "provider" };
  }

  resolveArchetype(llm: LLMPort, analysis: BriefAnalysis): Promise<ArchetypeResolution> {
    return resolveArchetype(llm, analysis);
  }

  critique(
    llm: LLMPort,
    plan: DesignPlan,
    analysis: BriefAnalysis,
    signal?: AbortSignal
  ): Promise<OptionalProviderResult<CritiqueResult>> {
    return runOptionalProviderStep(
      () => runSelfCritique(llm, plan, analysis, 30_000),
      () => critiquePlanLocally(plan),
      signal
    );
  }

  planOptions() {
    return { timeoutMs: 55_000, reasoningEffort: "medium" as const };
  }

  allowsRevision(): boolean { return true; }
  emitsCheckpoints(): boolean { return false; }
  allowsCodeRepair(provider: Provider): boolean { return provider !== "openrouter"; }
}

export function createGenerationStrategy(mode: GenerationMode): GenerationStrategy {
  return mode === "fast" ? new FastGenerationStrategy() : new StudioGenerationStrategy();
}
