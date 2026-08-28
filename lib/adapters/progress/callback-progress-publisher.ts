import type { ProgressEvent, ProgressPublisherPort } from "../../ports/progress";

export class CallbackProgressPublisher implements ProgressPublisherPort {
  constructor(private readonly callback: (event: ProgressEvent) => void) {}

  publish(event: ProgressEvent): void {
    this.callback(event);
  }
}

