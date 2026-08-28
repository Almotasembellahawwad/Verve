import type { GeneratedProject } from "../project/types";

export type EditorProjectOrigin = "generation" | "recovery" | "demo" | "import" | "blank";

export type EditorSnapshot = {
  id: string;
  label: string;
  createdAt: number;
  project: GeneratedProject;
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
};

export interface EditorProjectRepositoryPort {
  get(id: string): Promise<EditorProjectRecord | undefined>;
  list(): Promise<EditorProjectRecord[]>;
  put(record: EditorProjectRecord): Promise<void>;
  delete(id: string): Promise<void>;
}
