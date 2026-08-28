import type { ClicheSuggestion, ClicheSuggestionRepositoryPort } from "../../ports/repositories";

export class LoggedClicheSuggestionRepository implements ClicheSuggestionRepositoryPort {
  submit(suggestion: ClicheSuggestion, requestId: string): void {
    console.info(JSON.stringify({
      level: "info",
      event: "cliche_suggestion_submitted",
      requestId,
      suggestion,
    }));
  }
}

