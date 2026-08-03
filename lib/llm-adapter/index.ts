// =========================================================
// lib/llm-adapter/index.ts
// Factory — creates the right adapter from provider + apiKey
// All engine modules call createAdapter() from the request context
// =========================================================

export type { LLMAdapter, LLMMessage, LLMOptions, Provider } from "./types";
export { PROVIDER_MODELS, DEFAULT_MODEL, PROVIDER_KEY_LABELS } from "./types";
export { ClaudeAdapter } from "./claude";
export { OpenAIAdapter } from "./openai";
export { GeminiAdapter } from "./gemini";

import type { Provider, LLMAdapter } from "./types";
import { ClaudeAdapter } from "./claude";
import { OpenAIAdapter } from "./openai";
import { GeminiAdapter } from "./gemini";

/**
 * Per-request factory — creates adapter from user-provided apiKey.
 * Used by all API routes (/api/generate, /api/compare, /api/critique).
 */
export function createAdapter(provider: Provider, apiKey: string, model?: string): LLMAdapter {
  switch (provider) {
    case "anthropic": return new ClaudeAdapter(apiKey, model);
    case "openai":    return new OpenAIAdapter(apiKey, model);
    case "gemini":    return new GeminiAdapter(apiKey, model);
    default:          throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Legacy singleton (for backwards compatibility with old engine calls) ────
// Engine modules that haven't been updated yet still call getLLMAdapter().
// These will use the ANTHROPIC_API_KEY env variable as fallback.
// New modules should call createAdapter() with the user's key instead.
let _legacyInstance: LLMAdapter | null = null;

export function getLLMAdapter(): LLMAdapter {
  if (!_legacyInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is required for legacy mode");
    _legacyInstance = new ClaudeAdapter(apiKey);
  }
  return _legacyInstance;
}

/**
 * Reset singleton (for testing or when API key changes)
 */
export function resetLLMAdapter(): void {
  _legacyInstance = null;
}
