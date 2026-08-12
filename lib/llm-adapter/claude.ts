// =========================================================
// lib/llm-adapter/claude.ts
// Anthropic Claude adapter
// Supports: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022,
//           claude-3-opus-20240229
//
// Per-model token caps (balanced quality vs cost):
//   claude-3-5-sonnet: 8192 max output
//   claude-3-5-haiku:  8192 max output (cheap: ~$0.01/gen)
//   claude-3-opus:     4096 max output (expensive: use conservatively)
// =========================================================

import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const MODEL_MAX_TOKENS: Record<string, number> = {
  "claude-3-5-sonnet-20241022": 8000,
  "claude-3-5-haiku-20241022":  8000,
  "claude-3-opus-20240229":     4000, // Opus is expensive — keep conservative
};

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-3-5-sonnet-20241022") {
    this.client = new Anthropic({ apiKey });
    // Use model ID as-is — no aliases needed (we use real IDs in types.ts)
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens } = options;

    const effectiveMaxTokens = Math.min(
      maxTokens ?? MODEL_MAX_TOKENS[this.model] ?? 8000,
      MODEL_MAX_TOKENS[this.model] ?? 8192
    );

    const response = await this.client.messages.create({
      model:      this.model,
      max_tokens: effectiveMaxTokens,
      temperature,
      system:     systemPrompt,
      messages:   messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error(`No text content in Claude response (model: ${this.model})`);
    }
    return textBlock.text;
  }
}
