import type { ProgressEvent, ProgressPublisherPort } from "../../ports/progress";

const SAFE_DATA_KEYS = ["id", "name", "module", "durationMs", "attempt", "waitMs", "model", "stageId"] as const;
const SAFE_EXTRA_KEYS = [
  "source", "archetype", "confidence", "easing", "review", "revision",
  "fixes", "allPass", "lines", "repaired", "issues", "score", "grade",
  "files", "readiness",
] as const;
const SAFE_REASONS = new Set(["timeout", "provider-unavailable", "unknown"]);

function safeExtra(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const entries = SAFE_EXTRA_KEYS.flatMap((key) => {
    const item = source[key];
    return typeof item === "string" || typeof item === "number" || typeof item === "boolean"
      ? [[key, item] as const]
      : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function safeData(data: Record<string, unknown>): Record<string, unknown> {
  const safe = Object.fromEntries(SAFE_DATA_KEYS.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
  if (typeof data.reason === "string" && SAFE_REASONS.has(data.reason)) safe.reason = data.reason;
  const extra = safeExtra(data.extra);
  return extra ? { ...safe, extra } : safe;
}

/** JSON logs designed for Vercel log drains and request reconstruction. */
export class StructuredLogProgressPublisher implements ProgressPublisherPort {
  constructor(private readonly requestId: string) {}

  publish(progress: ProgressEvent): void {
    console.info(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: progress.event === "stage_degraded" ? "warn" : "info",
      event: "generation_progress",
      requestId: this.requestId,
      pipelineEvent: progress.event,
      stageId: progress.stageId ?? progress.data.id ?? "unknown",
      ...safeData(progress.data),
    }));
  }
}

export class CompositeProgressPublisher implements ProgressPublisherPort {
  constructor(private readonly publishers: readonly ProgressPublisherPort[]) {}
  publish(event: ProgressEvent): void { this.publishers.forEach((publisher) => publisher.publish(event)); }
}
