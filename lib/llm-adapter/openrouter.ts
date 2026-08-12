// =========================================================
// lib/llm-adapter/openrouter.ts
// OpenRouter adapter -- OpenAI-compatible API at openrouter.ai
//
// Free model chain (confirmed available Aug 2026):
//   google/gemma-4-31b-it:free         (primary)
//   openai/gpt-oss-20b:free            (fallback 1)
//   google/gemma-4-26b-a4b-it:free     (fallback 2)
//   nvidia/llama-3.1-nemotron-ultra-253b-v1:free (fallback 3)
//
// Auto-Fallback: if the selected model hits 429 after retries,
// automatically tries the next model in the FREE_FALLBACK_CHAIN.
// SSE notifier keeps the UI informed at each step.
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Retry config per model
const MAX_RETRIES_PER_MODEL = 2;     // retries before switching model
const BASE_DELAY_MS         = 2000;  // 2s, 4s per model

// Free model fallback chain (in order of preference)
const FREE_FALLBACK_CHAIN = [
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
];

// Callback registered by the SSE route to send live retry/fallback events to UI
type RetryNotifier = (attempt: number, waitMs: number, model: string) => void;
let _retryNotifier: RetryNotifier | null = null;

export function setRetryNotifier(fn: RetryNotifier): void  { _retryNotifier = fn; }
export function clearRetryNotifier(): void                 { _retryNotifier = null; }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function is429(err: unknown): boolean {
  if (!err) return false;
  const e = err as { status?: number; message?: string };
  return (
    e.status === 429 ||
    (typeof e.message === "string" && (
      e.message.includes("429") ||
      e.message.toLowerCase().includes("rate limit") ||
      e.message.toLowerCase().includes("too many requests") ||
      e.message.toLowerCase().includes("provider returned error")
    ))
  );
}

export class OpenRouterAdapter implements LLMAdapter {
  private client: OpenAI;
  private primaryModel: string;

  constructor(apiKey: string, model = "google/gemma-4-31b-it:free") {
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE,
      maxRetries: 0,  // we fully control retry/fallback logic
      defaultHeaders: {
        "HTTP-Referer": "https://verve-design.vercel.app",
        "X-Title":      "Verve Design Intelligence",
      },
    });
    this.primaryModel = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 4000 } = options;

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
    for (const m of messages) fullMessages.push({ role: m.role, content: m.content });

    // Build the fallback chain starting from the selected primary model
    const isFreeModel = this.primaryModel.endsWith(":free");
    const chain = isFreeModel
      ? [this.primaryModel, ...FREE_FALLBACK_CHAIN.filter((m) => m !== this.primaryModel)]
      : [this.primaryModel]; // paid/non-free models don't rotate

    let lastError: Error = new Error("OpenRouter: no response");
    let globalAttempt = 0;

    for (const model of chain) {
      for (let retry = 0; retry <= MAX_RETRIES_PER_MODEL; retry++) {
        globalAttempt++;
        try {
          const response = await this.client.chat.completions.create({
            model,
            max_tokens: maxTokens,
            temperature,
            messages: fullMessages,
          });

          const content = response.choices[0]?.message?.content;
          if (!content) throw new Error(`Empty response from ${model}`);

          // Log which model succeeded (helpful for debugging)
          if (model !== this.primaryModel) {
            console.info(`[OpenRouter] Fell back to ${model} (primary: ${this.primaryModel})`);
          }
          return content;

        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (is429(err) && retry < MAX_RETRIES_PER_MODEL) {
            // Retry same model with backoff
            const waitMs = BASE_DELAY_MS * Math.pow(2, retry);
            console.warn(`[OpenRouter] 429 on ${model}, retry ${retry + 1}/${MAX_RETRIES_PER_MODEL}. Waiting ${waitMs / 1000}s`);
            _retryNotifier?.(globalAttempt, waitMs, model);
            await sleep(waitMs);
            continue; // retry same model
          }

          if (is429(err)) {
            // Exhausted retries for this model — notify UI and try next model
            const nextModel = chain[chain.indexOf(model) + 1];
            if (nextModel) {
              console.warn(`[OpenRouter] 429 exhausted on ${model}. Trying fallback: ${nextModel}`);
              _retryNotifier?.(
                globalAttempt,
                1500,
                `${model} rate-limited \u2192 switching to ${nextModel.split("/")[1]?.replace(":free", "") ?? nextModel}`
              );
              await sleep(1500); // brief pause before switching
            }
            break; // exit retry loop, move to next model in chain
          }

          // Non-429 error (auth, model not found, etc.) — throw immediately
          throw lastError;
        }
      }
    }

    // All models in chain exhausted
    throw new Error(
      `All OpenRouter free models are rate-limited right now. ` +
      `Tried: ${chain.join(", ")}. ` +
      `Please wait a few minutes and try again, or switch to Claude / GPT / Gemini.`
    );
  }
}
