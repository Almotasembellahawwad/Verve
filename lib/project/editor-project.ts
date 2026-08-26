import type { GeneratedProject } from "./types";

export type EditorFileMap = Record<string, { code: string } | undefined>;

/** Merge the live editor state into the canonical project before validation/export. */
export function mergeEditorFiles(project: GeneratedProject, editorFiles: EditorFileMap): GeneratedProject {
  return {
    ...project,
    files: project.files.map((file) => ({
      ...file,
      content: editorFiles[`/${file.path}`]?.code ?? file.content,
    })),
  };
}
