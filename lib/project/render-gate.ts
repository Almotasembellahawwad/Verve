import type { GeneratedProject } from "./types";
import { replaceOwnedAssetReferences } from "./brand-kit";
import { FIRST_VIEWPORT_THRESHOLDS, type FirstViewportEvidence } from "../domain/first-viewport";

export type SandboxFileMap = Record<string, { code: string }>;

export type RenderGateCheck = {
  id: "horizontal-overflow" | "runtime-errors" | "tiny-text" | "image-alt" | "duplicate-ids" | "button-names" | "first-viewport-effectiveness";
  title: string;
  status: "pass" | "warning" | "fail";
  message: string;
};

export type VisualFingerprint = {
  occupancyGrid: number[];
  typographyScale: number[];
  colorHistogram: { color: string; weight: number }[];
  mediaCoverage: number;
  interactionDensity: number;
  roundedness: number;
  sectionRhythm: number[];
  routeCount: number;
};

export type RenderGateReport = {
  source: "verve-render-gate";
  probeId: string;
  sequence: number;
  viewport: { width: number; height: number; documentWidth: number };
  checks: RenderGateCheck[];
  fingerprint: VisualFingerprint;
  firstViewport?: FirstViewportEvidence;
};

function vectorDistance(left: number[], right: number[]): number {
  const size = Math.max(left.length, right.length);
  if (size === 0) return 0;
  let total = 0;
  for (let index = 0; index < size; index++) total += Math.abs((left[index] ?? 0) - (right[index] ?? 0));
  return Math.min(1, total / size);
}

function histogramDistance(left: VisualFingerprint["colorHistogram"], right: VisualFingerprint["colorHistogram"]): number {
  const colors = new Set([...left.map((entry) => entry.color), ...right.map((entry) => entry.color)]);
  let total = 0;
  colors.forEach((color) => {
    total += Math.abs((left.find((entry) => entry.color === color)?.weight ?? 0) - (right.find((entry) => entry.color === color)?.weight ?? 0));
  });
  return Math.min(1, total / 2);
}

export function visualFingerprintDistance(left: VisualFingerprint, right: VisualFingerprint): number {
  const routeDistance = Math.min(1, Math.abs(left.routeCount - right.routeCount) / Math.max(1, left.routeCount, right.routeCount));
  const distance = vectorDistance(left.occupancyGrid, right.occupancyGrid) * 0.35
    + vectorDistance(left.typographyScale, right.typographyScale) * 0.2
    + histogramDistance(left.colorHistogram, right.colorHistogram) * 0.15
    + Math.abs(left.mediaCoverage - right.mediaCoverage) * 0.1
    + Math.abs(left.interactionDensity - right.interactionDensity) * 0.05
    + Math.abs(left.roundedness - right.roundedness) * 0.05
    + vectorDistance(left.sectionRhythm, right.sectionRhythm) * 0.05
    + routeDistance * 0.05;
  return Number(Math.min(1, distance).toFixed(3));
}

export const RENDER_EVIDENCE_WIDTHS = [360, 768, 1440] as const;
export type RenderEvidenceWidth = (typeof RENDER_EVIDENCE_WIDTHS)[number];

export type RenderEvidenceMatrix = {
  reports: Partial<Record<RenderEvidenceWidth, RenderGateReport>>;
  covered: number;
  complete: boolean;
  status: "waiting" | "collecting" | "pass" | "review" | "fail";
  score: number;
  failures: number;
  warnings: number;
  firstViewportScore: number | null;
};

export function createRenderEvidenceMatrix(): RenderEvidenceMatrix {
  return {
    reports: {},
    covered: 0,
    complete: false,
    status: "waiting",
    score: 85,
    failures: 0,
    warnings: 0,
    firstViewportScore: null,
  };
}

function evidenceWidth(width: number): RenderEvidenceWidth | undefined {
  return RENDER_EVIDENCE_WIDTHS.find((candidate) => Math.abs(candidate - width) <= 2);
}

export function recordRenderEvidence(
  matrix: RenderEvidenceMatrix,
  report: RenderGateReport
): RenderEvidenceMatrix {
  const width = evidenceWidth(report.viewport.width);
  if (!width) return matrix;
  const previous = matrix.reports[width];
  if (previous && previous.sequence > report.sequence) return matrix;

  const reports = { ...matrix.reports, [width]: report };
  const captured = RENDER_EVIDENCE_WIDTHS.flatMap((candidate) => reports[candidate] ? [reports[candidate]!] : []);
  const checks = captured.flatMap((item) => item.checks);
  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  const covered = captured.length;
  const complete = covered === RENDER_EVIDENCE_WIDTHS.length;
  const firstViewportScores = captured.flatMap((item) => item.firstViewport ? [item.firstViewport.score] : []);
  const status = failures > 0
    ? "fail"
    : warnings > 0
      ? "review"
      : complete
        ? "pass"
        : "collecting";

  return {
    reports,
    covered,
    complete,
    status,
    score: Math.max(0, 100 - failures * 35 - warnings * 8 - (RENDER_EVIDENCE_WIDTHS.length - covered) * 5),
    failures,
    warnings,
    firstViewportScore: firstViewportScores.length ? Math.min(...firstViewportScores) : null,
  };
}

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
    const visibleElements = [...document.body.querySelectorAll("body *")].filter(visible).slice(0, 500);
    const visualElements = visibleElements.filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const semantic = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|IMG|VIDEO|CANVAS|SVG|H1|H2|H3|H4|P|LI|TD|TH|BLOCKQUOTE)$/i.test(element.tagName);
      const authoredShape = style.clipPath !== "none" || style.transform !== "none" || parseFloat(style.borderWidth) > 0;
      const boundedSurface = style.backgroundColor !== "rgba(0, 0, 0, 0)" && rect.width * rect.height < width * window.innerHeight * 0.72;
      return semantic || element.children.length === 0 || authoredShape || boundedSurface;
    });
    const gridSize = 12;
    const occupancyGrid = Array(gridSize * gridSize).fill(0);
    visualElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > window.innerHeight) return;
      const left = Math.max(0, Math.floor((Math.max(0, rect.left) / Math.max(1, width)) * gridSize));
      const right = Math.min(gridSize - 1, Math.floor((Math.min(width, rect.right) / Math.max(1, width)) * gridSize));
      const top = Math.max(0, Math.floor((Math.max(0, rect.top) / Math.max(1, window.innerHeight)) * gridSize));
      const bottom = Math.min(gridSize - 1, Math.floor((Math.min(window.innerHeight, rect.bottom) / Math.max(1, window.innerHeight)) * gridSize));
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) occupancyGrid[y * gridSize + x] = Math.min(1, occupancyGrid[y * gridSize + x] + 0.12);
    });
    const typographyScale = Array(6).fill(0);
    const textElements = visibleElements.filter((element) => (element.textContent || "").trim());
    textElements.forEach((element) => {
      const size = parseFloat(getComputedStyle(element).fontSize) || 0;
      const bucket = size < 12 ? 0 : size < 16 ? 1 : size < 22 ? 2 : size < 36 ? 3 : size < 64 ? 4 : 5;
      typographyScale[bucket]++;
    });
    const textTotal = Math.max(1, typographyScale.reduce((sum, value) => sum + value, 0));
    typographyScale.forEach((value, index) => typographyScale[index] = Number((value / textTotal).toFixed(3)));
    const colors = new Map();
    visibleElements.forEach((element) => {
      const style = getComputedStyle(element);
      [style.backgroundColor, style.color].forEach((color) => {
        if (!color || color === "rgba(0, 0, 0, 0)") return;
        colors.set(color, (colors.get(color) || 0) + 1);
      });
    });
    const colorTotal = Math.max(1, [...colors.values()].reduce((sum, value) => sum + value, 0));
    const colorHistogram = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([color, count]) => ({ color, weight: Number((count / colorTotal).toFixed(3)) }));
    const viewportArea = Math.max(1, width * window.innerHeight);
    const inFirstViewport = (element) => {
      if (!visible(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < width;
    };
    const hasTaskContent = (element) => (element.textContent || "").trim().length >= 2
      || element.matches("img,video,canvas,svg,input,select,button,a[href]")
      || Boolean(element.querySelector("img,video,canvas,svg,input,select,button,a[href],table,dl"));
    const taskElements = [...document.querySelectorAll("[data-verve-task]")]
      .filter((element) => inFirstViewport(element) && hasTaskContent(element));
    const taskSignalNames = new Set(taskElements
      .map((element) => element.getAttribute("data-verve-task"))
      .filter((value) => value === "primary-object" || value === "decision-evidence"));
    const primaryActionElements = [...document.querySelectorAll("[data-verve-primary-action]")];
    const namedPrimaryActions = primaryActionElements.filter((element) => {
      if (!inFirstViewport(element) || !element.matches("a[href],button,input,select,textarea,[role=button]")) return false;
      const labelledBy = element.getAttribute("aria-labelledby");
      return Boolean((element.textContent || "").trim() || element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("value") || (labelledBy && document.getElementById(labelledBy)));
    });
    const taskSignalCount = taskSignalNames.size;
    const taskCoverage = Math.min(1, taskSignalCount / ${FIRST_VIEWPORT_THRESHOLDS.minimumTaskSignals});
    const taskArea = taskElements.reduce((sum, element) => {
      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(width, rect.right) - Math.max(0, rect.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
      return sum + Math.min(viewportArea * 0.08, visibleWidth * visibleHeight);
    }, 0);
    const informationSalience = Math.min(1, taskArea / Math.max(1, viewportArea * 0.12));
    const primaryActionVisible = namedPrimaryActions.length > 0;
    const actionClarity = primaryActionVisible ? 1 : 0;
    const nearestActionTop = primaryActionElements.reduce((nearest, element) => Math.min(nearest, Math.max(0, element.getBoundingClientRect().top)), Number.POSITIVE_INFINITY);
    const scrollCost = primaryActionVisible ? 0 : Number.isFinite(nearestActionTop) ? Math.min(1, Math.max(0, nearestActionTop - window.innerHeight) / Math.max(1, window.innerHeight)) : 1;
    const firstViewportScore = Math.min(1, (
      taskCoverage * ${FIRST_VIEWPORT_THRESHOLDS.taskCoverageWeight}
      + informationSalience * ${FIRST_VIEWPORT_THRESHOLDS.informationSalienceWeight}
      + actionClarity * ${FIRST_VIEWPORT_THRESHOLDS.actionClarityWeight}
    ) / (1 + scrollCost * ${FIRST_VIEWPORT_THRESHOLDS.scrollCostWeight}));
    const firstViewport = {
      taskSignalCount,
      taskCoverage: Number(taskCoverage.toFixed(3)),
      informationSalience: Number(informationSalience.toFixed(3)),
      primaryActionVisible,
      actionClarity,
      scrollCost: Number(scrollCost.toFixed(3)),
      score: Number(firstViewportScore.toFixed(3))
    };
    const mediaArea = [...document.querySelectorAll("img,video,canvas,svg")].filter(visible).reduce((sum, element) => { const rect = element.getBoundingClientRect(); return sum + Math.max(0, rect.width) * Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top)); }, 0);
    const interactionCount = visibleElements.filter((element) => element.matches("a,button,input,select,textarea,[role=button],[tabindex]")).length;
    const roundedCount = visibleElements.filter((element) => parseFloat(getComputedStyle(element).borderRadius) >= 8).length;
    const sections = [...document.querySelectorAll("main > section, main > article, body > section")].filter(visible).slice(0, 12);
    const sectionRhythm = sections.map((element) => Number(Math.min(2, element.getBoundingClientRect().height / Math.max(1, window.innerHeight)).toFixed(3)));
    const routeCount = new Set([...document.querySelectorAll("a[href]")]
      .map((element) => element.getAttribute("href") || "")
      .filter((href) => href.startsWith("/") && !href.startsWith("/#"))
      .map((href) => href.split("#")[0])).size || 1;
    const fingerprint = {
      occupancyGrid: occupancyGrid.map((value) => Number(value.toFixed(3))),
      typographyScale,
      colorHistogram,
      mediaCoverage: Number(Math.min(1, mediaArea / viewportArea).toFixed(3)),
      interactionDensity: Number(Math.min(1, interactionCount / Math.max(1, visibleElements.length)).toFixed(3)),
      roundedness: Number(Math.min(1, roundedCount / Math.max(1, visibleElements.length)).toFixed(3)),
      sectionRhythm,
      routeCount
    };
    const checks = [
      { id: "horizontal-overflow", title: "Rendered mobile width", status: documentWidth > width + 1 ? "fail" : "pass", message: documentWidth > width + 1 ? "Document is " + documentWidth + "px wide in a " + width + "px viewport. Offenders: " + (overflowElements.join(", ") || "unknown") : "No rendered horizontal overflow detected at " + width + "px." },
      { id: "runtime-errors", title: "Rendered runtime", status: runtimeErrors.length ? "fail" : "pass", message: runtimeErrors.length ? runtimeErrors.join(" | ") : "No runtime or console errors captured." },
      { id: "tiny-text", title: "Rendered text size", status: tinyText.length ? "warning" : "pass", message: tinyText.length ? "Visible text below 10px: " + tinyText.join(", ") : "No visible text below 10px detected." },
      { id: "image-alt", title: "Rendered image alternatives", status: missingAlt.length ? "warning" : "pass", message: missingAlt.length ? "Images without alt: " + missingAlt.join(", ") : "Every rendered image has an alt attribute." },
      { id: "duplicate-ids", title: "Rendered element identity", status: duplicateIds.length ? "warning" : "pass", message: duplicateIds.length ? "Duplicate ids: " + duplicateIds.join(", ") : "No duplicate rendered ids detected." },
      { id: "button-names", title: "Rendered button names", status: unnamedButtons.length ? "warning" : "pass", message: unnamedButtons.length ? "Unnamed buttons: " + unnamedButtons.join(", ") : "Every rendered button has an accessible name." },
      { id: "first-viewport-effectiveness", title: "First viewport effectiveness", status: taskSignalCount < ${FIRST_VIEWPORT_THRESHOLDS.minimumTaskSignals} || !primaryActionVisible || firstViewportScore < ${FIRST_VIEWPORT_THRESHOLDS.reviewScore} ? "warning" : "pass", message: "FVE " + firstViewport.score.toFixed(2) + ": " + taskSignalCount + "/${FIRST_VIEWPORT_THRESHOLDS.minimumTaskSignals} task signals, information salience " + firstViewport.informationSalience.toFixed(2) + ", primary action " + (primaryActionVisible ? "visible" : "not visible") + ". Opening size is not scored." }
    ];
    parent.postMessage({ source: "verve-render-gate", probeId: PROBE_ID, sequence: ++sequence, viewport: { width, height: window.innerHeight, documentWidth }, checks, fingerprint, firstViewport }, "*");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  // A srcDoc iframe can finish before its React parent hydrates and subscribes.
  // Two bounded retries make the report delivery reliable without a polling interval.
  window.setTimeout(report, 700);
  window.setTimeout(report, 1600);
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
    project.files
      .filter((item) => item.encoding !== "base64")
      .map((item) => [`/${item.path}`, { code: replaceOwnedAssetReferences(item.content, project.files) }])
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
  const boundedUnit = (candidate: unknown) => typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1;
  return report.source === "verve-render-gate"
    && report.probeId === probeId
    && typeof report.sequence === "number"
    && Boolean(report.viewport)
    && typeof report.viewport?.width === "number"
    && typeof report.viewport?.height === "number"
    && typeof report.viewport?.documentWidth === "number"
    && Array.isArray(report.checks)
    && Boolean(report.fingerprint)
    && Array.isArray(report.fingerprint?.occupancyGrid)
    && report.fingerprint.occupancyGrid.length === 144
    && Array.isArray(report.fingerprint?.typographyScale)
    && report.fingerprint.typographyScale.length === 6
    && Array.isArray(report.fingerprint?.colorHistogram)
    && report.fingerprint.colorHistogram.length <= 8
    && Array.isArray(report.fingerprint?.sectionRhythm)
    && report.fingerprint.sectionRhythm.length <= 12
    && typeof report.fingerprint.mediaCoverage === "number"
    && typeof report.fingerprint.interactionDensity === "number"
    && typeof report.fingerprint.roundedness === "number"
    && typeof report.fingerprint.routeCount === "number"
    && (!report.firstViewport || (
      Number.isInteger(report.firstViewport.taskSignalCount)
      && report.firstViewport.taskSignalCount >= 0
      && report.firstViewport.taskSignalCount <= 2
      && boundedUnit(report.firstViewport.taskCoverage)
      && boundedUnit(report.firstViewport.informationSalience)
      && typeof report.firstViewport.primaryActionVisible === "boolean"
      && boundedUnit(report.firstViewport.actionClarity)
      && boundedUnit(report.firstViewport.scrollCost)
      && boundedUnit(report.firstViewport.score)
    ))
    && report.checks.length <= 10
    && report.checks.every((item) => item
      && ["horizontal-overflow", "runtime-errors", "tiny-text", "image-alt", "duplicate-ids", "button-names", "first-viewport-effectiveness"].includes(item.id)
      && ["pass", "warning", "fail"].includes(item.status)
      && typeof item.title === "string"
      && item.title.length <= 120
      && typeof item.message === "string"
      && item.message.length <= 2_000);
}
