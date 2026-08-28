export type CircuitState = "closed" | "open" | "half-open";

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  failureWindowMs?: number;
  cooldownMs?: number;
  now?: () => number;
};

export class CircuitOpenError extends Error {
  constructor(readonly dependency: string, readonly retryAfterMs: number) {
    super(`${dependency} circuit is open; retry after ${retryAfterMs}ms`);
    this.name = "CircuitOpenError";
  }
}

/** Failure-window circuit breaker owned and injected by the caller. */
export class CircuitBreaker {
  private failures: number[] = [];
  private openedAt: number | null = null;
  private halfOpenProbeInFlight = false;
  private readonly threshold: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(readonly dependency: string, options: CircuitBreakerOptions = {}) {
    this.threshold = Math.max(1, options.failureThreshold ?? 3);
    this.windowMs = Math.max(1, options.failureWindowMs ?? 60_000);
    this.cooldownMs = Math.max(1, options.cooldownMs ?? 30_000);
    this.now = options.now ?? Date.now;
  }

  get state(): CircuitState {
    if (this.openedAt === null) return "closed";
    return this.now() - this.openedAt >= this.cooldownMs ? "half-open" : "open";
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const state = this.state;
    if (state === "open") {
      const elapsed = this.now() - (this.openedAt ?? this.now());
      throw new CircuitOpenError(this.dependency, Math.max(0, this.cooldownMs - elapsed));
    }
    if (state === "half-open" && this.halfOpenProbeInFlight) {
      throw new CircuitOpenError(this.dependency, this.cooldownMs);
    }

    if (state === "half-open") this.halfOpenProbeInFlight = true;
    try {
      const value = await operation();
      this.reset();
      return value;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      this.halfOpenProbeInFlight = false;
    }
  }

  private recordFailure(): void {
    const now = this.now();
    this.failures = this.failures.filter((time) => now - time <= this.windowMs);
    this.failures.push(now);
    if (this.openedAt !== null || this.failures.length >= this.threshold) this.openedAt = now;
  }

  private reset(): void {
    this.failures = [];
    this.openedAt = null;
  }
}

