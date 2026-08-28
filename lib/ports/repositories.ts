import type { ClicheData } from "../domain/blocklist";
export type { ClicheData, ClicheEntry } from "../domain/blocklist";

export interface BlocklistRepositoryPort { get(): ClicheData; }

export type ReferenceEntry = {
  id: string;
  name: string;
  industry: string;
  mood: string[];
  what_makes_it_work: string;
  specific_techniques: string[];
  color_palette: string[];
  tags: string[];
};

export interface ReferenceLibraryRepositoryPort { list(): ReferenceEntry[]; }

export interface HistoryRepositoryPort<T extends { id: string; timestamp: number }> {
  list(): T[];
  put(entry: T): void;
  delete(id: string): void;
  clear(): void;
}

export interface DocumentRepositoryPort {
  read(name: string): string;
}

export type ClicheSuggestion = {
  pattern: string;
  example: string;
  category: "color" | "typography" | "layout" | "motion" | "copy";
  severity: "high" | "medium" | "low";
  context?: string;
};

export interface ClicheSuggestionRepositoryPort {
  submit(suggestion: ClicheSuggestion, requestId: string): void;
}
