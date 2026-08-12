// =========================================================
// lib/llm-adapter/gemini.ts
// Google Gemini adapter
// Supports: gemini-2.0-flash, gemini-1.5-pro, gemini-2.0-flash-lite
//
// Per-model token caps:
//   gemini-2.0-flash:      8192 max output
//   gemini-1.5-pro:        8192 max output (1M context window!)
//   gemini-2.0-flash-lite: 8192 max output (cheapest)
// =========================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const MODEL_MAX_TOKENS: Record<string, number> = {
  "gemini-2.0-flash":      8000,
  "gemini-1.5-pro":        8000,
  "gemini-2.0-flash-lite": 4000, // Lite -- smaller cap but ultra fast
};

export class GeminiAdapter implements LLMAdapter {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.0-flash") {
    this.client = new GoogleGenerativeAI(apiKey);
    // Use model ID as-is — no aliases needed (we use real IDs in types.ts)
    this.model = model;
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

    const chat   = genModel.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const text   = result.response.text();

    if (!text) throw new Error(`No text in Gemini response (model: ${this.model})`);
    return text;
  }
}
