import type { GeneratedProject } from "../project/types";

export type EditorProjectOrigin = "generation" | "recovery" | "demo" | "import" | "blank";

export type EditorSnapshot = {
  id: string;
  label: string;
  createdAt: number;
  project: GeneratedProject;
};

export type EditorIteration = {
  id: string;
  createdAt: number;
  instruction: string;
  summary: string;
  provider: "anthropic" | "openai" | "gemini" | "openrouter";
  model: string;
  mode: "fast" | "studio";
  status: "accepted" | "rejected";
  files: string[];
};

export type EditorProjectRecord = {
  schemaVersion: 1;
  id: string;
  title: string;
  origin: EditorProjectOrigin;
  createdAt: number;
  updatedAt: number;
  project: GeneratedProject;
  snapshots: EditorSnapshot[];
  iterations?: EditorIteration[];
};

export interface EditorProjectRepositoryPort {
  get(id: string): Promise<EditorProjectRecord | undefined>;
  list(): Promise<EditorProjectRecord[]>;
  put(record: EditorProjectRecord): Promise<void>;
  delete(id: string): Promise<void>;
}
