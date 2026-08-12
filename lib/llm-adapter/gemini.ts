// =========================================================
// lib/llm-adapter/gemini.ts
// Google Gemini adapter -- supports gemini-2.0-flash, etc.
// Maps legacy model aliases to real Gemini model IDs.
// =========================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const MODEL_ALIASES: Record<string, string> = {
  "gemini-3.6-flash":      "gemini-2.0-flash",
  "gemini-3.1-pro":        "gemini-1.5-pro",
  "gemini-3.5-flash-lite": "gemini-2.0-flash-lite",
};

export class GeminiAdapter implements LLMAdapter {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.0-flash") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = MODEL_ALIASES[model] ?? model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 4000 } = options;

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    // Gemini uses "user"/"model" roles (not "assistant")
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) throw new Error("No messages provided");

    const chat = genModel.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const text = result.response.text();

    if (!text) throw new Error("No text in Gemini response");
    return text;
  }
}
