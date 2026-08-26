import type { GeneratedProject, ProjectCheck, ProjectFile, ProjectValidation } from "./types";

const SOURCE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".css", ".json"];
const INDEX_EXTENSIONS = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

function normalized(path: string): string {
  const output: string[] = [];
  for (const part of path.replaceAll("\\", "/").replace(/^\/+/, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") output.pop();
    else output.push(part);
  }
  return output.join("/");
}

function directory(path: string): string {
  const parts = normalized(path).split("/");
  parts.pop();
  return parts.join("/");
}

function packageName(source: string): string {
  return source.startsWith("@") ? source.split("/").slice(0, 2).join("/") : source.split("/")[0];
}

function relativeImportExists(from: string, source: string, files: Set<string>): boolean {
  const base = normalized(`${directory(from)}/${source}`);
  return [...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`), ...INDEX_EXTENSIONS.map((extension) => `${base}${extension}`)]
    .some((candidate) => files.has(candidate));
}

function check(id: string, title: string, status: ProjectCheck["status"], message: string, file?: string): ProjectCheck {
  return { id, title, status, message, ...(file ? { file } : {}) };
}

function sourceFiles(project: GeneratedProject): ProjectFile[] {
  return project.files.filter((file) => /\.(?:html|tsx?|jsx?)$/i.test(file.path));
}

function inspectableFiles(project: GeneratedProject): ProjectFile[] {
  return project.files.filter((file) => /\.(?:html|tsx?|jsx?|css|scss)$/i.test(file.path));
}

export function validateGeneratedProject(project: GeneratedProject): ProjectValidation {
  const checks: ProjectCheck[] = [];
  const files = new Map(project.files.map((file) => [normalized(file.path), file]));
  const paths = new Set(files.keys());
  const entry = files.get(normalized(project.entryFile));

  checks.push(entry
    ? check("entry", "Entry file", "pass", `${project.entryFile} exists.`)
    : check("entry", "Entry file", "fail", `${project.entryFile} is missing.`));

  const required = project.framework === "nextjs"
    ? ["package.json", "tsconfig.json", "app/layout.tsx", "app/page.tsx"]
    : project.framework === "react"
      ? ["package.json", "tsconfig.json", "index.html", "src/main.tsx", "src/App.tsx"]
      : ["index.html"];
  const missingRequired = required.filter((path) => !paths.has(path));
  checks.push(missingRequired.length === 0
    ? check("scaffold", "Project scaffold", "pass", `All ${required.length} required files are present.`)
    : check("scaffold", "Project scaffold", "fail", `Missing: ${missingRequired.join(", ")}.`));

  if (entry) {
    if (project.framework === "html") {
      checks.push(/<!doctype html>/i.test(entry.content)
        ? check("entry-contract", "HTML document contract", "pass", "DOCTYPE is present.", entry.path)
        : check("entry-contract", "HTML document contract", "fail", "Missing <!doctype html>.", entry.path));
    } else {
      checks.push(/export\s+default\s+(?:function|class|[A-Za-z_$])/m.test(entry.content)
        ? check("entry-contract", "Component entry contract", "pass", "A default export is present.", entry.path)
        : check("entry-contract", "Component entry contract", "fail", "The entry component needs a default export.", entry.path));
    }
  }

  const unresolved: string[] = [];
  const undeclared: string[] = [];
  for (const file of sourceFiles(project)) {
    for (const match of file.content.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)) {
      const source = match[1];
      if (source.startsWith(".") && !relativeImportExists(file.path, source, paths)) {
        unresolved.push(`${file.path} -> ${source}`);
      } else if (!source.startsWith(".") && source !== "react" && !source.startsWith("react/") && source !== "next" && !source.startsWith("next/")) {
        const dependency = packageName(source);
        if (!project.dependencies[dependency]) undeclared.push(`${file.path} -> ${dependency}`);
      }
    }
  }
  checks.push(unresolved.length === 0
    ? check("relative-imports", "Relative imports", "pass", "Every local import resolves to a project file.")
    : check("relative-imports", "Relative imports", "fail", `Unresolved imports: ${unresolved.slice(0, 4).join("; ")}.`));
  checks.push(undeclared.length === 0
    ? check("dependencies", "Package dependencies", "pass", "External imports are declared.")
    : check("dependencies", "Package dependencies", "fail", `Undeclared packages: ${undeclared.slice(0, 4).join("; ")}.`));

  const combined = inspectableFiles(project).map((file) => file.content).join("\n");
  checks.push(/innerHTML|dangerouslySetInnerHTML/i.test(combined)
    ? check("html-injection", "HTML injection", "fail", "Unsafe HTML injection API detected.")
    : check("html-injection", "HTML injection", "pass", "No HTML injection API detected."));

  if (/<form\b/i.test(combined)) {
    checks.push(/<form\b[^>]*(?:action\s*=|onSubmit\s*=)|addEventListener\s*\(\s*["']submit/i.test(combined)
      ? check("forms", "Form contract", "pass", "A form submission contract is present.")
      : check("forms", "Form contract", "fail", "A form exists without action, onSubmit, or a submit listener."));
  } else {
    checks.push(check("forms", "Form contract", "pass", "No unconnected form is present."));
  }

  const ids = new Set([...combined.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]));
  const anchors = [...combined.matchAll(/\bhref\s*=\s*["']#([^"']*)["']/gi)].map((match) => match[1]);
  const brokenAnchors = anchors.filter((anchor) => !anchor || !ids.has(anchor));
  checks.push(brokenAnchors.length === 0
    ? check("anchors", "Internal navigation", "pass", "Every fragment link has a target.")
    : check("anchors", "Internal navigation", "fail", `Broken fragment targets: ${brokenAnchors.map((anchor) => anchor || "#").slice(0, 6).join(", ")}.`));

  const imagesWithoutAlt = (combined.match(/<img\b(?![^>]*\balt\s*=)[^>]*>/gi) ?? []).length;
  checks.push(imagesWithoutAlt === 0
    ? check("image-alt", "Image alternatives", "pass", "Every image has an alt contract.")
    : check("image-alt", "Image alternatives", "warning", `${imagesWithoutAlt} image(s) have no alt attribute.`));

  const buttonsWithoutType = (combined.match(/<button\b(?![^>]*\btype\s*=)[^>]*>/gi) ?? []).length;
  checks.push(buttonsWithoutType === 0
    ? check("button-types", "Button behavior", "pass", "Every button declares its type.")
    : check("button-types", "Button behavior", "warning", `${buttonsWithoutType} button(s) rely on an implicit type.`));

  checks.push(/prefers-reduced-motion/i.test(combined)
    ? check("reduced-motion", "Reduced motion", "pass", "A reduced-motion policy is present.")
    : check("reduced-motion", "Reduced motion", "warning", "No prefers-reduced-motion rule was detected."));

  const concealsOverflow = /(?:^|[},\s`])(?:html|body|#root|\.site-shell|\.page-shell|\.app-shell)\s*\{[^}]*overflow(?:-x)?\s*:\s*hidden/i.test(combined);
  checks.push(concealsOverflow
    ? check("mobile-clipping", "Mobile overflow", "warning", "Root-level overflow hidden may conceal clipped content; repair the overflowing child instead.")
    : check("mobile-clipping", "Mobile overflow", "pass", "No root-level overflow clipping policy was detected."));

  const displayDerivedKey = /key\s*=\s*\{\s*[A-Za-z_$][\w$]*\.(?:label|title|name|heading|measure|result)\s*\}/i.test(combined);
  checks.push(displayDerivedKey
    ? check("react-keys", "React list identity", "warning", "A list key uses visible copy that may be duplicated; use a stable id.")
    : check("react-keys", "React list identity", "pass", "No display-copy-derived React keys were detected."));

  const tinyTextSizes = [...combined.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)]
    .map((match) => Number(match[1]))
    .filter((size) => size > 0 && size < 10);
  checks.push(tinyTextSizes.length > 0
    ? check("tiny-text", "Readable text", "warning", `Text as small as ${Math.min(...tinyTextSizes)}px was detected.`)
    : check("tiny-text", "Readable text", "pass", "No text below 10px was detected."));

  const declaredFonts = new Set(
    [...combined.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*["']([^"']+)["']/gi)]
      .map((match) => match[1].toLowerCase())
  );
  const unbackedFont = [...combined.matchAll(/font-family\s*:\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .find((family) => !declaredFonts.has(family.toLowerCase()));
  checks.push(unbackedFont
    ? check("font-assets", "Font assets", "warning", `Font "${unbackedFont}" is referenced without a bundled font or @font-face declaration.`)
    : check("font-assets", "Font assets", "pass", "Every named font reference has a local declaration."));

  const placeholderSignals = combined.match(/\b(?:lorem ipsum|todo:|dummy content|fake testimonial|replace me)\b/gi) ?? [];
  checks.push(placeholderSignals.length === 0
    ? check("content-truth", "Content truthfulness", "pass", "No explicit fake or unfinished content markers were detected.")
    : check("content-truth", "Content truthfulness", "warning", "Placeholder or unfinished content markers remain."));

  const failed = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warning").length;
  const score = Math.max(0, 100 - failed * 22 - warnings * 7);
  const status = failed > 0 ? "blocked" : warnings > 0 ? "review-required" : "ready";
  return { status, score, checks, failed, warnings };
}
