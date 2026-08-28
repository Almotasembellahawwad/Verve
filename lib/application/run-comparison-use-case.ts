import type { LLMPort, Provider } from "../ports/llm";
import { evaluateBlocklist } from "../domain/blocklist";
import {
  runGenerationUseCase,
  type GenerationDependencies,
} from "./run-generation-use-case";

export type ComparisonInput = {
  brief: string;
  framework: "nextjs" | "react" | "html";
  provider: Provider;
  model?: string;
};

export type ComparisonDependencies = {
  baselineLLM: LLMPort;
  generation: GenerationDependencies;
};

const BASELINE_SYSTEM = "You are a UI/UX designer. Generate a complete, production-ready landing page component based on the brief provided.";

function baselinePrompt(brief: string, framework: ComparisonInput["framework"]): string {
  const stack = framework === "nextjs" ? "Next.js React" : framework === "react" ? "React" : "HTML/CSS";
  return `Design a landing page for: ${brief}\n\nOutput a complete ${stack} component with a hero, a concise feature section, a professional color scheme, and only the code.`;
}

function scoreBaseline(code: string, dependencies: GenerationDependencies) {
  const result = evaluateBlocklist(dependencies.blocklistRepository.get(), code);
  const high = result.matches.filter((match) => match.severity === "high").length;
  const medium = result.matches.filter((match) => match.severity === "medium").length;
  const score = Math.max(0, Math.min(100, 100 - high * 12 - medium * 5));
  return {
    score,
    grade: score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D",
    clichesDetected: result.matches.map((match) => match.pattern),
  };
}

export async function runComparisonUseCase(input: ComparisonInput, dependencies: ComparisonDependencies) {
  const [baselineResult, verveResult] = await Promise.allSettled([
    dependencies.baselineLLM.complete(
      [{ role: "user", content: baselinePrompt(input.brief, input.framework) }],
      { systemPrompt: BASELINE_SYSTEM, temperature: 0.8, maxTokens: 4_000 }
    ),
    runGenerationUseCase(input, dependencies.generation),
  ]);

  const baseline = baselineResult.status === "fulfilled"
    ? { code: baselineResult.value, ...scoreBaseline(baselineResult.value, dependencies.generation), error: null }
    : { code: "// Baseline generation failed", score: 0, grade: "D", clichesDetected: [] as string[], error: "BASELINE_FAILED" };

  const verve = verveResult.status === "fulfilled"
    ? {
        code: verveResult.value.generatedCode.code,
        score: verveResult.value.distinctivenessReport.score,
        grade: verveResult.value.distinctivenessReport.grade,
        clichesAvoided: verveResult.value.distinctivenessReport.clichesAvoided,
        clichesDetected: verveResult.value.distinctivenessReport.clichesDetected,
        plan: verveResult.value.designPlan,
        signatureElement: verveResult.value.distinctivenessReport.signatureElement,
        revisionCount: verveResult.value.revisionCount,
        error: null,
      }
    : {
        code: "// Verve pipeline failed",
        score: 0,
        grade: "D",
        clichesAvoided: [] as string[],
        clichesDetected: [] as string[],
        plan: null,
        signatureElement: "",
        revisionCount: 0,
        error: "PIPELINE_FAILED",
      };

  const eliminated = baseline.clichesDetected.filter((pattern) => !verve.clichesDetected.includes(pattern)).length;
  return {
    baseline,
    verve,
    delta: {
      scoreDelta: verve.score - baseline.score,
      clichesEliminated: eliminated,
      signatureElement: verve.signatureElement,
      verdict: verve.score > baseline.score
        ? `Verve scored ${verve.score - baseline.score} points higher and removed ${eliminated} detected defaults.`
        : "Both outputs scored similarly; the brief may already constrain generic defaults.",
    },
    provider: input.provider,
    model: input.model ?? dependencies.generation.defaultModel,
  };
}

