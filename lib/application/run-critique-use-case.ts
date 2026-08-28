import type { LLMPort } from "../ports/llm";
import { critiqueDesign, type DesignCritique } from "../engine/design-critic";

export type CritiqueInput = { url?: string; code?: string; screenshot?: string };

export function runCritiqueUseCase(llm: LLMPort, input: CritiqueInput): Promise<DesignCritique> {
  return critiqueDesign(llm, input);
}
