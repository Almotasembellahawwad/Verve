// =========================================================
// lib/llm-adapter/claude.ts
// Anthropic Claude adapter -- supports claude-3-5-sonnet-20241022, etc.
// Maps legacy model aliases to real Anthropic model IDs.
// =========================================================

import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const MODEL_ALIASES: Record<string, string> = {
  "claude-sonnet-5":           "claude-3-5-sonnet-20241022",
  "claude-opus-5":             "claude-3-opus-20240229",
  "claude-haiku-4-5-20251001": "claude-3-5-haiku-20241022",
};

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-3-5-sonnet-20241022") {
    this.client = new Anthropic({ apiKey });
    this.model = MODEL_ALIASES[model] ?? model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 4000 } = options;

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
