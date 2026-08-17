// =========================================================
// lib/llm-adapter/openai.ts
// OpenAI adapter — with AbortSignal + timeout support
//
// GPT-5.6 family are Reasoning Models:
//   - Use max_completion_tokens (NOT max_tokens)
//   - Use reasoning_effort (per-call, from LLMOptions.reasoningEffort)
//   - Do NOT set temperature (causes 400 error for reasoning models)
//
// max_completion_tokens includes BOTH reasoning tokens AND output tokens.
// Set it high enough so the model has budget left for actual output.
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";
import { isReasoningModel } from "./types";

const LLM_TIMEOUT_MS = 120_000; // 120s for reasoning models & code generation

// Per-model caps: cover BOTH internal reasoning + actual output.
const MODEL_MAX_COMPLETION_TOKENS: Record<string, number> = {
  "gpt-5.6-terra": 25000,
  "gpt-5.6-sol":   25000,
  "gpt-5.6-luna":  16000,
  "gpt-4o":        12000,
  "gpt-4o-mini":   8000,
};

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;
  private signal?: AbortSignal;

  constructor(apiKey: string, model = "gpt-5.6-terra", signal?: AbortSignal) {
    this.client = new OpenAI({ apiKey });
    this.model  = model;
    this.signal = signal;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens, reasoningEffort } = options;

    const modelCap    = MODEL_MAX_COMPLETION_TOKENS[this.model] ?? 8000;
    const isReasoning = isReasoningModel(this.model);

    // For reasoning models: use full model cap so reasoning doesn't eat output budget.
    // For classic models: respect caller's maxTokens for cost control.
    const effectiveTokens = isReasoning
      ? modelCap
      : Math.min(maxTokens ?? modelCap, modelCap);

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
    for (const m of messages) fullMessages.push({ role: m.role, content: m.content });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = { model: this.model, messages: fullMessages };

    if (isReasoning) {
      params.max_completion_tokens = effectiveTokens;
      params.reasoning_effort      = reasoningEffort ?? "medium";
      // Do NOT set temperature — causes 400 for reasoning models
    } else {
      params.max_tokens  = effectiveTokens;
      params.temperature = temperature;
    }

    const timeoutCtrl = new AbortController();
    const timer       = setTimeout(() => timeoutCtrl.abort(new Error(`OpenAI request timed out after ${LLM_TIMEOUT_MS / 1000}s (${this.model})`)), LLM_TIMEOUT_MS);
    const combined    = this.signal
      ? AbortSignal.any([this.signal, timeoutCtrl.signal])
      : timeoutCtrl.signal;

    try {
      const response = await this.client.chat.completions.create(params, { signal: combined });

      const choice  = response.choices[0];
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
          throw new Error(`Empty response from ${this.model}. The reasoning phase exhausted the max_completion_tokens budget before outputting text. Try choosing a model like gpt-5.6-luna or claude-3-5-sonnet.`);
        }
        throw new Error(`Empty response from ${this.model} (finish_reason: ${choice.finish_reason ?? "unknown"}).`);
      }

      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}
