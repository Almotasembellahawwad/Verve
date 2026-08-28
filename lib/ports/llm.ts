export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  timeoutMs?: number;
  responseFormat?: {
    name: string;
    schema: Record<string, unknown>;
  };
};

/** Provider-neutral outbound port used by generation use cases. */
export interface LLMPort {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}

export type LLMAdapter = LLMPort;
export type Provider = "anthropic" | "openai" | "gemini" | "openrouter";

