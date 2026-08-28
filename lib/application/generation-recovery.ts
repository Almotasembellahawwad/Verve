import { isPipelineCheckpoint, type PipelineCheckpoint } from "../engine/pipeline-checkpoint";
import { buildRecoveryProject } from "../project/project-builder";

export function asPipelineCheckpoint(value: unknown): PipelineCheckpoint | undefined {
  return isPipelineCheckpoint(value) ? value : undefined;
}

export function createGenerationRecovery(brief: string, framework: string | undefined, failedStage: string) {
  const target = framework === "react" || framework === "html" ? framework : "nextjs";
  return buildRecoveryProject(brief, target, failedStage);
}
