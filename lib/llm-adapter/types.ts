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
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", description: "Best balance — production default" },
    { id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku",  description: "Fastest — cost-efficient" },
    { id: "claude-3-opus-20240229",     label: "Claude 3 Opus",     description: "Maximum intelligence — complex tasks" },
  ],
  openai: [
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", description: "Balanced intelligence & cost — reasoning model" },
    { id: "gpt-5.6-sol",   label: "GPT-5.6 Sol",   description: "Flagship reasoning — highest intelligence" },
    { id: "gpt-5.6-luna",  label: "GPT-5.6 Luna",  description: "Efficient high-volume workloads — fastest GPT-5.6" },
    { id: "gpt-4o-mini",   label: "GPT-4o Mini",   description: "Affordable, lightweight — fast tasks" },
  ],
  gemini: [
    { id: "gemini-2.0-flash",      label: "Gemini 2.0 Flash",      description: "Fast & multimodal — default" },
    { id: "gemini-1.5-pro",        label: "Gemini 1.5 Pro",        description: "High reasoning & huge context" },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", description: "Ultra-fast, cost-effective" },
  ],
  openrouter: [
    { id: "google/gemma-4-31b-it:free",                   label: "Gemma 4 31B (Free)",    description: "Google — best overall free model" },
    { id: "openai/gpt-oss-20b:free",                      label: "GPT OSS 20B (Free)",    description: "OpenAI open-source — fast & capable" },
    { id: "google/gemma-4-26b-a4b-it:free",               label: "Gemma 4 26B MoE (Free)", description: "Google MoE — lighter, faster" },
    { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",  label: "Nemotron 253B (Free)", description: "NVIDIA — largest free model" },
  ],
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic:  "claude-3-5-sonnet-20241022",
  openai:     "gpt-5.6-terra",
  gemini:     "gemini-2.0-flash",
  openrouter: "google/gemma-4-31b-it:free",
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
