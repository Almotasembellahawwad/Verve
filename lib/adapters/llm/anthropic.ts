import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMMessage, LLMOptions } from "../../ports/llm";

const LLM_TIMEOUT_MS = 30_000;

const MODEL_MAX_TOKENS: Record<string, number> = {
  "claude-sonnet-4-6": 16_000,
  "claude-haiku-4-5-20251001": 16_000,
  "claude-opus-4-8": 16_000,
};

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;
  private signal?: AbortSignal;

  constructor(apiKey: string, model = "claude-sonnet-4-6", signal?: AbortSignal) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.signal = signal;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens, timeoutMs } = options;
    const effectiveMaxTokens = Math.min(
      maxTokens ?? MODEL_MAX_TOKENS[this.model] ?? 8000,
      MODEL_MAX_TOKENS[this.model] ?? 8192
    );
    const effectiveTimeoutMs = Math.min(LLM_TIMEOUT_MS, Math.max(5_000, timeoutMs ?? LLM_TIMEOUT_MS));
    const timeoutController = new AbortController();
    const timer = setTimeout(
      () => timeoutController.abort(new Error(`Anthropic request timed out after ${effectiveTimeoutMs / 1000}s`)),
      effectiveTimeoutMs
    );
    const signal = this.signal
      ? AbortSignal.any([this.signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const request: Anthropic.MessageCreateParamsNonStreaming = {
        model: this.model,
        max_tokens: effectiveMaxTokens,
        system: systemPrompt,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
      };
      if (!this.model.startsWith("claude-opus-4-")) request.temperature = temperature;

      const response = await this.client.messages.create(request, { signal });
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error(`No text content in Anthropic response (model: ${this.model})`);
      }
      return textBlock.text;
    } finally {
      clearTimeout(timer);
    }
  }
}
