// =========================================================
// lib/adapters/llm/openrouter.ts
// OpenRouter adapter with gateway-managed model fallback.
//
// OpenRouter's `models` parameter performs provider/model failover inside one
// request. This is more reliable than spending the entire stage deadline on a
// client-side first attempt and discovering that no time remains for fallback.
// =========================================================

import type { LLMAdapter, LLMMessage, LLMOptions } from "../../ports/llm";

const OPENROUTER_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TIMEOUT_CEILING_MS = 90_000;
const FREE_FALLBACK_CHAIN = ["openrouter/free", "openai/gpt-oss-20b:free"] as const;

export type RetryNotifier = (attempt: number, waitMs: number, model: string) => void;

type OpenRouterPayload = {
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
  error?: { code?: string | number; message?: string };
};

export function buildOpenRouterModelChain(primaryModel: string): string[] {
  const free = primaryModel === "openrouter/free" || primaryModel.endsWith(":free");
  if (!free) return [primaryModel];
  return [primaryModel, ...FREE_FALLBACK_CHAIN.filter((model) => model !== primaryModel)];
}

export function openRouterDeadline(timeoutMs?: number): number {
  return Math.min(
    OPENROUTER_TIMEOUT_CEILING_MS,
    Math.max(15_000, timeoutMs ?? OPENROUTER_TIMEOUT_CEILING_MS)
  );
}

function errorFromPayload(response: Response, payload: OpenRouterPayload): Error & { status?: number } {
  const message = payload.error?.message?.trim() || `OpenRouter request failed with HTTP ${response.status}`;
  const error = new Error(message) as Error & { status?: number };
  error.status = response.status;
  return error;
}

export class OpenRouterAdapter implements LLMAdapter {
  private apiKey: string;
  private primaryModel: string;
  private signal?: AbortSignal;
  private onRetry?: RetryNotifier;

  constructor(apiKey: string, model = "openrouter/free", signal?: AbortSignal, onRetry?: RetryNotifier) {
    this.apiKey = apiKey;
    this.primaryModel = model;
    this.signal = signal;
    this.onRetry = onRetry;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const {
      systemPrompt,
      temperature = 0.7,
      maxTokens = 4000,
      timeoutMs,
      reasoningEffort,
      responseFormat,
    } = options;
    const modelChain = buildOpenRouterModelChain(this.primaryModel);
    const effectiveTimeoutMs = openRouterDeadline(timeoutMs);
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(new Error(`OpenRouter request timed out after ${effectiveTimeoutMs / 1000}s`)),
      effectiveTimeoutMs
    );
    const signal = this.signal
      ? AbortSignal.any([this.signal, timeoutController.signal])
      : timeoutController.signal;

    const fullMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
    fullMessages.push(...messages);

    // Completion limits include reasoning tokens. Keep enough visible-output
    // headroom for GPT OSS without requesting an unbounded project.
    const completionBudget = Math.min(20_000, Math.max(maxTokens, maxTokens + 2_000));
    const requestBody: Record<string, unknown> = {
      models: modelChain,
      messages: fullMessages,
      max_completion_tokens: completionBudget,
      temperature,
      provider: {
        allow_fallbacks: true,
        require_parameters: Boolean(responseFormat),
      },
    };

    if (responseFormat) {
      requestBody.response_format = {
        type: "json_schema",
        json_schema: {
          name: responseFormat.name,
          strict: true,
          schema: responseFormat.schema,
        },
      };
    }

    // The direct GPT OSS model supports OpenRouter's normalized reasoning
    // control. Dynamic routers intentionally choose their own compatible model.
    if (this.primaryModel !== "openrouter/free" && reasoningEffort) {
      requestBody.reasoning = { effort: reasoningEffort, exclude: true };
    }

    try {
      const response = await fetch(OPENROUTER_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://verve-dev.vercel.app",
          "X-Title": "Verve Design Intelligence",
          "X-OpenRouter-Metadata": "enabled",
        },
        body: JSON.stringify(requestBody),
        signal,
      });
      const payload = await response.json().catch(() => ({})) as OpenRouterPayload;
      if (!response.ok || payload.error) throw errorFromPayload(response, payload);

      const choice = payload.choices?.[0];
      const content = choice?.message?.content;
      if (!content || !content.trim()) {
        throw new Error(`OpenRouter returned no visible output (model: ${payload.model ?? this.primaryModel})`);
      }
      if (choice.finish_reason === "length") {
        throw new Error(`OpenRouter returned an incomplete response at its completion limit (model: ${payload.model ?? this.primaryModel})`);
      }
      if (choice.finish_reason === "content_filter" || choice.finish_reason === "error") {
        throw new Error(`OpenRouter could not complete the response (finish reason: ${choice.finish_reason})`);
      }

      if (payload.model && payload.model !== this.primaryModel) {
        this.onRetry?.(1, 0, `fallback: ${payload.model}`);
        console.info(`[OpenRouter] Gateway fallback succeeded: ${payload.model}`);
      }
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}
