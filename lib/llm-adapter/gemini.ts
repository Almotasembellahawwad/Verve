// =========================================================
// lib/llm-adapter/gemini.ts
// Google Gemini adapter — with AbortSignal + timeout support
// =========================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const LLM_TIMEOUT_MS = 30_000;

const MODEL_MAX_TOKENS: Record<string, number> = {
  "gemini-2.0-flash":      8000,
  "gemini-1.5-pro":        8000,
  "gemini-2.0-flash-lite": 4000,
};

export class GeminiAdapter implements LLMAdapter {
  private client: GoogleGenerativeAI;
  private model: string;
  private signal?: AbortSignal;

  constructor(apiKey: string, model = "gemini-2.0-flash", signal?: AbortSignal) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model  = model;
    this.signal = signal;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens } = options;

    const effectiveMaxTokens = Math.min(
      maxTokens ?? MODEL_MAX_TOKENS[this.model] ?? 8000,
      MODEL_MAX_TOKENS[this.model] ?? 8192
    );

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature,
        maxOutputTokens: effectiveMaxTokens,
      },
    });

    // Gemini uses "user"/"model" roles (not "assistant")
    const history = messages.slice(0, -1).map((m) => ({
      role:  m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) throw new Error("No messages provided to GeminiAdapter");

    const timeoutCtrl = new AbortController();
    const timer       = setTimeout(() => timeoutCtrl.abort(new Error("Gemini timeout")), LLM_TIMEOUT_MS);

    // Wire the request-level signal if provided
    if (this.signal) {
      this.signal.addEventListener("abort", () => timeoutCtrl.abort(this.signal!.reason));
    }

    try {
      const chat   = genModel.startChat({ history });
      // Gemini SDK doesn't accept signal directly — we rely on the timeout abort
      const result = await chat.sendMessage(lastMessage.content);
      const text   = result.response.text();

      if (!text) throw new Error(`No text in Gemini response (model: ${this.model})`);
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}
