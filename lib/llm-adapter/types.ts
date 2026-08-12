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

// Model registry -- latest stable models per provider (August 2026)
export const PROVIDER_MODELS: Record<Provider, { id: string; label: string; description: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-5",           label: "Claude Sonnet 5",    description: "Best balance -- production default" },
    { id: "claude-opus-5",             label: "Claude Opus 5",      description: "Maximum intelligence -- complex tasks" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",   description: "Fastest -- cost-efficient" },
  ],
  openai: [
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", description: "Balanced performance and cost" },
    { id: "gpt-5.6-sol",   label: "GPT-5.6 Sol",   description: "Flagship reasoning -- complex tasks" },
    { id: "gpt-5.6-luna",  label: "GPT-5.6 Luna",  description: "High-volume, cost-effective" },
  ],
  gemini: [
    { id: "gemini-3.6-flash",      label: "Gemini 3.6 Flash",      description: "Fast -- latest stable workhorse" },
    { id: "gemini-3.1-pro",        label: "Gemini 3.1 Pro",        description: "High reasoning -- complex analysis" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", description: "High-volume, low-latency" },
  ],
  openrouter: [
    { id: "google/gemma-4-31b-it:free",                label: "Gemma 4 31B (Free)",       description: "Google -- best overall free model" },
    { id: "openai/gpt-oss-20b:free",                  label: "GPT OSS 20B (Free)",        description: "OpenAI open-source -- fast & capable" },
    { id: "google/gemma-4-26b-a4b-it:free",           label: "Gemma 4 26B MoE (Free)",    description: "Google MoE -- lighter, faster" },
    { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1:free", label: "Nemotron Ultra 253B (Free)", description: "NVIDIA -- largest free model" },
  ],
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic:   "claude-sonnet-5",
  openai:      "gpt-5.6-terra",
  gemini:      "gemini-3.6-flash",
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
