import type { VerveProjectSpec } from "../domain/project-spec";
import type { GeneratedProject } from "./types";
import { normalizeProjectPath, resolveProjectResource } from "./resource-paths";
import { sourcePageRoute } from "./source-dependencies";

export type NativePreviewPage = { file: string; routePath: string; routeId: string };
export type NativePreviewLocation = { file: string; query: string; fragment: string };
export type NativeNavigationMessage = { source: "verve-native-navigation"; version: 1; probeId: string; href: string };

/** Enumerate delivered pages, not inferred pages or arbitrary server URLs. */
export function nativePreviewPages(project: GeneratedProject, spec?: VerveProjectSpec): NativePreviewPage[] {
  if (project.framework !== "html") return [];
  const assigned = new Set<string>();
  const orderedFiles = [...project.files].sort((left, right) => Number(right.path === project.entryFile) - Number(left.path === project.entryFile) || left.path.localeCompare(right.path));
  const pages = orderedFiles.flatMap((file) => {
    const path = normalizeProjectPath(file.path);
    if (!path || file.encoding === "base64" || !/\.html$/i.test(path)) return [];
    const routePath = sourcePageRoute(path, "html")!;
    const planned = spec?.experience.routes.find((route) => (route.path.replace(/\/+$/, "") || "/") === routePath);
    const routeId = planned && !assigned.has(planned.id) ? planned.id : `html:${path}`;
    assigned.add(routeId);
    return [{ file: path, routePath, routeId }];
  });
  return pages.sort((left, right) => Number(right.file === project.entryFile) - Number(left.file === project.entryFile) || left.file.localeCompare(right.file));
}

/** Relative, root, extensionless and directory links resolve only to delivered HTML. */
export function resolveNativePreviewLink(pages: NativePreviewPage[], from: string, href: string): NativePreviewLocation | null {
  if (href.length > 2048 || /[\u0000-\u001f\u007f]/.test(href)) return null;
  const reference = href.trim();
  if (/^[a-z][a-z\d+.-]*:|^[\/\\]{2}/i.test(reference)) return null;
  const fragmentIndex = reference.indexOf("#");
  const beforeFragment = fragmentIndex < 0 ? reference : reference.slice(0, fragmentIndex);
  const queryIndex = beforeFragment.indexOf("?");
  const pathPart = queryIndex < 0 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  const path = pathPart ? resolveProjectResource(from, pathPart) : normalizeProjectPath(from);
  // '/' and a relative directory root normalize to an empty resource path.
  const rootDirectory = path === "";
  if (path === null) return null;
  const candidates = rootDirectory ? ["index.html"] : [path, `${path}.html`, `${path}/index.html`];
  const page = candidates.flatMap((candidate) => pages.filter((item) => item.file === candidate))[0];
  if (!page) return null;
  return {
    file: page.file,
    query: queryIndex < 0 ? "" : beforeFragment.slice(queryIndex),
    fragment: fragmentIndex < 0 ? "" : reference.slice(fragmentIndex),
  };
}

export function isNativeNavigationMessage(value: unknown, probeId: string): value is NativeNavigationMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<NativeNavigationMessage>;
  return message.source === "verve-native-navigation" && message.version === 1 && message.probeId === probeId
    && typeof message.href === "string" && message.href.length <= 2048;
}

/** Preview-only bridge; the parent validates both frame identity and delivered targets. */
export function nativeNavigationBridge(probeId: string, fragment = ""): string {
  return `(() => {
    const probeId = ${JSON.stringify(probeId)};
    function scrollToFragment(fragment) {
      let id; try { id = decodeURIComponent(fragment.slice(1)); } catch { return; }
      const target = document.getElementById(id) || document.getElementsByName(id)[0];
      // scrollIntoView can also scroll Verve's ancestor frame/controls. Keep the
      // fragment move inside this opaque document and finish it immediately.
      if (target) window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top), behavior: "instant" });
    }
    window.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") || "";
      event.preventDefault();
      if (href.startsWith("#")) { scrollToFragment(href); return; }
      parent.postMessage({ source: "verve-native-navigation", version: 1, probeId, href }, "*");
    });
    window.addEventListener("load", () => scrollToFragment(${JSON.stringify(fragment)}), { once: true });
  })();`;
}
