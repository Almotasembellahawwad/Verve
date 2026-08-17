// =========================================================
// lib/llm-adapter/claude.ts
// Anthropic Claude adapter — with AbortSignal + timeout support
// =========================================================

import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const LLM_TIMEOUT_MS = 30_000; // 30s hard timeout per call

const MODEL_MAX_TOKENS: Record<string, number> = {
  "claude-3-5-sonnet-20241022": 8000,
  "claude-3-5-haiku-20241022": 8000,
  "claude-3-opus-20240229": 4000,
};

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;
  private signal?: AbortSignal;

  constructor(apiKey: string, model = "claude-3-5-sonnet-20241022", signal?: AbortSignal) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.signal = signal;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens } = options;

    const effectiveMaxTokens = Math.min(
      maxTokens ?? MODEL_MAX_TOKENS[this.model] ?? 8000,
      MODEL_MAX_TOKENS[this.model] ?? 8192
    );

    // Combine request signal with our hard timeout
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(new Error("Claude timeout")), LLM_TIMEOUT_MS);
    const combined = this.signal
      ? AbortSignal.any([this.signal, timeoutCtrl.signal])
      : timeoutCtrl.signal;

    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: effectiveMaxTokens,
          temperature,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        },
        { signal: combined }
      );

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error(`No text content in Claude response (model: ${this.model})`);
      }
      return textBlock.text;
    } finally {
      clearTimeout(timer);
    }
  }
}
