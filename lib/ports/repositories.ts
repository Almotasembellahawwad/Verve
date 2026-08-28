export type ClicheEntry = {
  id: string;
  category: string;
  pattern: string;
  description: string;
  example_values: string[];
  severity: string;
  date_observed: string;
  tags: string[];
};

export type ClicheData = { version: string; cliches: ClicheEntry[] };

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

