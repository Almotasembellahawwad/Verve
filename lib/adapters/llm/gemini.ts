// =========================================================
// lib/adapters/llm/gemini.ts
// Google Gemini adapter — with AbortSignal + timeout support
// =========================================================

import { GoogleGenerativeAI, type EnhancedGenerateContentResponse } from "@google/generative-ai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "../../ports/llm";
import { ProviderResponseError } from "../../errors/provider-response-error";

const LLM_TIMEOUT_MS = 90_000; // 90s timeout per call

const MODEL_MAX_TOKENS: Record<string, number> = {
  "gemini-3.8-flash":       24_000,
  "gemini-3.7-flash":       16_000,
  "gemini-3.5-flash":       16_000,
  "gemini-3.1-pro-preview": 16_000,
};

export function buildGeminiGenerationConfig(model: string, options: LLMOptions = {}) {
  const modelCap = MODEL_MAX_TOKENS[model] ?? 8192;
  return {
    maxOutputTokens: Math.min(options.maxTokens ?? modelCap, modelCap),
    // Gemini 3.8 Flash rejects custom sampling parameters. Preserve the old-model behavior.
    ...(!model.startsWith("gemini-3.8") && !model.startsWith("gemini-3.7")
      ? { temperature: options.temperature ?? 0.7 }
      : {}),
  };
}

export function completedGeminiResponseText(
  response: Pick<EnhancedGenerateContentResponse, "candidates" | "text">,
  model: string
): string {
  if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    throw new ProviderResponseError(`Gemini returned an incomplete response (${model}, reason: max output tokens).`, "incomplete");
  }
  const text = response.text().trim();
  if (!text) {
    throw new ProviderResponseError(`Gemini returned no output text (${model}).`, "empty_output");
  }
  return text;
}

export class GeminiAdapter implements LLMAdapter {
  private client: GoogleGenerativeAI;
  private model: string;
  private signal?: AbortSignal;

  constructor(apiKey: string, model = "gemini-3.7-flash", signal?: AbortSignal) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model  = model;
    this.signal = signal;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, timeoutMs } = options;

    const generationConfig = buildGeminiGenerationConfig(this.model, options);
    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig,
    });

    // Gemini uses "user"/"model" roles (not "assistant")
    const history = messages.slice(0, -1).map((m) => ({
      role:  m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) throw new Error("No messages provided to GeminiAdapter");

    let rejectAbort: ((reason?: unknown) => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const abort = () => rejectAbort?.(this.signal?.reason ?? new Error("Gemini request cancelled"));
    this.signal?.addEventListener("abort", abort, { once: true });
    const effectiveTimeoutMs = Math.min(LLM_TIMEOUT_MS, Math.max(5_000, timeoutMs ?? LLM_TIMEOUT_MS));
    const timer = setTimeout(
      () => rejectAbort?.(new Error(`Gemini request timed out after ${effectiveTimeoutMs / 1000}s (${this.model})`)),
      effectiveTimeoutMs
    );

    try {
      const chat   = genModel.startChat({ history });
      const result = await Promise.race([chat.sendMessage(lastMessage.content), abortPromise]);
      return completedGeminiResponseText(result.response, this.model);
    } finally {
      clearTimeout(timer);
      this.signal?.removeEventListener("abort", abort);
    }
  }
}
