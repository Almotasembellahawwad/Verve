// =========================================================
// lib/llm-adapter/openai.ts
// OpenAI adapter -- supports GPT-5.6 Terra/Sol/Luna and GPT-4o mini
//
// GPT-5.6 family are Reasoning Models (Responses-compatible):
//   - Use max_completion_tokens (NOT max_tokens)
//   - Use reasoning_effort (flat param in Chat Completions API)
//   - Do NOT set temperature (ignored / causes errors)
//
// Source: https://developers.openai.com/api/docs/guides/upgrading-to-gpt-5p6-sol
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";
import { isReasoningModel } from "./types";

// Per-model max completion tokens (balanced quality vs cost)
// GPT-5.6 Terra/Sol/Luna: huge capacity — capped at 12K for code gen
// (~$0.14/gen for Terra, ~$0.35/gen for Sol — very reasonable)
// GPT-4o-mini: 16K max — cap at 8K
const MODEL_MAX_COMPLETION_TOKENS: Record<string, number> = {
  "gpt-5.6-terra": 12000,
  "gpt-5.6-sol":   12000,
  "gpt-5.6-luna":  8000,  // Luna = high-volume efficient tier
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
    const { systemPrompt, temperature = 0.7, maxTokens } = options;

    const modelCap = MODEL_MAX_COMPLETION_TOKENS[this.model] ?? 8000;
    const effectiveTokens = maxTokens ? Math.min(maxTokens, modelCap) : modelCap;

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) fullMessages.push({ role: "system", content: systemPrompt });
    for (const m of messages) fullMessages.push({ role: m.role, content: m.content });

    const isReasoning = isReasoningModel(this.model);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model:    this.model,
      messages: fullMessages,
    };

    if (isReasoning) {
      // GPT-5.6 / o-series: use max_completion_tokens (NOT max_tokens)
      // and reasoning_effort instead of temperature
      params.max_completion_tokens = effectiveTokens;
      params.reasoning_effort = "medium"; // none|low|medium|high|xhigh|max
      // Do NOT set temperature for reasoning models — causes API 400 error
    } else {
      // Classic models (gpt-4o-mini etc): use max_tokens + temperature
      params.max_tokens  = effectiveTokens;
      params.temperature = temperature;
    }

    const response = await this.client.chat.completions.create(params);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error(`No content in OpenAI response (model: ${this.model})`);
    return content;
  }
}
