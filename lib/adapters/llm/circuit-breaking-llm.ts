import type { LLMMessage, LLMOptions, LLMPort } from "../../ports/llm";
import { CircuitBreaker } from "../../application/circuit-breaker";

/** Decorator pattern: resilience is added without provider-specific branches. */
export class CircuitBreakingLLMAdapter implements LLMPort {
  constructor(
    private readonly inner: LLMPort,
    private readonly breaker: CircuitBreaker
  ) {}

  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    return this.breaker.execute(() => this.inner.complete(messages, options));
  }
}

