import type { GenerationMode } from "../domain/generation-mode";
import type { BrandProfile } from "../project/brand-kit";
import type { DesignDirectionFingerprint, DirectionBoard, DirectionCheckpoint } from "../domain/design-direction";
import type { LLMPort } from "../ports/llm";
import type { ReferenceLibraryRepositoryPort } from "../ports/repositories";
import { analyzeBriefLocally } from "../engine/brief-analyzer";
import { createDirectionCheckpoint, generateDirectionBoard } from "../engine/direction-board";

export type DirectionExplorationInput = {
  brief: string;
  framework: string;
  mode: GenerationMode;
  brandProfile?: BrandProfile;
  recentDirectionFingerprints?: DesignDirectionFingerprint[];
};

export async function runDirectionExplorationUseCase(
  input: DirectionExplorationInput,
  dependencies: { llm: LLMPort; referenceLibraryRepository: ReferenceLibraryRepositoryPort }
): Promise<{ board: DirectionBoard; checkpoint: DirectionCheckpoint }> {
  const analysis = analyzeBriefLocally(input.brief);
  const board = await generateDirectionBoard({
    llm: dependencies.llm,
    analysis,
    mode: input.mode,
    framework: input.framework,
    referenceRepository: dependencies.referenceLibraryRepository,
    recentDirectionFingerprints: input.recentDirectionFingerprints,
    brandContext: input.brandProfile ? JSON.stringify(input.brandProfile) : undefined,
  });
  return { board, checkpoint: createDirectionCheckpoint(board) };
}
