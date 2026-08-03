// =========================================================
// lib/llm-adapter/openai.ts
// OpenAI GPT-5.6 adapter — gpt-5.6-terra, gpt-5.6-sol, gpt-5.6-luna
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-5.6-terra") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 8000 } = options;

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
