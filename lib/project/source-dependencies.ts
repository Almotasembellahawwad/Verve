import { rewriteHtmlElements } from "../security/structural-html";
import { cssWithoutComments, hasStaticJavaScriptModuleSyntax, javaScriptImportReferences, resolveProjectResource } from "./resource-paths";

type Source = { path: string; content: string };

/** Only filesystem-backed pages; React client routes need runtime evidence. */
export function sourcePageRoute(path: string, framework: string): string | undefined {
  if (/\.html$/i.test(path)) {
    return `/${path.replace(/(?:^|\/)index\.html$/i, "").replace(/\.html$/i, "").replace(/\/$/, "")}`;
  }
  if (framework === "nextjs" && /^app\/(?:.*\/)?page\.tsx$/.test(path)) {
    return `/${path.slice(4).replace(/(?:^|\/)page\.tsx$/, "").split("/").filter((segment) => segment && !/^\(.+\)$/.test(segment)).join("/")}`;
  }
  return undefined;
}

/** Budgets are ceilings, not permission to invent additional downloadable pages. */
export function inspectDeclaredSourceRoutes(files: Source[], framework: string, declaredRoutes?: string[]): string[] {
  if (!declaredRoutes || framework === "react") return [];
  const normalize = (route: string) => route === "/" ? "/" : route.replace(/\/+$/, "");
  const expected = new Set(declaredRoutes.map(normalize));
  const actual = new Set(files.flatMap((file) => {
    const route = sourcePageRoute(file.path, framework);
    return route === undefined ? [] : [normalize(route)];
  }));
  return [
    ...(framework === "nextjs" ? files.filter((file) => /\.html$/i.test(file.path)).map((file) => `Wrong-framework page source: ${file.path}; Next.js routes require app/**/page.tsx`) : []),
    ...[...actual].filter((route) => !expected.has(route)).map((route) => `Undeclared page route: ${route}; deliver only the explicitly planned routes`),
    ...[...expected].filter((route) => !actual.has(route)).map((route) => `Missing declared page route: ${route}`),
  ];
}

/** Dependencies that must exist before any font/stock bytes are attached. */
export function inspectLocalSourceDependencies(files: Source[], framework: string, engineProvidedPaths: string[] = []): string[] {
  const paths = new Set([...files.map((file) => file.path), ...engineProvidedPaths]);
  const contents = new Map(files.map((file) => [file.path, file.content]));
  const missing: string[] = [];
  for (const file of files) {
    const references: string[] = [];
    const moduleReferences = new Set<string>();
    if (/\.html$/i.test(file.path)) {
      for (const tag of ["script", "link"] as const) rewriteHtmlElements(file.content, tag, (element) => {
        const reference = element.attributes.get(tag === "script" ? "src" : "href");
        if (reference && (tag === "script" || element.attributes.get("rel")?.toLowerCase().split(/\s+/).includes("stylesheet"))) references.push(reference);
        const type = element.attributes.get("type")?.toLowerCase().trim() ?? "";
        if (tag === "script" && (!type || /^(?:text|application)\/(?:java|ecma)script$/.test(type))) {
          const script = reference ? contents.get(resolveProjectResource(file.path, reference) ?? "") : element.content;
          if (script && hasStaticJavaScriptModuleSyntax(script)) missing.push(`Script module contract: ${file.path}${reference ? ` -> ${reference}` : " inline script"} uses static imports/exports but is not loaded with type="module"`);
        }
        if (tag === "script" && !reference && element.attributes.get("type")?.toLowerCase() === "module") {
          const imports = javaScriptImportReferences(element.content).map((item) => item.source);
          imports.forEach((item) => moduleReferences.add(item));
          references.push(...imports);
        }
        return element.source;
      });
    }
    if (/\.(?:js|mjs|tsx?|jsx?)$/i.test(file.path)) {
      const imports = javaScriptImportReferences(file.content).map((item) => item.source);
      imports.forEach((item) => moduleReferences.add(item));
      references.push(...imports);
    }
    if (/\.css$/i.test(file.path)) {
      references.push(...[...cssWithoutComments(file.content).matchAll(/@import\s+(?:url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)|["']([^"']+)["'])/gi)]
        .map((match) => match[1] || match[2] || match[3]));
    }
    for (const reference of references) {
      if (/^[a-z][a-z\d+.-]*:|^\/\/|^#/i.test(reference)) continue;
      const nextAlias = framework === "nextjs" && reference.startsWith("@/");
      if (moduleReferences.has(reference) && !reference.startsWith(".") && !reference.startsWith("/") && !nextAlias) {
        if (framework === "html") missing.push(`Unresolved browser module specifier: ${file.path} -> ${reference}; use a delivered relative module path`);
        continue;
      }
      const target = resolveProjectResource(file.path, nextAlias ? `/${reference.slice(2)}` : reference);
      const candidates = framework === "html" || /\.(?:css|html)$/i.test(file.path)
        ? [target]
        : [target, ...[".ts", ".tsx", ".js", ".mjs", ".jsx", ".css", "/index.ts", "/index.tsx", "/index.js", "/index.mjs"].map((suffix) => `${target}${suffix}`)];
      if (!target || !candidates.some((candidate) => candidate && paths.has(candidate))) missing.push(`Unresolved source dependency: ${file.path} -> ${reference}`);
    }
  }
  return [...new Set(missing)];
}
