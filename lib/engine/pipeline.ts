/**
 * Compatibility facade. New server entry points import the application use
 * case directly; this path remains so existing extensions do not break.
 */
export {
  runGenerationUseCase as runPipeline,
  type GenerationDependencies,
  type GenerationMode,
  type PipelineEvent,
  type PipelineInput,
  type PipelineResult,
} from "../application/run-generation-use-case";
