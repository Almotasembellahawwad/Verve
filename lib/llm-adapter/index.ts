// =========================================================
// lib/llm-adapter/index.ts
// Factory -- creates the right adapter from provider + apiKey
// All engine modules call createAdapter() from the request context
// =========================================================

export type { LLMAdapter, LLMMessage, LLMOptions, Provider } from "./types";
export { PROVIDER_MODELS, DEFAULT_MODEL, PROVIDER_KEY_LABELS } from "./types";
export { ClaudeAdapter }       from "./claude";
export { OpenAIAdapter }       from "./openai";
export { GeminiAdapter }       from "./gemini";
export { OpenRouterAdapter }   from "./openrouter";

import type { Provider, LLMAdapter } from "./types";
import { ClaudeAdapter }       from "./claude";
import { OpenAIAdapter }       from "./openai";
import { GeminiAdapter }       from "./gemini";
import { OpenRouterAdapter }   from "./openrouter";

/**
 * Per-request factory -- creates adapter from user-provided apiKey.
 * Used by all API routes (/api/generate, /api/compare, /api/critique).
 */
export function createAdapter(provider: Provider, apiKey: string, model?: string): LLMAdapter {
  switch (provider) {
    case "anthropic":   return new ClaudeAdapter(apiKey, model);
    case "openai":      return new OpenAIAdapter(apiKey, model);
    case "gemini":      return new GeminiAdapter(apiKey, model);
    case "openrouter":  return new OpenRouterAdapter(apiKey, model);
    default:            throw new Error(`Unknown provider: ${provider}`);
  }
}

// -- Legacy singleton for engine modules that call getLLMAdapter() -----------
// All engine modules (brief-analyzer, plan-generator, code-generator, etc.)
// still call getLLMAdapter(). This function auto-detects whichever provider
// key is currently set in env vars -- set by the SSE route before calling them.
//
// Priority: OPENROUTER -> ANTHROPIC -> OPENAI -> GEMINI
// The SSE route calls resetLLMAdapter() + sets the right env var before running,
// so this singleton will always pick up the user's chosen provider.

let _legacyInstance: LLMAdapter | null = null;

export function getLLMAdapter(): LLMAdapter {
  if (!_legacyInstance) {
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const anthropicKey  = process.env.ANTHROPIC_API_KEY;
    const openaiKey     = process.env.OPENAI_API_KEY;
    const geminiKey     = process.env.GOOGLE_AI_API_KEY;

    if (openrouterKey) {
      _legacyInstance = new OpenRouterAdapter(openrouterKey);
    } else if (anthropicKey) {
      _legacyInstance = new ClaudeAdapter(anthropicKey);
    } else if (openaiKey) {
      _legacyInstance = new OpenAIAdapter(openaiKey);
    } else if (geminiKey) {
      _legacyInstance = new GeminiAdapter(geminiKey);
    } else {
      throw new Error(
        "No API key found. Please set your key in the settings panel (Claude, GPT, Gemini, or OpenRouter)."
      );
    }
  }
  return _legacyInstance;
}

/**
 * Reset singleton -- called by SSE route before each generation run
 * so the next getLLMAdapter() call picks up the freshly-set env var.
 */
export function resetLLMAdapter(): void {
  _legacyInstance = null;
}
