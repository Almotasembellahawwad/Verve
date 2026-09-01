import type { GeneratedProject } from "./types";
import type { VerveProjectSpec } from "../domain/project-spec";
import { createRenderProbeSource, type RenderProbeContext } from "./render-gate";
import { replaceOwnedAssetReferences } from "./brand-kit";
import {
  escapeHtmlAttribute,
  escapeRawTextEndTags,
  hasHtmlStartTag,
  insertBeforeHtmlEndTag,
  rewriteHtmlElements,
} from "../security/structural-html";

function normalizePath(path: string): string {
  return path.replace(/^[./\\]+/, "").replace(/\\/g, "/");
}

/**
 * Assemble a standalone srcDoc from a generated HTML project. Local CSS and
 * JavaScript files are inlined for preview only; the editable project and ZIP
 * keep their original multi-file structure.
 */
export type HtmlPreviewOptions = RenderProbeContext & { entryFile?: string };

export function buildHtmlPreviewDocument(
  project: GeneratedProject,
  probeId: string,
  projectSpec?: VerveProjectSpec,
  options?: HtmlPreviewOptions
): string {
  if (project.framework !== "html") {
    throw new Error("Native HTML preview only accepts HTML projects.");
  }

  const files = new Map(project.files
    .filter((item) => item.encoding !== "base64")
    .map((item) => [normalizePath(item.path), item.content]));
  const entryPath = normalizePath(options?.entryFile || project.entryFile || "index.html");
  let html = files.get(entryPath) ?? files.get("index.html") ?? "";

  html = rewriteHtmlElements(html, "link", (element) => {
      const href = element.attributes.get("href");
      const rel = element.attributes.get("rel")?.toLowerCase() ?? "";
      if (!href) return element.source;
      const localPath = normalizePath(href.split(/[?#]/, 1)[0] ?? href);
      const css = files.get(localPath);
      if (!css || !rel.split(/\s+/).includes("stylesheet")) return element.source;
      return `<style data-verve-source="${escapeHtmlAttribute(localPath)}">${escapeRawTextEndTags(css, "style")}</style>`;
    });

  html = rewriteHtmlElements(html, "script", (element) => {
      const src = element.attributes.get("src");
      if (!src) return element.source;
      const localPath = normalizePath(src.split(/[?#]/, 1)[0] ?? src);
      const js = files.get(localPath);
      if (!js) return element.source;
      const moduleType = element.attributes.get("type")?.toLowerCase() === "module" ? ' type="module"' : "";
      return `<script${moduleType} data-verve-source="${escapeHtmlAttribute(localPath)}">${escapeRawTextEndTags(js, "script")}</script>`;
    });

  if (!hasHtmlStartTag(html, "meta", (attributes) => attributes.get("name")?.toLowerCase() === "viewport")) {
    html = insertBeforeHtmlEndTag(html, "head", '<meta name="viewport" content="width=device-width,initial-scale=1">');
  }

  html = replaceOwnedAssetReferences(html, project.files);

  const probe = `<script data-verve-render-probe>${escapeRawTextEndTags(createRenderProbeSource(probeId, projectSpec, options), "script")}</script>`;
  return insertBeforeHtmlEndTag(html, "body", probe);
}
