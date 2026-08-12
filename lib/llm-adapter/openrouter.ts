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
// Resilience rules:
//   1. Exponential backoff on 429 rate limits.
//   2. Fallback to next model on 429, empty response, or 5xx server errors.
//   3. Supports reasoning/thinking fields in OpenRouter payload.
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const MAX_RETRIES_PER_MODEL = 2;     // retries before switching model
const BASE_DELAY_MS         = 2000;  // 2s, 4s per model

const FREE_FALLBACK_CHAIN = [
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
];

type RetryNotifier = (attempt: number, waitMs: number, model: string) => void;
let _retryNotifier: RetryNotifier | null = null;

export function setRetryNotifier(fn: RetryNotifier): void  { _retryNotifier = fn; }
export function clearRetryNotifier(): void                 { _retryNotifier = null; }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isModelRetryableError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { status?: number; message?: string };
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  const status = e.status ?? 0;

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("provider returned error") ||
    msg.includes("empty response") ||
    msg.includes("overloaded") ||
    msg.includes("no content")
  );
}

export class OpenRouterAdapter implements LLMAdapter {
  private client: OpenAI;
  private primaryModel: string;

  constructor(apiKey: string, model = "google/gemma-4-31b-it:free") {
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE,
      maxRetries: 0,
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

    const isFreeModel = this.primaryModel.endsWith(":free");
    const chain = isFreeModel
      ? [this.primaryModel, ...FREE_FALLBACK_CHAIN.filter((m) => m !== this.primaryModel)]
      : [this.primaryModel];

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

          const choice = response.choices[0];
          // Extract content or fallback to reasoning fields if content is empty
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msgAny = choice?.message as any;
          const content = msgAny?.content ?? msgAny?.reasoning ?? msgAny?.reasoning_content;

          if (!content || typeof content !== "string" || !content.trim()) {
            throw new Error(`Empty response from ${model}`);
          }

          if (model !== this.primaryModel) {
            console.info(`[OpenRouter] Successfully used fallback model: ${model}`);
          }
          return content;

        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          const isRetryable = isModelRetryableError(err);

          if (isRetryable && retry < MAX_RETRIES_PER_MODEL) {
            const waitMs = BASE_DELAY_MS * Math.pow(2, retry);
            console.warn(`[OpenRouter] ${lastError.message} on ${model}, retry ${retry + 1}/${MAX_RETRIES_PER_MODEL}. Waiting ${waitMs / 1000}s`);
            _retryNotifier?.(globalAttempt, waitMs, model);
            await sleep(waitMs);
            continue;
          }

          if (isRetryable) {
            const nextModel = chain[chain.indexOf(model) + 1];
            if (nextModel) {
              const shortNext = nextModel.split("/")[1]?.replace(":free", "") ?? nextModel;
              console.warn(`[OpenRouter] Model ${model} failed (${lastError.message}). Switching to fallback: ${nextModel}`);
              _retryNotifier?.(
                globalAttempt,
                1500,
                `${model.split("/")[1]?.replace(":free", "") ?? model} unready \u2192 switching to ${shortNext}`
              );
              await sleep(1500);
            }
            break; // Move to next model in fallback chain
          }

          // Throw non-retryable errors (e.g. invalid API key) immediately
          throw lastError;
        }
      }
    }

    throw new Error(
      `All OpenRouter free models are currently unavailable. ` +
      `Tried: ${chain.map(m => m.split("/")[1] ?? m).join(", ")}. ` +
      `Please wait a minute or switch to a paid provider.`
    );
  }
}
