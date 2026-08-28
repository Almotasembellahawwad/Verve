// =========================================================
// lib/adapters/llm/factory.ts
// Factory -- creates the right adapter from provider + apiKey.
//
// DESIGN: Per-request adapter only. No singletons.
// Every API route creates one adapter instance per request,
// scoped to that request's closure. Engine functions receive
// the adapter as an explicit parameter.
// =========================================================

export type { LLMAdapter, LLMMessage, LLMOptions, Provider } from "../../ports/llm";
export { PROVIDER_MODELS, DEFAULT_MODEL, PROVIDER_KEY_LABELS, isReasoningModel } from "../../llm-adapter/types";
import type { Provider, LLMAdapter } from "../../ports/llm";
import { DEFAULT_MODEL, PROVIDER_MODELS } from "../../llm-adapter/types";
import { AnthropicAdapter }    from "./anthropic";
import { OpenAIAdapter }       from "./openai";
import { GeminiAdapter }       from "./gemini";
import { OpenRouterAdapter }   from "./openrouter";
import { CircuitBreaker } from "../../application/circuit-breaker";
import { CircuitBreakingLLMAdapter } from "./circuit-breaking-llm";

/**
 * Per-request factory — creates adapter scoped to one request.
 *
 * @param provider - Which LLM backend to use
 * @param apiKey   - User-supplied key (never stored in process.env)
 * @param model    - Optional override; defaults to provider default
 * @param signal   - AbortSignal for client-disconnect cancellation (Phase 1.6)
 */
export function createAdapter(
  provider: Provider,
  apiKey: string,
  model?: string,
  signal?: AbortSignal,
  onRetry?: (attempt: number, waitMs: number, model: string) => void,
  breaker = new CircuitBreaker(`llm:${provider}`)
): LLMAdapter {
  // Validate model against registry — reject unknown model IDs
  const knownModels = PROVIDER_MODELS[provider]?.map((m) => m.id) ?? [];
  const resolvedModel = (() => {
    if (!model) return DEFAULT_MODEL[provider];
    if (knownModels.includes(model)) return model;
    // Unknown model ID: fall back to provider default, log warning
    console.warn(`[createAdapter] Unknown model "${model}" for provider "${provider}" — using default`);
    return DEFAULT_MODEL[provider];
  })();

  const adapter = (() => {
    switch (provider) {
      case "anthropic":   return new AnthropicAdapter(apiKey, resolvedModel, signal);
      case "openai":      return new OpenAIAdapter(apiKey, resolvedModel, signal);
      case "gemini":      return new GeminiAdapter(apiKey, resolvedModel, signal);
      case "openrouter":  return new OpenRouterAdapter(apiKey, resolvedModel, signal, onRetry);
      default:             throw new Error(`Unknown provider: ${provider}`);
    }
  })();
  return new CircuitBreakingLLMAdapter(adapter, breaker);
}
