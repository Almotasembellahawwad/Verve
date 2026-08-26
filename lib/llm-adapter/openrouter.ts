// =========================================================
// lib/llm-adapter/openrouter.ts
// OpenRouter adapter — with AbortSignal + global chain timeout
//
// Free model chain (confirmed available Aug 2026):
//   google/gemma-4-31b-it:free         (primary)
//   openai/gpt-oss-20b:free            (fallback 1)
//   google/gemma-4-26b-a4b-it:free     (fallback 2)
//   nvidia/llama-3.1-nemotron-ultra-253b-v1:free (fallback 3)
//
// Resilience rules:
//   1. Exponential backoff on 429 rate limits.
//   2. Fallback to next model on 429, empty response, or 5xx errors.
//   3. Global 90s chain timeout across all retries + fallbacks.
//   4. content=empty is a FAILED generation — never return reasoning traces.
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const OPENROUTER_BASE    = "https://openrouter.ai/api/v1";
const MAX_RETRIES_PER_MODEL = 1;
const BASE_DELAY_MS         = 1200;
const CHAIN_TIMEOUT_MS      = 70_000;
const PER_CALL_TIMEOUT_MS   = 35_000;

const FREE_FALLBACK_CHAIN = ["openrouter/free", "openai/gpt-oss-20b:free"];

export type RetryNotifier = (attempt: number, waitMs: number, model: string) => void;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); });
  });
}

function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  const e   = err as { status?: number; message?: string };
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  const s   = e.status ?? 0;
  return (
    s === 429 || s === 500 || s === 502 || s === 503 || s === 504 ||
    msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests") ||
    msg.includes("provider returned error") || msg.includes("empty response") ||
    msg.includes("overloaded") || msg.includes("no content") ||
    msg.includes("timeout") || msg.includes("truncated") || msg.includes("length limit")
  );
}

export class OpenRouterAdapter implements LLMAdapter {
  private client: OpenAI;
  private primaryModel: string;
  private signal?: AbortSignal;
  private onRetry?: RetryNotifier;

  constructor(apiKey: string, model = "openrouter/free", signal?: AbortSignal, onRetry?: RetryNotifier) {
    this.client = new OpenAI({
      apiKey,
      baseURL:    OPENROUTER_BASE,
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": "https://verve-design.vercel.app",
        "X-Title":      "Verve Design Intelligence",
      },
    });
    this.primaryModel = model;
    this.signal       = signal;
    this.onRetry      = onRetry;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 4000, timeoutMs } = options;

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
    for (const m of messages) fullMessages.push({ role: m.role, content: m.content });

    const isFreeModel = this.primaryModel === "openrouter/free" || this.primaryModel.endsWith(":free");
    const chain = isFreeModel
      ? [this.primaryModel, ...FREE_FALLBACK_CHAIN.filter((m) => m !== this.primaryModel)]
      : [this.primaryModel];

    // Global chain timeout — prevents orphaned requests on hung free models
    const effectiveChainTimeoutMs = Math.min(CHAIN_TIMEOUT_MS, Math.max(5_000, timeoutMs ?? CHAIN_TIMEOUT_MS));
    const chainCtrl = new AbortController();
    const chainTimer = setTimeout(() => chainCtrl.abort(new Error(`OpenRouter chain timed out after ${effectiveChainTimeoutMs / 1000}s`)), effectiveChainTimeoutMs);
    const chainSignal = this.signal
      ? AbortSignal.any([this.signal, chainCtrl.signal])
      : chainCtrl.signal;

    let lastError: Error = new Error("OpenRouter: no response");
    let globalAttempt = 0;

    try {
      for (const model of chain) {
        for (let retry = 0; retry <= MAX_RETRIES_PER_MODEL; retry++) {
          globalAttempt++;

          // Check for early abort
          if (chainSignal.aborted) throw chainSignal.reason;

          // Per-call timeout
          const effectiveCallTimeoutMs = Math.min(PER_CALL_TIMEOUT_MS, effectiveChainTimeoutMs);
          const callCtrl  = new AbortController();
          const callTimer = setTimeout(() => callCtrl.abort(new Error(`${model} call timed out after ${effectiveCallTimeoutMs / 1000}s`)), effectiveCallTimeoutMs);
          const callSignal = AbortSignal.any([chainSignal, callCtrl.signal]);

          try {
            const response = await this.client.chat.completions.create(
              { model, max_tokens: maxTokens, temperature, messages: fullMessages },
              { signal: callSignal }
            );

            const choice = response.choices[0];
            const msg    = choice?.message;

            // NEVER return reasoning_content — it may contain internal model instructions.
            // Empty content = failed generation, not a fallback to reasoning.
            const content = msg?.content;

            if (!content || typeof content !== "string" || !content.trim()) {
              throw new Error(`Empty response from ${model} (reasoning content withheld per policy)`);
            }

            // Returning a half-written project is worse than returning a
            // recoverable provider error. Let the fallback chain try again.
            if (choice.finish_reason === "length") {
              throw new Error(`Truncated response from ${model}: output reached its length limit`);
            }

            if (model !== this.primaryModel) {
              console.info(`[OpenRouter] Fallback succeeded: ${model}`);
            }
            return content;

          } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));

            // Propagate abort immediately — don't retry on cancellation
            if (chainSignal.aborted) throw lastError;

            const retryable = isRetryableError(err);

            if (retryable && retry < MAX_RETRIES_PER_MODEL) {
              const waitMs = BASE_DELAY_MS * Math.pow(2, retry);
              console.warn(`[OpenRouter] ${lastError.message} on ${model}, retry ${retry + 1}/${MAX_RETRIES_PER_MODEL}`);
              this.onRetry?.(globalAttempt, waitMs, model);
              await sleep(waitMs, chainSignal);
              continue;
            }

            if (retryable) {
              const nextModel = chain[chain.indexOf(model) + 1];
              if (nextModel) {
                const shortNext = nextModel.split("/")[1]?.replace(":free", "") ?? nextModel;
                console.warn(`[OpenRouter] ${model} exhausted → switching to ${nextModel}`);
                this.onRetry?.(globalAttempt, 1500, `switching to ${shortNext}`);
                await sleep(1500, chainSignal);
              }
              break; // next model in chain
            }

            // Non-retryable (e.g. invalid API key) — fail immediately
            throw lastError;

          } finally {
            clearTimeout(callTimer);
          }
        }
      }
    } finally {
      clearTimeout(chainTimer);
    }

    throw new Error(
      `OpenRouter exhausted its fallback chain (${chain.map((m) => m.split("/")[1] ?? m).join(", ")}). Last error: ${lastError.message}`
    );
  }
}
