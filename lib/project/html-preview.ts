import type { GeneratedProject } from "./types";
import type { VerveProjectSpec } from "../domain/project-spec";
import { createRenderProbeSource, type RenderProbeContext } from "./render-gate";
import { projectFileDataUrl } from "./brand-kit";
import { cssWithoutComments, normalizeProjectPath, resolveProjectResource, rewriteCssResourceUrls, rewriteJavaScriptImports } from "./resource-paths";
import {
  escapeHtmlAttribute,
  escapeRawTextEndTags,
  hasHtmlStartTag,
  insertBeforeHtmlEndTag,
  rewriteHtmlElements,
} from "../security/structural-html";

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
    .map((item) => [normalizeProjectPath(item.path), item.content]));
  const entryPath = normalizeProjectPath(options?.entryFile || project.entryFile || "index.html") ?? "index.html";
  let html = files.get(entryPath) ?? files.get("index.html") ?? "";

  const inlineAssets = (content: string, from: string) => {
    return content.replace(/(["'])([^"'\r\n]+)\1/g, (original, quote: string, reference: string) => {
      const path = resolveProjectResource(from, reference);
      const asset = project.files.find((file) => normalizeProjectPath(file.path) === path);
      const url = asset ? projectFileDataUrl(asset) : null;
      return url ? `${quote}${url}${reference.includes("#") ? `#${reference.split("#").slice(1).join("#")}` : ""}${quote}` : original;
    });
  };
  const inlineCss = (css: string, from: string, ancestors = new Set<string>()): string => {
    if (ancestors.has(from)) return "/* Circular local stylesheet import omitted. */";
    const visited = new Set([...ancestors, from]);
    const imports = cssWithoutComments(css).replace(/@import\s+(?:url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)|["']([^"']+)["'])\s*([^;]*);/gi,
      (original, quoted: string, unquoted: string, plain: string, conditions: string) => {
        const reference = quoted || unquoted || plain;
        const path = resolveProjectResource(from, reference);
        const imported = path ? files.get(path) : undefined;
        if (imported === undefined || !path) return original;
        let result = inlineCss(imported, path, visited);
        let remaining = conditions.trim();
        const layer = remaining.match(/^layer(?:\(([\w.-]+)\))?(?:\s+|$)/i);
        if (layer) remaining = remaining.slice(layer[0].length).trim();
        let supports: string | undefined;
        if (/^supports\(/i.test(remaining)) {
          let depth = 1, cursor = "supports(".length;
          for (; cursor < remaining.length && depth; cursor++) {
            if (remaining[cursor] === "(") depth++;
            if (remaining[cursor] === ")") depth--;
          }
          if (!depth) {
            supports = remaining.slice("supports(".length, cursor - 1);
            remaining = remaining.slice(cursor).trim();
          }
        }
        if (remaining) result = `@media ${remaining} {\n${result}\n}`;
        if (supports) result = `@supports (${supports}) {\n${result}\n}`;
        if (layer) result = `@layer${layer[1] ? ` ${layer[1]}` : ""} {\n${result}\n}`;
        return result;
      });
    return rewriteCssResourceUrls(imports, (reference) => {
      const path = resolveProjectResource(from, reference);
      const asset = project.files.find((file) => normalizeProjectPath(file.path) === path);
      return asset ? projectFileDataUrl(asset) ?? reference : reference;
    });
  };

  // Import maps preserve module boundaries and cycles without a build service.
  // Virtual URLs never leave the iframe: every delivered JS module maps to data.
  const moduleUrl = (path: string) => `https://verve-preview.invalid/${path}`;
  const moduleSource = (source: string, path: string) => rewriteJavaScriptImports(inlineAssets(source, entryPath), (reference) => {
    const target = resolveProjectResource(path, reference);
    return target && files.has(target) ? moduleUrl(target) : reference;
  });
  const moduleMap = Object.fromEntries([...files].filter(([path]) => path && /\.(?:js|mjs)$/i.test(path))
    .map(([path, source]) => [moduleUrl(path!), `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource(source, path!))}`]));

  html = rewriteHtmlElements(html, "link", (element) => {
      const href = element.attributes.get("href");
      const rel = element.attributes.get("rel")?.toLowerCase() ?? "";
      if (!href) return element.source;
      const localPath = resolveProjectResource(entryPath, href);
      const css = localPath ? files.get(localPath) : undefined;
      if (!css || !rel.split(/\s+/).includes("stylesheet")) return element.source;
      const media = element.attributes.has("disabled") ? "not all" : element.attributes.get("media");
      return `<style data-verve-source="${escapeHtmlAttribute(localPath!)}"${media ? ` media="${escapeHtmlAttribute(media)}"` : ""}>${escapeRawTextEndTags(inlineCss(css, localPath!), "style")}</style>`;
    });

  html = rewriteHtmlElements(html, "script", (element) => {
      const src = element.attributes.get("src");
      const isModule = element.attributes.get("type")?.toLowerCase() === "module";
      if (!src) return isModule
        ? `${element.openingTag}${escapeRawTextEndTags(moduleSource(element.content, entryPath), "script")}${element.closingTag}`
        : element.source;
      const localPath = resolveProjectResource(entryPath, src);
      const js = localPath ? files.get(localPath) : undefined;
      if (!js) return element.source;
      const source = isModule ? moduleSource(js, localPath!) : inlineAssets(js, entryPath);
      const marker = `data-verve-source="${escapeHtmlAttribute(localPath!)}"`;
      const asyncAttribute = element.attributes.has("async") ? " async" : "";
      const retainedAttributes = [...element.attributes].filter(([name]) => name === "id" || name === "class" || name === "nomodule" || name.startsWith("data-") || name.startsWith("aria-"))
        .map(([name, value]) => ` ${name}${value === null ? "" : `="${escapeHtmlAttribute(value)}"`}`).join("");
      if (isModule) {
        // Import the canonical mapped module rather than copying its source
        // into another module identity. Repeated src references and cycles
        // back to the entry must initialize that file exactly once.
        return `<script type="module"${asyncAttribute}${retainedAttributes} ${marker}>import ${escapeRawTextEndTags(JSON.stringify(moduleUrl(localPath!)), "script")};</script>`;
      }
      // defer has no effect on inline classic scripts. A local data URL keeps
      // the original loading/order semantics, globals and DOM-ready timing.
      if (!isModule && (element.attributes.has("defer") || element.attributes.has("async"))) {
        return `<script ${marker}${asyncAttribute}${retainedAttributes}${element.attributes.has("defer") ? " defer" : ""} src="${escapeHtmlAttribute(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`)}"></script>`;
      }
      return `<script${asyncAttribute}${retainedAttributes} ${marker}>${escapeRawTextEndTags(source, "script")}</script>`;
    });

  if (!hasHtmlStartTag(html, "meta", (attributes) => attributes.get("name")?.toLowerCase() === "viewport")) {
    html = insertBeforeHtmlEndTag(html, "head", '<meta name="viewport" content="width=device-width,initial-scale=1">');
  }

  html = inlineAssets(html, entryPath);
  if (Object.keys(moduleMap).length) {
    const importMap = `<script type="importmap">${escapeRawTextEndTags(JSON.stringify({ imports: moduleMap }), "script")}</script>`;
    html = rewriteHtmlElements(html, "head", (element) => `${element.openingTag}${importMap}${element.content}${element.closingTag}`);
  }

  const probe = `<script data-verve-render-probe>${escapeRawTextEndTags(createRenderProbeSource(probeId, projectSpec, options), "script")}</script>`;
  // Subscribe before authored head scripts/resources, not after they failed.
  return hasHtmlStartTag(html, "head")
    ? rewriteHtmlElements(html, "head", (element) => `${element.openingTag}${probe}${element.content}${element.closingTag}`)
    : `${probe}\n${html}`;
}
