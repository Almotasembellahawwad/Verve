import type { GeneratedProject } from "./types";

export type SandboxFileMap = Record<string, { code: string }>;

export type RenderGateCheck = {
  id: "horizontal-overflow" | "runtime-errors" | "tiny-text" | "image-alt" | "duplicate-ids" | "button-names";
  title: string;
  status: "pass" | "warning" | "fail";
  message: string;
};

export type RenderGateReport = {
  source: "verve-render-gate";
  probeId: string;
  sequence: number;
  viewport: { width: number; height: number; documentWidth: number };
  checks: RenderGateCheck[];
};

const PROBE_FILE = "/__verve_render_probe.js";
const REACT_PROBE_FILE = "/src/__verve_render_probe.js";

export function createRenderProbeSource(probeId: string): string {
  return `(() => {
  const PROBE_ID = ${JSON.stringify(probeId)};
  if (window.__verveRenderProbe === PROBE_ID) return;
  window.__verveRenderProbe = PROBE_ID;
  let sequence = 0;
  let timer = 0;
  const runtimeErrors = [];
  const text = (value) => String(value instanceof Error ? value.message : value);
  const selector = (element) => {
    if (!(element instanceof Element)) return "unknown";
    if (element.id) return "#" + element.id;
    const className = typeof element.className === "string" ? element.className.trim().split(/\\s+/)[0] : "";
    return element.tagName.toLowerCase() + (className ? "." + className : "");
  };
  const visible = (element) => {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  };
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(report, 180);
  };
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    runtimeErrors.push(args.map(text).join(" ").slice(0, 500));
    if (runtimeErrors.length > 5) runtimeErrors.shift();
    originalError(...args);
    schedule();
  };
  window.addEventListener("error", (event) => {
    runtimeErrors.push(text(event.error || event.message).slice(0, 500));
    if (runtimeErrors.length > 5) runtimeErrors.shift();
    schedule();
  });
  window.addEventListener("unhandledrejection", (event) => {
    runtimeErrors.push(text(event.reason).slice(0, 500));
    if (runtimeErrors.length > 5) runtimeErrors.shift();
    schedule();
  });
  function report() {
    if (!document.documentElement || !document.body) return;
    const width = document.documentElement.clientWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const overflowElements = [...document.body.querySelectorAll("*")]
      .filter((element) => {
        if (!visible(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.right > width + 1 || rect.left < -1;
      })
      .slice(0, 5)
      .map(selector);
    const tinyText = [...document.body.querySelectorAll("*")]
      .filter((element) => visible(element) && (element.textContent || "").trim() && parseFloat(getComputedStyle(element).fontSize) < 10)
      .slice(0, 5)
      .map(selector);
    const missingAlt = [...document.images].filter((image) => !image.hasAttribute("alt")).map(selector).slice(0, 5);
    const ids = new Map();
    document.querySelectorAll("[id]").forEach((element) => {
      const id = element.id;
      ids.set(id, (ids.get(id) || 0) + 1);
    });
    const duplicateIds = [...ids.entries()].filter((entry) => entry[1] > 1).map((entry) => entry[0]).slice(0, 5);
    const unnamedButtons = [...document.querySelectorAll("button")]
      .filter((button) => {
        const labelledBy = button.getAttribute("aria-labelledby");
        return !(button.textContent || "").trim() && !button.getAttribute("aria-label") && !button.getAttribute("title") && !(labelledBy && document.getElementById(labelledBy));
      })
      .map(selector)
      .slice(0, 5);
    const checks = [
      { id: "horizontal-overflow", title: "Rendered mobile width", status: documentWidth > width + 1 ? "fail" : "pass", message: documentWidth > width + 1 ? "Document is " + documentWidth + "px wide in a " + width + "px viewport. Offenders: " + (overflowElements.join(", ") || "unknown") : "No rendered horizontal overflow detected at " + width + "px." },
      { id: "runtime-errors", title: "Rendered runtime", status: runtimeErrors.length ? "fail" : "pass", message: runtimeErrors.length ? runtimeErrors.join(" | ") : "No runtime or console errors captured." },
      { id: "tiny-text", title: "Rendered text size", status: tinyText.length ? "warning" : "pass", message: tinyText.length ? "Visible text below 10px: " + tinyText.join(", ") : "No visible text below 10px detected." },
      { id: "image-alt", title: "Rendered image alternatives", status: missingAlt.length ? "warning" : "pass", message: missingAlt.length ? "Images without alt: " + missingAlt.join(", ") : "Every rendered image has an alt attribute." },
      { id: "duplicate-ids", title: "Rendered element identity", status: duplicateIds.length ? "warning" : "pass", message: duplicateIds.length ? "Duplicate ids: " + duplicateIds.join(", ") : "No duplicate rendered ids detected." },
      { id: "button-names", title: "Rendered button names", status: unnamedButtons.length ? "warning" : "pass", message: unnamedButtons.length ? "Unnamed buttons: " + unnamedButtons.join(", ") : "Every rendered button has an accessible name." }
    ];
    parent.postMessage({ source: "verve-render-gate", probeId: PROBE_ID, sequence: ++sequence, viewport: { width, height: window.innerHeight, documentWidth }, checks }, "*");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
})();`;
}

function injectHtmlProbe(html: string): string {
  const script = `<script src="${PROBE_FILE}" defer></script>`;
  if (html.includes(PROBE_FILE)) return html;
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, `${script}</body>`) : `${html}\n${script}`;
}

function injectReactProbe(main: string): string {
  if (main.includes("__verve_render_probe")) return main;
  return `import "./__verve_render_probe";\n${main}`;
}

/** Add ephemeral probe files to Sandpack only. The canonical project and ZIP remain untouched. */
export function instrumentSandboxFiles(project: GeneratedProject, probeId: string): SandboxFileMap {
  const files: SandboxFileMap = Object.fromEntries(
    project.files.map((item) => [`/${item.path}`, { code: item.content }])
  );
  if (project.framework === "html" && files["/index.html"]) {
    files["/index.html"] = { code: injectHtmlProbe(files["/index.html"].code) };
    files[PROBE_FILE] = { code: createRenderProbeSource(probeId) };
  }
  if (project.framework === "react" && files["/src/main.tsx"]) {
    files["/src/main.tsx"] = { code: injectReactProbe(files["/src/main.tsx"].code) };
    files[REACT_PROBE_FILE] = { code: createRenderProbeSource(probeId) };
  }
  return files;
}

export function isRenderGateReport(value: unknown, probeId: string): value is RenderGateReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<RenderGateReport>;
  return report.source === "verve-render-gate"
    && report.probeId === probeId
    && typeof report.sequence === "number"
    && Boolean(report.viewport)
    && typeof report.viewport?.width === "number"
    && typeof report.viewport?.height === "number"
    && typeof report.viewport?.documentWidth === "number"
    && Array.isArray(report.checks)
    && report.checks.length <= 10
    && report.checks.every((item) => item
      && ["horizontal-overflow", "runtime-errors", "tiny-text", "image-alt", "duplicate-ids", "button-names"].includes(item.id)
      && ["pass", "warning", "fail"].includes(item.status)
      && typeof item.title === "string"
      && item.title.length <= 120
      && typeof item.message === "string"
      && item.message.length <= 2_000);
}
