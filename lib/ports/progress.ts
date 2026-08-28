export type ProgressEvent = {
  event: string;
  data: Record<string, unknown>;
  stageId?: string;
};

/** Observer port; transports decide whether events become SSE, logs, or metrics. */
export interface ProgressPublisherPort {
  publish(event: ProgressEvent): void;
}

export class NullProgressPublisher implements ProgressPublisherPort {
  publish(): void {}
}
