import type { LLMPort } from "../ports/llm";

export type PatchCodeInput = {
  currentCode: string;
  instruction: string;
  designPlan?: string;
  brief?: string;
  framework: "nextjs" | "react" | "html";
};

const SYSTEM_PROMPT = `You are a senior frontend developer applying precise, minimal edits to existing code.

PATCH MODE RULES:
1. Apply only the requested change and preserve unrelated code.
2. Return the complete updated code file, not a partial snippet.
3. Do not add unrequested features, sections, or styles.
4. Make the smallest logical interpretation when an instruction is ambiguous.
5. Preserve comments, class names, CSS variables, and structure unless relevant.
6. Return code only.`;

export async function runPatchUseCase(llm: LLMPort, input: PatchCodeInput): Promise<string> {
  const context = [
    input.brief ? `Original brief: "${input.brief}"` : "",
    input.designPlan ? `Design plan context:\n${input.designPlan}` : "",
  ].filter(Boolean).join("\n\n");
  const message = `${context ? `${context}\n\n---\n\n` : ""}Current code (${input.framework}):\n\`\`\`\n${input.currentCode}\n\`\`\`\n\nEDIT INSTRUCTION:\n${input.instruction}`;
  const patched = await llm.complete([{ role: "user", content: message }], {
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 12_000,
  });
  return patched.replace(/^```[\w]*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
}

