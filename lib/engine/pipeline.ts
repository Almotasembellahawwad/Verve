import { analyzeBrief, type BriefAnalysis } from "./brief-analyzer";
import { runBlocklistFilter, type BlocklistResult } from "./blocklist-filter";
import { generateDesignPlan, type DesignPlan } from "./plan-generator";
import { runSelfCritique, formatCritiqueForRegeneration, type CritiqueResult } from "./critique-loop";
import { generateCode, type GeneratedCode } from "./code-generator";
import { generateDistinctivenessReport, type DistinctivenessReport } from "./scorer";

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
};

const MAX_REVISION_CYCLES = 2;

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const start = Date.now();
  const { brief, existingCode, framework = "nextjs", maxRevisions = MAX_REVISION_CYCLES } = input;

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
