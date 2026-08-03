// =========================================================
// lib/llm-adapter/claude.ts
// Anthropic Claude adapter — claude-sonnet-5, claude-opus-5
// =========================================================

import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-5") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 8000 } = options;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in Claude response");
    }
    return textBlock.text;
  }
}
