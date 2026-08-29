import type { ProgressPublisherPort } from "../ports/progress";
import { NullProgressPublisher } from "../ports/progress";

export interface PipelineStage<TContext extends object> {
  readonly id: string;
  readonly name?: string;
  readonly module?: string;
  execute(context: Readonly<TContext>): Promise<Partial<TContext>>;
}

/**
 * Chain of Responsibility runner. A stage receives an immutable snapshot and
 * returns only its output patch, so stages cannot mutate each other's state.
 */
export async function executePipelineStages<TContext extends object>(
  stages: readonly PipelineStage<TContext>[],
  initial: TContext,
  progress: ProgressPublisherPort = new NullProgressPublisher()
): Promise<TContext> {
  let context = { ...initial };
  for (const stage of stages) {
    const metadata = {
      id: stage.id,
      ...(stage.name ? { name: stage.name } : {}),
      ...(stage.module ? { module: stage.module } : {}),
    };
    progress.publish({ event: "stage_start", stageId: stage.id, data: metadata });
    const output = await stage.execute(Object.freeze({ ...context }));
    context = { ...context, ...output };
    progress.publish({ event: "stage_done", stageId: stage.id, data: metadata });
  }
  return context;
}
