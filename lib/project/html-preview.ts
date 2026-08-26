import type { GeneratedProject } from "./types";
import { createRenderProbeSource } from "./render-gate";

function normalizePath(path: string): string {
  return path.replace(/^[./\\]+/, "").replace(/\\/g, "/");
}

function escapeInlineScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script");
}

function escapeInlineStyle(code: string): string {
  return code.replace(/<\/style/gi, "<\\/style");
}

function injectBeforeClose(html: string, tag: "head" | "body", content: string): string {
  const close = new RegExp(`<\\/${tag}\\s*>`, "i");
  return close.test(html) ? html.replace(close, `${content}</${tag}>`) : `${html}\n${content}`;
}

/**
 * Assemble a standalone srcDoc from a generated HTML project. Local CSS and
 * JavaScript files are inlined for preview only; the editable project and ZIP
 * keep their original multi-file structure.
 */
export function buildHtmlPreviewDocument(project: GeneratedProject, probeId: string): string {
  if (project.framework !== "html") {
    throw new Error("Native HTML preview only accepts HTML projects.");
  }

  const files = new Map(project.files.map((item) => [normalizePath(item.path), item.content]));
  const entryPath = normalizePath(project.entryFile || "index.html");
  let html = files.get(entryPath) ?? files.get("index.html") ?? "";

  html = html.replace(
    /<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi,
    (link, before: string, href: string, after: string) => {
      const rel = `${before} ${after}`.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
      const localPath = normalizePath(href.split(/[?#]/, 1)[0] ?? href);
      const css = files.get(localPath);
      if (!css || !rel.split(/\s+/).includes("stylesheet")) return link;
      return `<style data-verve-source="${localPath}">${escapeInlineStyle(css)}</style>`;
    }
  );

  html = html.replace(
    /<script\b([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script\s*>/gi,
    (script, before: string, src: string, after: string) => {
      const localPath = normalizePath(src.split(/[?#]/, 1)[0] ?? src);
      const js = files.get(localPath);
      if (!js) return script;
      const moduleType = `${before} ${after}`.match(/type=["']module["']/i) ? ' type="module"' : "";
      return `<script${moduleType} data-verve-source="${localPath}">${escapeInlineScript(js)}</script>`;
    }
  );

  if (!/<meta\b[^>]*name=["']viewport["']/i.test(html)) {
    html = injectBeforeClose(html, "head", '<meta name="viewport" content="width=device-width,initial-scale=1">');
  }

  const probe = `<script data-verve-render-probe>${escapeInlineScript(createRenderProbeSource(probeId))}</script>`;
  return injectBeforeClose(html, "body", probe);
}
