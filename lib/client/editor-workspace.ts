import type {
  EditorProjectOrigin,
  EditorProjectRecord,
  EditorSnapshot,
} from "../ports/editor-projects";
import type { GeneratedProject } from "../project/types";
import { validateGeneratedProject } from "../project/project-validator";
import { evaluateProjectReadiness } from "../project/readiness";
import { IndexedDbEditorProjectRepository } from "../adapters/storage/indexeddb-editor-project-repository";

const ACTIVE_PROJECT_KEY = "verve_editor_active_project";
const MAX_SNAPSHOTS = 8;
const editorRepository = new IndexedDbEditorProjectRepository();

function repository(): IndexedDbEditorProjectRepository {
  return editorRepository;
}

function canonicalProject(project: GeneratedProject): GeneratedProject {
  const validation = validateGeneratedProject(project);
  return {
    ...project,
    validation,
    readiness: evaluateProjectReadiness(validation, project.warnings),
  };
}

export function createEditorProjectRecord(
  project: GeneratedProject,
  origin: EditorProjectOrigin,
  now = Date.now(),
  id = crypto.randomUUID()
): EditorProjectRecord {
  return {
    schemaVersion: 1,
    id,
    title: project.name,
    origin,
    createdAt: now,
    updatedAt: now,
    project: canonicalProject(project),
    snapshots: [],
  };
}

export async function createEditorProject(
  project: GeneratedProject,
  origin: EditorProjectOrigin,
  id?: string
): Promise<EditorProjectRecord> {
  const record = createEditorProjectRecord(project, origin, Date.now(), id);
  await repository().put(record);
  setActiveEditorProjectId(record.id);
  return record;
}

export async function listEditorProjects(): Promise<EditorProjectRecord[]> {
  return repository().list();
}

export async function getEditorProject(id: string): Promise<EditorProjectRecord | undefined> {
  return repository().get(id);
}

export async function saveEditorProject(
  record: EditorProjectRecord,
  project: GeneratedProject,
  title = record.title
): Promise<EditorProjectRecord> {
  const updated: EditorProjectRecord = {
    ...record,
    title: title.trim().slice(0, 120) || project.name,
    updatedAt: Date.now(),
    project: canonicalProject(project),
  };
  await repository().put(updated);
  return updated;
}

export async function createEditorSnapshot(
  record: EditorProjectRecord,
  project: GeneratedProject,
  label?: string
): Promise<EditorProjectRecord> {
  const snapshot: EditorSnapshot = {
    id: crypto.randomUUID(),
    label: label?.trim().slice(0, 80) || `Snapshot ${record.snapshots.length + 1}`,
    createdAt: Date.now(),
    project: canonicalProject(project),
  };
  const updated: EditorProjectRecord = {
    ...record,
    updatedAt: snapshot.createdAt,
    project: snapshot.project,
    snapshots: [snapshot, ...record.snapshots].slice(0, MAX_SNAPSHOTS),
  };
  await repository().put(updated);
  return updated;
}

export async function deleteEditorProject(id: string): Promise<void> {
  await repository().delete(id);
  if (getActiveEditorProjectId() === id) localStorage.removeItem(ACTIVE_PROJECT_KEY);
}

export function getActiveEditorProjectId(): string | null {
  try { return localStorage.getItem(ACTIVE_PROJECT_KEY); } catch { return null; }
}

export function setActiveEditorProjectId(id: string): void {
  try { localStorage.setItem(ACTIVE_PROJECT_KEY, id); } catch { /* workspace remains open in memory */ }
}

export async function launchProjectEditor(project: GeneratedProject, origin: EditorProjectOrigin): Promise<string> {
  const record = await createEditorProject(project, origin);
  return `/editor?project=${encodeURIComponent(record.id)}`;
}
