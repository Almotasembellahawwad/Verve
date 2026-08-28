import type {
  BlocklistRepositoryPort,
  ClicheSuggestion,
  ClicheSuggestionRepositoryPort,
  DocumentRepositoryPort,
  ReferenceLibraryRepositoryPort,
} from "../ports/repositories";

export function readBlocklistUseCase(repository: BlocklistRepositoryPort) {
  return repository.get();
}

export function readReferenceLibraryUseCase(repository: ReferenceLibraryRepositoryPort) {
  return { entries: repository.list() };
}

export function readDocumentUseCase(repository: DocumentRepositoryPort, name: string): string {
  return repository.read(name);
}

export function submitClicheSuggestionUseCase(
  repository: ClicheSuggestionRepositoryPort,
  suggestion: ClicheSuggestion,
  requestId: string
): void {
  repository.submit(suggestion, requestId);
}

