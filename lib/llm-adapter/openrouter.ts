// =========================================================
// lib/llm-adapter/openrouter.ts
// OpenRouter adapter -- OpenAI-compatible API at openrouter.ai
//
// Free models supported:
//   google/gemma-4-31b-it:free  -- Google Gemma 4 31B (free tier)
//   openai/gpt-oss-20b:free     -- OpenAI GPT OSS 20B (free tier)
//
// OpenRouter is OpenAI API-compatible: same request/response shape,
// different base URL and Authorization header format.
// No separate SDK needed -- uses openai npm package with baseURL override.
// =========================================================

import OpenAI from "openai";
import type { LLMAdapter, LLMMessage, LLMOptions } from "./types";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "google/gemma-4-31b-it:free") {
    // OpenAI SDK supports baseURL override -- this is the official pattern
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE,
      defaultHeaders: {
        // OpenRouter leaderboard attribution (optional but good practice)
        "HTTP-Referer": "https://verve-design.vercel.app",
        "X-Title": "Verve Design Intelligence",
      },
    });
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 8000 } = options;

    const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      fullMessages.push({ role: "system", content: systemPrompt });
    }

    for (const m of messages) {
      fullMessages.push({ role: m.role, content: m.content });
    }

    const response = await this.client.chat.completions.create({
      model:      this.model,
      max_tokens: maxTokens,
      temperature,
      messages:   fullMessages,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error(`No content in OpenRouter response (model: ${this.model})`);
    return content;
  }
}
