// =========================================================
// lib/adapters/llm/openai.ts
// OpenAI adapter — with AbortSignal + timeout support
//
// GPT-5.6 family are Reasoning Models:
//   - Use the Responses API with max_output_tokens
//   - Use reasoning.effort (per-call, from LLMOptions.reasoningEffort)
//   - Do NOT set temperature (causes 400 error for reasoning models)
//
// max_output_tokens includes BOTH reasoning tokens AND visible output tokens.
// Set it high enough so the model has budget left for actual output.
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "../../ports/llm";
import { isReasoningModel } from "../../llm-adapter/types";
import { ProviderResponseError } from "../../errors/provider-response-error";

const LLM_TIMEOUT_MS = 120_000; // 120s for reasoning models & code generation

// Per-model caps: cover BOTH internal reasoning + actual output.
const MODEL_MAX_COMPLETION_TOKENS: Record<string, number> = {
  "gpt-5.6-terra": 30000,
  "gpt-5.6-sol": 30000,
  "gpt-5.6-luna": 20000,
  "gpt-4o": 15000,
  "gpt-4o-mini": 10000,
};

type OpenAIResponseLike = Pick<
  OpenAI.Responses.Response,
  "error" | "incomplete_details" | "output" | "output_text" | "status"
>;

export function buildOpenAIResponseParams(
  model: string,
  messages: LLMMessage[],
  options: LLMOptions = {}
): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  const { systemPrompt, maxTokens, reasoningEffort, responseFormat } = options;
  const modelCap = MODEL_MAX_COMPLETION_TOKENS[model] ?? 8000;
  const requestedTokens = maxTokens ?? 8000;
  const effectiveTokens = Math.min(
    modelCap,
    Math.max(requestedTokens + 2000, Math.ceil(requestedTokens * 1.5))
  );

  return {
    model,
    instructions: systemPrompt,
    input: messages.map((message) => ({ role: message.role, content: message.content })),
    max_output_tokens: effectiveTokens,
    reasoning: { effort: reasoningEffort ?? "medium" },
    store: false,
    ...(responseFormat ? {
      text: {
        verbosity: "low" as const,
        format: {
          type: "json_schema" as const,
          name: responseFormat.name,
          schema: responseFormat.schema,
          strict: true,
        },
      },
    } : {}),
  };
}

export function completedOpenAIResponseText(response: OpenAIResponseLike, model: string): string {
  if (response.error) {
    throw new ProviderResponseError(
      `OpenAI failed to complete the response (${model}, code: ${response.error.code ?? "unknown"}).`,
      "failed"
    );
  }
  if (response.status === "incomplete" || response.incomplete_details?.reason) {
    throw new ProviderResponseError(
      `OpenAI returned an incomplete response (${model}, reason: ${response.incomplete_details?.reason ?? "unknown"}).`,
      "incomplete"
    );
  }
  if (response.status !== "completed") {
    throw new ProviderResponseError(
      `OpenAI did not complete the response (${model}, status: ${response.status}).`,
      "failed"
    );
  }

  const refusal = response.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content)
    .find((item) => item.type === "refusal");
  if (refusal?.type === "refusal") {
    throw new ProviderResponseError(`OpenAI refused the request (${model}).`, "refusal");
  }

  const content = response.output_text?.trim();
  if (!content) {
    throw new ProviderResponseError(`OpenAI returned no output text (${model}).`, "empty_output");
  }
  return content;
}

export function buildOpenAIChatResponseFormat(
  responseFormat: NonNullable<LLMOptions["responseFormat"]>
): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming["response_format"] {
  return {
    type: "json_schema",
    json_schema: {
      name: responseFormat.name,
      schema: responseFormat.schema,
      strict: true,
    },
  };
}

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;
  private signal?: AbortSignal;

  constructor(apiKey: string, model = "gpt-5.6-terra", signal?: AbortSignal) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.signal = signal;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens, timeoutMs, responseFormat } = options;

    const modelCap = MODEL_MAX_COMPLETION_TOKENS[this.model] ?? 8000;
    const isReasoning = isReasoningModel(this.model);

    const requestedTokens = maxTokens ?? 8000;
    const effectiveTokens = isReasoning
      ? Math.min(modelCap, Math.max(requestedTokens + 2000, Math.ceil(requestedTokens * 1.5)))
      : Math.min(requestedTokens, modelCap);

    const effectiveTimeoutMs = Math.min(LLM_TIMEOUT_MS, Math.max(5_000, timeoutMs ?? LLM_TIMEOUT_MS));
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(new Error(`OpenAI request timed out after ${effectiveTimeoutMs / 1000}s (${this.model})`)), effectiveTimeoutMs);
    const combined = this.signal
      ? AbortSignal.any([this.signal, timeoutCtrl.signal])
      : timeoutCtrl.signal;

    try {
      if (isReasoning) {
        const response = await this.client.responses.create(
          buildOpenAIResponseParams(this.model, messages, options),
          { signal: combined }
        );
        return completedOpenAIResponseText(response, this.model);
      }

      const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
      for (const message of messages) fullMessages.push({ role: message.role, content: message.content });
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: fullMessages,
        max_tokens: effectiveTokens,
        temperature,
        ...(responseFormat ? {
          response_format: buildOpenAIChatResponseFormat(responseFormat),
        } : {}),
      }, { signal: combined });

      const choice = response.choices[0];
      const message = choice?.message;

      if (!message) {
        throw new ProviderResponseError(
          `OpenAI returned no choices (model: ${this.model}). May be blocked by safety filters.`,
          "empty_output"
        );
      }
      if (choice.finish_reason === "length") {
        throw new ProviderResponseError(
          `OpenAI returned an incomplete response (${this.model}, reason: max output tokens).`,
          "incomplete"
        );
      }
      if (message.refusal) {
        throw new ProviderResponseError(`OpenAI refused request (${this.model}): ${message.refusal}`, "refusal");
      }

      const content = message.content;
      if (!content || content.trim() === "") {
        throw new ProviderResponseError(
          `Empty response from ${this.model} (finish_reason: ${choice.finish_reason ?? "unknown"}).`,
          "empty_output"
        );
      }

      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}
