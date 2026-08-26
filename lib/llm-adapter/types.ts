// =========================================================
// lib/llm-adapter/types.ts
// Shared types + model registry for all LLM providers
// =========================================================

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  // Per-call reasoning effort for GPT-5.6 / o-series reasoning models.
  // Controls how many internal reasoning tokens are consumed before output.
  // Use 'low' for short JSON tasks, 'medium' for planning, 'high' for code.
  // If omitted, adapter defaults to 'medium'.
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  // Per-call deadline. Adapters clamp this to their provider safety ceiling.
  timeoutMs?: number;
};

export interface LLMAdapter {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}

export type Provider = "anthropic" | "openai" | "gemini" | "openrouter";

// ── Model Registry ───────────────────────────────────────────────────────────
// IDs here are the EXACT strings sent to each provider API.
// Keep in sync with README.md "Supported providers" table.
// ─────────────────────────────────────────────────────────────────────────────
export const PROVIDER_MODELS: Record<Provider, { id: string; label: string; description: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6", description: "Best balance — production default" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fast and cost-efficient" },
    { id: "claude-opus-4-8",           label: "Claude Opus 4.8",  description: "Maximum intelligence — complex tasks" },
  ],
  openai: [
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", description: "Balanced intelligence & cost — reasoning model" },
    { id: "gpt-5.6-sol",   label: "GPT-5.6 Sol",   description: "Flagship reasoning — highest intelligence" },
    { id: "gpt-5.6-luna",  label: "GPT-5.6 Luna",  description: "Efficient high-volume workloads — fastest GPT-5.6" },
    { id: "gpt-4o-mini",   label: "GPT-4o Mini",   description: "Affordable, lightweight — fast tasks" },
  ],
  gemini: [
    { id: "gemini-3.7-flash",       label: "Gemini 3.7 Flash",       description: "Fast, capable — production default" },
    { id: "gemini-3.5-flash",       label: "Gemini 3.5 Flash",       description: "Efficient general-purpose model" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", description: "Advanced reasoning — preview" },
  ],
  openrouter: [
    { id: "openrouter/free",          label: "OpenRouter Free Router", description: "Automatically selects an available free model" },
    { id: "openai/gpt-oss-20b:free", label: "GPT OSS 20B (Free)",     description: "Fast open-weight fallback" },
  ],
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic:  "claude-sonnet-4-6",
  openai:     "gpt-5.6-terra",
  gemini:     "gemini-3.7-flash",
  openrouter: "openrouter/free",
};

export const PROVIDER_KEY_LABELS: Record<Provider, { label: string; placeholder: string; docsUrl: string }> = {
  anthropic: {
    label:       "Anthropic API Key",
    placeholder: "sk-ant-api03-...",
    docsUrl:     "https://console.anthropic.com/account/keys",
  },
  openai: {
    label:       "OpenAI API Key",
    placeholder: "sk-...",
    docsUrl:     "https://platform.openai.com/api-keys",
  },
  gemini: {
    label:       "Google AI API Key",
    placeholder: "AIzaSy...",
    docsUrl:     "https://aistudio.google.com/app/apikey",
  },
  openrouter: {
    label:       "OpenRouter API Key",
    placeholder: "sk-or-v1-...",
    docsUrl:     "https://openrouter.ai/keys",
  },
};

// Helper: detect if a model ID is a GPT-5.x or o-series reasoning model
// These models use reasoning_effort instead of temperature
export function isReasoningModel(modelId: string): boolean {
  return (
    modelId.startsWith("gpt-5.") ||
    modelId.startsWith("o1") ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4")
  );
}
