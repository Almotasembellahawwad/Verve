import JSZip from "jszip";
import type { GeneratedProject, ProjectFile } from "../project/types";

const LOCAL_ASSET_ROOTS = "assets|demo-assets|fonts|icons|textures";
const ATTRIBUTE_ASSET = new RegExp(`(?:src|href)\\s*=\\s*["'](\\/(?:${LOCAL_ASSET_ROOTS})\\/[a-z0-9_./-]+)["']`, "gi");
const CSS_ASSET = new RegExp(`url\\(\\s*["']?(\\/(?:${LOCAL_ASSET_ROOTS})\\/[a-z0-9_./-]+)["']?\\s*\\)`, "gi");

export function referencedLocalAssetPaths(files: ProjectFile[]): string[] {
  const paths = new Set<string>();
  for (const file of files) {
    if (file.encoding === "base64") continue;
    for (const expression of [ATTRIBUTE_ASSET, CSS_ASSET]) {
      expression.lastIndex = 0;
      for (const match of file.content.matchAll(expression)) {
        const path = match[1];
        if (path && !path.includes("..")) paths.add(path);
      }
    }
  }
  return [...paths].sort();
}

function archiveAssetPath(project: GeneratedProject, publicPath: string): string {
  return project.framework === "html" ? publicPath.slice(1) : `public${publicPath}`;
}

export async function createProjectArchive(project: GeneratedProject): Promise<Blob> {
  const zip = new JSZip();
  const archivedPaths = new Set(project.files.map((file) => file.path));
  for (const item of project.files) {
    zip.file(item.path, item.content, item.encoding === "base64" ? { base64: true } : undefined);
  }

  for (const publicPath of referencedLocalAssetPaths(project.files)) {
    const targetPath = archiveAssetPath(project, publicPath);
    if (archivedPaths.has(targetPath) || archivedPaths.has(publicPath.slice(1))) continue;
    const response = await fetch(publicPath);
    if (!response.ok) throw new Error(`Unable to package local asset ${publicPath} (${response.status}).`);
    zip.file(targetPath, await response.arrayBuffer());
  }

  return zip.generateAsync({ type: "blob" });
}

export async function downloadProjectArchive(project: GeneratedProject): Promise<void> {
  const blob = await createProjectArchive(project);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}
