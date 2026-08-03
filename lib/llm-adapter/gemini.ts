// =========================================================
// lib/llm-adapter/gemini.ts
// Google Gemini adapter — gemini-3.6-flash, gemini-3.1-pro
// =========================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

export class GeminiAdapter implements LLMAdapter {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model = "gemini-3.6-flash") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 8000 } = options;

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    // Gemini uses "user"/"model" roles (not "assistant")
    // Convert messages to Gemini format
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
