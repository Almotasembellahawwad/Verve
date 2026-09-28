import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMMessage, LLMOptions } from "../../ports/llm";
import { ProviderResponseError } from "../../errors/provider-response-error";

const LLM_TIMEOUT_MS = 30_000;
const OPUS_5_5_TIMEOUT_MS = 120_000;

const MODEL_MAX_TOKENS: Record<string, number> = {
  "claude-opus-5-5": 32_000,
  "claude-sonnet-4-6": 16_000,
  "claude-haiku-4-5-20251001": 16_000,
  "claude-opus-4-8": 16_000,
};

export function buildAnthropicRequest(
  model: string,
  messages: LLMMessage[],
  options: LLMOptions = {}
): Anthropic.MessageCreateParamsNonStreaming {
  const { systemPrompt, temperature = 0.7, maxTokens, reasoningEffort } = options;
  const modelCap = MODEL_MAX_TOKENS[model] ?? 8192;
  const requestedTokens = maxTokens ?? 8000;
  // Opus 5.5 always thinks; its output cap must leave room for visible text.
  const effectiveMaxTokens = model === "claude-opus-5-5"
    ? Math.min(modelCap, Math.max(requestedTokens + 4000, Math.ceil(requestedTokens * 1.5)))
    : Math.min(maxTokens ?? modelCap, modelCap);
  const request: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: effectiveMaxTokens,
    system: systemPrompt,
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
  };
  if (model === "claude-opus-5-5") {
    request.output_config = { effort: reasoningEffort === "none" ? "low" : reasoningEffort ?? "medium" };
  } else if (!model.startsWith("claude-opus-4-")) {
    request.temperature = temperature;
  }
  return request;
}

export function completedAnthropicResponseText(
  response: Pick<Anthropic.Message, "content" | "stop_reason">,
  model: string
): string {
  if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
    throw new ProviderResponseError(`Anthropic returned an incomplete response (${model}, reason: ${response.stop_reason}).`, "incomplete");
  }
  if (response.stop_reason === "refusal") {
    throw new ProviderResponseError(`Anthropic refused the request (${model}).`, "refusal");
  }
  const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
  if (!text) {
    throw new ProviderResponseError(`Anthropic returned no output text (${model}).`, "empty_output");
  }
  return text;
}

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
    const modelTimeoutMs = this.model === "claude-opus-5-5" ? OPUS_5_5_TIMEOUT_MS : LLM_TIMEOUT_MS;
    const effectiveTimeoutMs = Math.min(modelTimeoutMs, Math.max(5_000, options.timeoutMs ?? modelTimeoutMs));
    const timeoutController = new AbortController();
    const timer = setTimeout(
      () => timeoutController.abort(new Error(`Anthropic request timed out after ${effectiveTimeoutMs / 1000}s`)),
      effectiveTimeoutMs
    );
    const signal = this.signal
      ? AbortSignal.any([this.signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const request = buildAnthropicRequest(this.model, messages, options);
      const response = await this.client.messages.create(request, { signal });
      return completedAnthropicResponseText(response, this.model);
    } finally {
      clearTimeout(timer);
    }
  }
}
