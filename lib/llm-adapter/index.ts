import Anthropic from "@anthropic-ai/sdk";

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
};

export interface LLMAdapter {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(model = "claude-3-5-sonnet-20241022") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is required");
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<string> {
    const { systemPrompt, temperature = 0.7, maxTokens = 8000 } = options;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in LLM response");
    }
    return textBlock.text;
  }
}

// Singleton factory — swap adapter here to change provider
let adapterInstance: LLMAdapter | null = null;

export function getLLMAdapter(): LLMAdapter {
  if (!adapterInstance) {
    adapterInstance = new ClaudeAdapter();
  }
  return adapterInstance;
}
