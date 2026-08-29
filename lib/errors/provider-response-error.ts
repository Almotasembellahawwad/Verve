export type ProviderResponseFailure =
  | "failed"
  | "incomplete"
  | "refusal"
  | "empty_output"
  | "malformed_output";

/**
 * A provider completed the network request but did not return an artifact that
 * can safely cross the application boundary.
 */
export class ProviderResponseError extends Error {
  readonly failure: ProviderResponseFailure;

  constructor(message: string, failure: ProviderResponseFailure, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProviderResponseError";
    this.failure = failure;
  }
}
