// =========================================================
// lib/llm-adapter/openai.ts
// OpenAI adapter -- supports GPT-5.6 Terra/Sol/Luna and GPT-4o mini
//
// GPT-5.6 family are Reasoning Models:
//   - Use max_completion_tokens (NOT max_tokens)
//   - Use reasoning_effort (per-call, from LLMOptions.reasoningEffort)
//   - Do NOT set temperature (causes 400 error for reasoning models)
//
// IMPORTANT: max_completion_tokens includes BOTH reasoning tokens AND
// output tokens. Set it high enough so the model has budget left for
// actual output after internal reasoning.
//
// Source: https://developers.openai.com/api/docs/guides/upgrading-to-gpt-5p6-sol
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";
import { isReasoningModel } from "./types";

// Per-model max_completion_tokens
// These cover BOTH internal reasoning + actual output.
// Set high so reasoning doesn't eat all the budget before output is written.
const MODEL_MAX_COMPLETION_TOKENS: Record<string, number> = {
  "gpt-5.6-terra": 20000, // reasoning ~5-8K + output ~8-12K = need 20K headroom
  "gpt-5.6-sol":   20000,
  "gpt-5.6-luna":  12000, // Luna is more efficient, less reasoning overhead
  "gpt-4o":        8000,
  "gpt-4o-mini":   8000,
};

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-5.6-terra") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens, reasoningEffort } = options;

    const modelCap = MODEL_MAX_COMPLETION_TOKENS[this.model] ?? 8000;
    const isReasoning = isReasoningModel(this.model);

    // For reasoning models: always use full model cap so reasoning tokens
    // don't consume the entire budget before actual output is written.
    // For classic models: respect caller's maxTokens for cost control.
    const effectiveTokens = isReasoning
      ? modelCap
      : Math.min(maxTokens ?? modelCap, modelCap);

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
    for (const m of messages) fullMessages.push({ role: m.role, content: m.content });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model:    this.model,
      messages: fullMessages,
    };

    if (isReasoning) {
      params.max_completion_tokens = effectiveTokens;
      // Per-call reasoning effort from options (default: "medium")
      // Pipeline stages that produce short JSON use "low" to save tokens
      params.reasoning_effort = reasoningEffort ?? "medium";
      // Do NOT set temperature -- causes API 400 for reasoning models
    } else {
      params.max_tokens  = effectiveTokens;
      params.temperature = temperature;
    }

    const response = await this.client.chat.completions.create(params);

    const choice  = response.choices[0];
    const message = choice?.message;

    if (!message) {
      throw new Error(`OpenAI returned no choices (model: ${this.model}). Request may have been blocked by safety filters.`);
    }

    if (message.refusal) {
      throw new Error(`OpenAI refused the request (model: ${this.model}): ${message.refusal}`);
    }

    const content = message.content;
    if (!content || content.trim() === "") {
      throw new Error(
        `Empty response from ${this.model}. ` +
        `Internal reasoning consumed the entire token budget before producing output. ` +
        `This is automatically resolved on retry.`
      );
    }

    return content;
  }
}
