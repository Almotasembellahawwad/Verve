// =========================================================
// lib/llm-adapter/gemini.ts
// Google Gemini adapter — with AbortSignal + timeout support
// =========================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const LLM_TIMEOUT_MS = 90_000; // 90s timeout per call

const MODEL_MAX_TOKENS: Record<string, number> = {
  "gemini-3.7-flash":       16_000,
  "gemini-3.5-flash":       16_000,
  "gemini-3.1-pro-preview": 16_000,
};

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
    const { systemPrompt, temperature = 0.7, maxTokens, timeoutMs } = options;

    const effectiveMaxTokens = Math.min(
      maxTokens ?? MODEL_MAX_TOKENS[this.model] ?? 8000,
      MODEL_MAX_TOKENS[this.model] ?? 8192
    );

    const generationConfig = {
      maxOutputTokens: effectiveMaxTokens,
      ...(!this.model.startsWith("gemini-3.7") ? { temperature } : {}),
    };
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
      const text   = result.response.text();

      if (!text) throw new Error(`No text in Gemini response (model: ${this.model})`);
      return text;
    } finally {
      clearTimeout(timer);
      this.signal?.removeEventListener("abort", abort);
    }
  }
}
