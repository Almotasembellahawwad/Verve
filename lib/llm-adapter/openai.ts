// =========================================================
// lib/llm-adapter/openai.ts
// OpenAI adapter -- supports GPT-5.6 Terra/Sol, GPT-4o mini
//
// GPT-5.6 Terra and Sol are Reasoning Models that use
// `reasoning_effort` instead of `temperature`.
// We detect this automatically via isReasoningModel().
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";
import { isReasoningModel } from "./types";

// Per-model max output tokens (balanced between quality and cost)
// GPT-5.6 Terra: 128K available — we cap at 12K for code gen to keep cost sane ($0.14/gen)
// GPT-4o-mini  : 16K available  — we cap at 8K
const MODEL_MAX_TOKENS: Record<string, number> = {
  "gpt-5.6-terra": 12000,
  "gpt-5.6-sol":   12000,
  "gpt-4o":        8000,
  "gpt-4o-mini":   8000,
};

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-5.6-terra") {
    this.client = new OpenAI({ apiKey });
    // No alias mapping — use the exact model ID as-is
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens } = options;

    // Per-model token cap: caller's maxTokens → model cap → 8000 fallback
    const effectiveMaxTokens = Math.min(
      maxTokens ?? MODEL_MAX_TOKENS[this.model] ?? 8000,
      MODEL_MAX_TOKENS[this.model] ?? 128000
    );

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
    for (const m of messages) fullMessages.push({ role: m.role, content: m.content });

    const isReasoning = isReasoningModel(this.model);

    // Reasoning models (GPT-5.6, o-series) use reasoning_effort instead of temperature
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model:      this.model,
      max_tokens: effectiveMaxTokens,
      messages:   fullMessages,
    };

    if (isReasoning) {
      // Reasoning models: medium effort = smart quality at reasonable cost
      params.reasoning_effort = "medium";
      // Do NOT set temperature for reasoning models — API returns error
    } else {
      params.temperature = temperature;
    }

    const response = await this.client.chat.completions.create(params);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error(`No content in OpenAI response (model: ${this.model})`);
    return content;
  }
}
