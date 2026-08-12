// =========================================================
// lib/llm-adapter/openai.ts
// OpenAI adapter -- supports gpt-4o, gpt-4o-mini, o3-mini
// Maps legacy model aliases to real OpenAI model IDs.
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const MODEL_ALIASES: Record<string, string> = {
  "gpt-5.6-terra": "gpt-4o",
  "gpt-5.6-sol":   "gpt-4o",
  "gpt-5.6-luna":  "gpt-4o-mini",
};

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.client = new OpenAI({ apiKey });
    this.model = MODEL_ALIASES[model] ?? model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 4000 } = options;

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      fullMessages.push({ role: "system", content: systemPrompt });
    }

    for (const m of messages) {
      fullMessages.push({ role: m.role, content: m.content });
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: fullMessages,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in OpenAI response");
    return content;
  }
}
