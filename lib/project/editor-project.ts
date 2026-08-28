import type { GeneratedProject } from "./types";
import { projectFileDataUrl } from "./brand-kit";

export type EditorFileMap = Record<string, { code: string } | undefined>;

function restoreCanonicalContent(project: GeneratedProject, content: string): string {
  let restored = content.replace(/^import\s+["']\.\/__verve_render_probe["'];?\r?\n/, "");
  for (const asset of project.files) {
    const dataUrl = projectFileDataUrl(asset);
    if (!dataUrl) continue;
    const path = asset.path.replace(/^\/+/, "");
    const reference = path.startsWith("public/") ? `/${path.replace(/^public\//, "")}` : `./${path}`;
    restored = restored.split(dataUrl).join(reference);
  }
  return restored;
}

/** Merge the live editor state into the canonical project before validation/export. */
export function mergeEditorFiles(project: GeneratedProject, editorFiles: EditorFileMap): GeneratedProject {
  return {
    ...project,
    files: project.files.map((file) => ({
      ...file,
      content: restoreCanonicalContent(project, editorFiles[`/${file.path}`]?.code ?? file.content),
    })),
  };
}
