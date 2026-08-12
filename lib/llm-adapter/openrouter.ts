// =========================================================
// lib/llm-adapter/openrouter.ts
// OpenRouter adapter -- OpenAI-compatible API at openrouter.ai
//
// Free models:
//   google/gemma-4-31b-it:free
//   openai/gpt-oss-20b:free
//   meta-llama/llama-3.3-70b-instruct:free
//   mistralai/mistral-small-3.2-24b-instruct:free
//
// Free tier limits: ~20 req/min, ~200 req/day per model.
// The Verve pipeline makes 5-6 sequential LLM calls per generation.
// This adapter includes exponential backoff retry for 429 responses.
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Retry config for free tier rate limits
const MAX_RETRIES   = 4;
const BASE_DELAY_MS = 3000;  // 3s initial wait on 429

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenRouterAdapter implements LLMAdapter {
  private client: OpenAI;
  private model:  string;

  constructor(apiKey: string, model = "google/gemma-4-31b-it:free") {
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE,
      // Disable SDK-level retries -- we handle it ourselves with better delays
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": "https://verve-design.vercel.app",
        "X-Title":      "Verve Design Intelligence",
      },
    });
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 4000 } = options;

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      fullMessages.push({ role: "system", content: systemPrompt });
    }
    for (const m of messages) {
      fullMessages.push({ role: m.role, content: m.content });
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model:      this.model,
          max_tokens: maxTokens,
          temperature,
          messages:   fullMessages,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error(`Empty response from OpenRouter (model: ${this.model})`);
        return content;

      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Check for 429 rate limit
        const is429 = (
          (err as { status?: number })?.status === 429 ||
          lastError.message.includes("429") ||
          lastError.message.toLowerCase().includes("rate limit") ||
          lastError.message.toLowerCase().includes("too many requests")
        );

        if (is429 && attempt < MAX_RETRIES) {
          // Exponential backoff: 3s, 6s, 12s, 24s
          const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `[OpenRouter] 429 rate limit on attempt ${attempt + 1}/${MAX_RETRIES + 1}. ` +
            `Waiting ${waitMs / 1000}s before retry... (model: ${this.model})`
          );
          await sleep(waitMs);
          continue;
        }

        // For 429 after all retries -- give a clear user-facing message
        if (is429) {
          throw new Error(
            `OpenRouter free tier rate limit reached (model: ${this.model}). ` +
            `Free models allow ~20 requests/min. ` +
            `Please wait 1-2 minutes and try again, or switch to a paid provider (Claude/GPT/Gemini).`
          );
        }

        // For other errors (auth, model not found, etc.) -- throw immediately
        throw lastError;
      }
    }

    throw lastError ?? new Error("OpenRouter: max retries exceeded");
  }
}
