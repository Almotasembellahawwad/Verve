// =========================================================
// lib/llm-adapter/openai.ts
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
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";
import { isReasoningModel } from "./types";

const LLM_TIMEOUT_MS = 120_000; // 120s for reasoning models & code generation

// Per-model caps: cover BOTH internal reasoning + actual output.
const MODEL_MAX_COMPLETION_TOKENS: Record<string, number> = {
  "gpt-5.6-terra": 30000,
  "gpt-5.6-sol": 30000,
  "gpt-5.6-luna": 20000,
  "gpt-4o": 15000,
  "gpt-4o-mini": 10000,
};

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
    const { systemPrompt, temperature = 0.7, maxTokens, reasoningEffort, timeoutMs } = options;

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
        const response = await this.client.responses.create({
          model: this.model,
          instructions: systemPrompt,
          input: messages.map((message) => ({ role: message.role, content: message.content })),
          max_output_tokens: effectiveTokens,
          reasoning: { effort: reasoningEffort ?? "medium" },
          store: false,
        }, { signal: combined });

        const content = response.output_text?.trim();
        if (!content) {
          const incompleteReason = response.incomplete_details?.reason;
          if (response.status === "incomplete" || incompleteReason) {
            throw new Error(`Incomplete response from ${this.model} (${incompleteReason ?? "unknown reason"}).`);
          }
          throw new Error(`OpenAI returned no output text (model: ${this.model}, status: ${response.status}).`);
        }
        return content;
      }

      const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
      for (const message of messages) fullMessages.push({ role: message.role, content: message.content });
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: fullMessages,
        max_tokens: effectiveTokens,
        temperature,
      }, { signal: combined });

      const choice = response.choices[0];
      const message = choice?.message;

      if (!message) {
        throw new Error(`OpenAI returned no choices (model: ${this.model}). May be blocked by safety filters.`);
      }
      if (message.refusal) {
        throw new Error(`OpenAI refused request (${this.model}): ${message.refusal}`);
      }

      const content = message.content;
      if (!content || content.trim() === "") {
        if (choice.finish_reason === "length") {
          throw new Error(`Empty response from ${this.model}. The reasoning phase exhausted its completion budget. Try a higher-output model or retry the request.`);
        }
        throw new Error(`Empty response from ${this.model} (finish_reason: ${choice.finish_reason ?? "unknown"}).`);
      }

      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}
