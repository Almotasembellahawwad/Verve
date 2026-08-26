export type OptionalProviderResult<T> = {
  value: T;
  degraded: boolean;
  reason?: "timeout" | "provider-unavailable";
};

function fallbackReason(error: unknown): OptionalProviderResult<never>["reason"] {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("timeout") || message.includes("timed out") || message.includes("abort")
    ? "timeout"
    : "provider-unavailable";
}

/** Optional intelligence must improve a run, never prevent delivery. */
export async function runOptionalProviderStep<T>(
  work: () => Promise<T>,
  fallback: () => T,
  signal?: AbortSignal
): Promise<OptionalProviderResult<T>> {
  try {
    return { value: await work(), degraded: false };
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    return { value: fallback(), degraded: true, reason: fallbackReason(error) };
  }
}
