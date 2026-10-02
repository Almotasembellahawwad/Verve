/** Browser-safe path handling shared by validation, preview and ZIP delivery. */
export function normalizeProjectPath(path: string): string | null {
  if (/^[a-z][a-z\d+.-]*:|^[/\\]{2}|[\u0000-\u001f]/i.test(path)) return null;
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").replace(/^\/+/, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

export function resolveProjectResource(from: string, reference: string): string | null {
  const value = reference.trim();
  if (!value || value.startsWith("#") || value.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(value)) return null;
  let target = value.split(/[?#]/, 1)[0];
  try { target = decodeURIComponent(target); } catch { return null; }
  if (!target) return null;
  const directory = from.replaceAll("\\", "/").split("/").slice(0, -1).join("/");
  return normalizeProjectPath(target.startsWith("/") ? target : `${directory}/${target}`);
}

export function relativeProjectResource(from: string, target: string): string {
  const directory = from.split("/").slice(0, -1);
  const destination = target.split("/");
  while (directory.length && destination.length && directory[0] === destination[0]) {
    directory.shift();
    destination.shift();
  }
  const result = "../".repeat(directory.length) + destination.join("/");
  return result.startsWith(".") ? result : `./${result}`;
}

export function rewriteCssResourceUrls(css: string, rewrite: (reference: string) => string): string {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_match, _quote: string, reference: string) =>
    `url("${rewrite(reference.trim()).replaceAll('"', "%22")}")`);
}

/** Ignore commented-out imports without mistaking quoted URL text for comments. */
export function cssWithoutComments(css: string): string {
  return css.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\//g,
    (token) => token.startsWith("/*") ? token.replace(/[^\r\n]/g, " ") : token);
}

export type JavaScriptImportReference = { source: string; start: number; end: number };

function javaScriptLexicalViews(code: string): { mask: string; withoutComments: string } {
  const tokens = /\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;
  const blank = (value: string) => value.replace(/[^\r\n]/g, " ");
  return {
    mask: code.replace(tokens, blank),
    withoutComments: code.replace(tokens, (value) => value.startsWith("/") ? blank(value) : value),
  };
}

/** Static declarations require type=module; dynamic import() is valid in classic scripts. */
export function hasStaticJavaScriptModuleSyntax(code: string): boolean {
  const { mask } = javaScriptLexicalViews(code);
  for (const token of mask.matchAll(/\b(?:import|export)\b/g)) {
    if (mask.slice(0, token.index).trimEnd().endsWith(".")) continue;
    const after = mask.slice(token.index! + token[0].length).trimStart();
    if (token[0] === "export" || !after.startsWith("(")) return true;
  }
  return false;
}

/** Literal module references only; dynamic expressions need runtime evidence. */
export function javaScriptImportReferences(code: string): JavaScriptImportReference[] {
  // Hide comments/ordinary strings, preserving offsets. Only import/export
  // tokens outside them can start a match; the original supplies its literal.
  const { mask, withoutComments } = javaScriptLexicalViews(code);
  const result: JavaScriptImportReference[] = [];
  for (const token of mask.matchAll(/\b(?:import|export)\b/g)) {
    const offset = token.index!;
    if (mask.slice(0, offset).trimEnd().endsWith(".")) continue;
    const remaining = withoutComments.slice(offset);
    const match = remaining.match(/^(?:import\s*\(\s*|import\s*|(?:import|export)\s+[^;]{0,4000}?\bfrom\s*)(["'])([^"'\r\n]+)\1/);
    if (!match) continue;
    const start = offset + match[0].lastIndexOf(match[2]);
    result.push({ source: match[2], start, end: start + match[2].length });
  }
  return result;
}

export function rewriteJavaScriptImports(code: string, rewrite: (source: string) => string): string {
  let output = code;
  for (const reference of javaScriptImportReferences(code).reverse()) {
    output = output.slice(0, reference.start) + rewrite(reference.source) + output.slice(reference.end);
  }
  return output;
}
