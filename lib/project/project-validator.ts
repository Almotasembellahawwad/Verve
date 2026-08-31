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
  const firstViewportTaskSignals = new Set(
    [...combined.matchAll(/\bdata-verve-task\s*=\s*["'](primary-object|decision-evidence)["']/gi)]
      .map((match) => match[1].toLowerCase())
  );
  const hasPrimaryActionSignal = /\bdata-verve-primary-action(?=[\s=>/])(?:\s*=\s*(?:["'][^"']*["']|\{true\}))?/i.test(combined);
  checks.push(firstViewportTaskSignals.size >= 2 && hasPrimaryActionSignal
    ? check("first-viewport-contract", "First viewport contract", "pass", "Source declares distinct primary-object and decision-evidence signals plus a primary action; the Render Gate will confirm that they are initially visible.")
    : check("first-viewport-contract", "First viewport contract", "warning", `Opening measurement hooks are incomplete (${firstViewportTaskSignals.size}/2 task signals, primary action ${hasPrimaryActionSignal ? "declared" : "missing"}). Add truthful data-verve-task and data-verve-primary-action markers without changing the composition's scale.`));
  checks.push(/innerHTML|dangerouslySetInnerHTML/i.test(combined)
    ? check("html-injection", "HTML injection", "fail", "Unsafe HTML injection API detected.")
    : check("html-injection", "HTML injection", "pass", "No HTML injection API detected."));

  if (/<form\b/i.test(combined)) {
    const hasSubmissionContract = /<form\b[^>]*(?:action\s*=|onSubmit\s*=)|addEventListener\s*\(\s*["']submit/i.test(combined);
    const placeholderAction = /<form\b[^>]*action\s*=\s*["'](?:#|javascript:[^"']*|)["']/i.test(combined);
    const preventDefaultOnly = /onSubmit\s*=\s*\{[^}]*preventDefault\s*\(\s*\)[^}]*\}/i.test(combined)
      && !/(?:set[A-Z]\w*\s*\(|fetch\s*\(|FormData\s*\(|window\.location|mailto:|data-form-contract)/i.test(combined);
    checks.push(hasSubmissionContract && !placeholderAction && !preventDefaultOnly
      ? check("forms", "Form contract", "pass", "A form submission contract is present.")
      : check("forms", "Form contract", "fail", placeholderAction || preventDefaultOnly
        ? "The form uses placeholder submission behavior; declare a demo, email, webhook, or server-action contract."
        : "A form exists without action, onSubmit, or a submit listener."));
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

  const hasTablist = /role\s*=\s*["']tablist["']/i.test(combined);
  if (hasTablist) {
    const hasRovingTabindex = /tabindex\s*=\s*["']-1["']|tabIndex\s*=\s*\{[^}]*-1/i.test(combined);
    const hasArrowNavigation = /ArrowLeft|ArrowRight/i.test(combined);
    const hasSelectionUpdate = /aria-selected|ariaSelected/i.test(combined) && /setAttribute\s*\(\s*["']aria-selected|set[A-Z]\w*\s*\(/i.test(combined);
    checks.push(hasRovingTabindex && hasArrowNavigation && hasSelectionUpdate
      ? check("tabs-keyboard", "Tabs keyboard model", "pass", "The tablist exposes one Tab stop, arrow navigation, and synchronized selection.")
      : check("tabs-keyboard", "Tabs keyboard model", "warning", "ARIA tabs require roving tabindex, arrow navigation, and selection synchronized with the visible panel."));
  }

  const authoredMotion = /(?:animation(?:-name|-duration)?|transition(?:-property|-duration)?)\s*:|requestAnimationFrame\s*\(|\buseReducedMotion\s*\(|from\s+["']framer-motion["']/i.test(combined);
  const reducedMotionPolicy = /prefers-reduced-motion|\buseReducedMotion\s*\(/i.test(combined);
  checks.push(!authoredMotion
    ? check("reduced-motion", "Motion contract", "pass", "No authored motion requires an opt-out policy.")
    : reducedMotionPolicy
      ? check("reduced-motion", "Motion contract", "pass", "Authored motion includes a reduced-motion policy.")
      : check("reduced-motion", "Motion contract", "fail", "Authored animation or transitions require prefers-reduced-motion or useReducedMotion."));

  const excessiveMotion = [...combined.matchAll(/(?:animation|transition)(?:-duration)?\s*:[^;{}]*?(\d+(?:\.\d+)?)s\b/gi)]
    .map((match) => Number(match[1]))
    .filter((seconds) => seconds > 8);
  checks.push(excessiveMotion.length === 0
    ? check("motion-duration", "Motion duration", "pass", "No excessive interface-motion duration was detected.")
    : check("motion-duration", "Motion duration", "warning", `Motion as long as ${Math.max(...excessiveMotion)}s needs intentional review.`));

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

  const hasTypographyContract = project.files.some((file) => file.path === "ASSETS.md" && /## Typography contract\b/i.test(file.content));
  if (hasTypographyContract) {
    const fontFiles = project.files.filter((file) => file.encoding === "base64" && file.mediaType === "font/woff2");
    const fontUrls = [...combined.matchAll(/url\(\s*["']?([^"')?#]+\.woff2)[^)]*\)/gi)].map((match) => normalized(match[1]));
    const missingFontUrls = fontUrls.filter((fontUrl) => !paths.has(fontUrl) && !paths.has(`public/${fontUrl}`));
    const sourceWithoutFaces = combined.replace(/@font-face\s*\{[^}]*\}/gi, "");
    const appliesContract = /font-family\s*:\s*[^;}]*var\(\s*--verve-font-(?:display|body|mono)\s*\)/i.test(sourceWithoutFaces)
      || [...declaredFonts].some((family) => new RegExp(`font-family\\s*:\\s*[^;}]*["']?${family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?`, "i").test(sourceWithoutFaces));
    checks.push(fontFiles.length > 0 && fontUrls.length > 0 && missingFontUrls.length === 0
      ? check("font-delivery", "Typography delivery", "pass", `${fontFiles.length} local WOFF2 file(s) satisfy the typography contract.`)
      : check("font-delivery", "Typography delivery", "fail", missingFontUrls.length
        ? `Missing bundled font paths: ${missingFontUrls.slice(0, 4).join(", ")}.`
        : "The typography contract has no verifiable local WOFF2 delivery."));
    checks.push(project.files.some((file) => file.path === "FONT-LICENSES.md")
      ? check("font-license", "Typography license", "pass", "OFL notices are included with the project.")
      : check("font-license", "Typography license", "fail", "FONT-LICENSES.md is required when font binaries are redistributed."));
    checks.push(appliesContract
      ? check("font-contract", "Typography contract", "pass", "Generated styling applies a bundled contract family.")
      : check("font-contract", "Typography contract", "fail", "Bundled font files exist, but no authored font-family declaration applies the contract."));
  }

  const placeholderSignals = combined.match(/\b(?:lorem ipsum|todo:|dummy content|fake testimonial|replace me|pending|tbd|to be confirmed|coming soon)\b/gi) ?? [];
  checks.push(placeholderSignals.length === 0
    ? check("content-truth", "Content truthfulness", "pass", "No explicit fake or unfinished content markers were detected.")
    : check("content-truth", "Content truthfulness", "warning", `${placeholderSignals.length} placeholder or unfinished content marker(s) remain.`));

  const failed = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warning").length;
  const score = Math.max(0, 100 - failed * 22 - warnings * 7);
  const status = failed > 0 ? "blocked" : warnings > 0 ? "review-required" : "ready";
  return { status, score, checks, failed, warnings };
}
