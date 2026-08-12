// =========================================================
// lib/llm-adapter/types.ts
// Shared types for all LLM adapters
// =========================================================

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};

export interface LLMAdapter {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}

export type Provider = "anthropic" | "openai" | "gemini" | "openrouter";

// Model registry -- valid production model IDs per provider
export const PROVIDER_MODELS: Record<Provider, { id: string; label: string; description: string }[]> = {
  anthropic: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", description: "Best balance -- production default" },
    { id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku",  description: "Fastest -- cost-efficient" },
    { id: "claude-3-opus-20240229",     label: "Claude 3 Opus",       description: "Maximum intelligence -- complex tasks" },
  ],
  openai: [
    { id: "gpt-4o",      label: "GPT-4o",      description: "Flagship model -- fast & intelligent" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", description: "Affordable, lightweight model" },
    { id: "o3-mini",     label: "o3-mini",     description: "High reasoning -- technical tasks" },
  ],
  gemini: [
    { id: "gemini-2.0-flash",      label: "Gemini 2.0 Flash",      description: "Fast & multimodal -- default" },
    { id: "gemini-1.5-pro",       label: "Gemini 1.5 Pro",        description: "High reasoning & huge context" },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", description: "Ultra-fast, cost-effective" },
  ],
  openrouter: [
    { id: "google/gemma-4-31b-it:free",                   label: "Gemma 4 31B (Free)",    description: "Google -- best overall free model" },
    { id: "openai/gpt-oss-20b:free",                     label: "GPT OSS 20B (Free)",     description: "OpenAI open-source -- fast & capable" },
    { id: "google/gemma-4-26b-a4b-it:free",              label: "Gemma 4 26B MoE (Free)", description: "Google MoE -- lighter, faster" },
    { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1:free", label: "Nemotron 253B (Free)",  description: "NVIDIA -- largest free model" },
  ],
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic:   "claude-3-5-sonnet-20241022",
  openai:      "gpt-4o",
  gemini:      "gemini-2.0-flash",
  openrouter:  "google/gemma-4-31b-it:free",
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
