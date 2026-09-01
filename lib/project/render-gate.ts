import type { GeneratedProject } from "./types";
import { replaceOwnedAssetReferences } from "./brand-kit";
import { FIRST_VIEWPORT_THRESHOLDS, type FirstViewportEvidence } from "../domain/first-viewport";
import type {
  CompositionMobileTransform,
  CompositionStructure,
  VerveProjectSpec,
  VisualLayer,
} from "../domain/project-spec";
import type { BriefEvidenceKind } from "../domain/brief-evidence";

export type SandboxFileMap = Record<string, { code: string }>;

export type RenderGateCheck = {
  id: "horizontal-overflow" | "runtime-errors" | "tiny-text" | "image-alt" | "duplicate-ids" | "button-names" | "first-viewport-effectiveness" | "functional-visual-fulfillment" | "rendered-evidence-salience" | "rendered-composition-realization";
  title: string;
  status: "pass" | "warning" | "fail";
  message: string;
};

export type FunctionalVisualEvidence = {
  score: number;
  expectedScenes: number;
  renderedScenes: number;
  fulfilledScenes: number;
  requiredLayers: VisualLayer[];
  observedLayers: VisualLayer[];
  missingLayers: VisualLayer[];
  orphanVisualRatio: number;
  missingAssetSceneIds: string[];
};

export type RenderedEvidenceSalience = {
  /** Experimental evidence-realization measure, not a creativity or taste score. */
  score: number;
  coverage: number;
  prominence: number;
  firstViewportCoverage: number;
  expected: number;
  observed: number;
  prominent: number;
  missingEvidenceKeys: string[];
  missingCriticalKeys: string[];
  privacy: "numeric-and-hashed-evidence-only";
};

export type RenderedCompositionGeometry = {
  itemCount: number;
  columnBands: number;
  rowBands: number;
  horizontalSpread: number;
  verticalSpread: number;
  overlapRatio: number;
  boundaryCrossing: number;
  dominance: number;
  depthDensity: number;
  edgeBias: number;
  sizeVariation: number;
  angularCoverage: number;
  alignmentConcentration: number;
  occupiedArea: number;
  mediaCoverage: number;
  mediaFragments: number;
  internalPan: boolean;
};

export type RenderedCompositionScene = {
  /** FNV-1a hash of the private scene ID. */
  sceneKey: string;
  structure: CompositionStructure;
  mobileTransform: CompositionMobileTransform;
  markerMatch: boolean;
  score: number;
  geometry: RenderedCompositionGeometry;
};

export type RenderedCompositionRealization = {
  /** Experimental geometry realization evidence, not a beauty score. */
  score: number;
  expectedScenes: number;
  observedScenes: number;
  realizedScenes: number;
  minimumAdjacentDistance: number;
  repeatedAdjacentPairs: number;
  scenes: RenderedCompositionScene[];
  missingSceneKeys: string[];
  weakSceneKeys: string[];
  privacy: "numeric-and-hashed-composition-only";
};

export type VisualFingerprint = {
  /** Missing on legacy local-memory entries. New probes always emit version 2. */
  schemaVersion?: 2;
  occupancyGrid: number[];
  typographyScale: number[];
  colorHistogram: { color: string; weight: number }[];
  /** Area-weighted surfaces, unlike colorHistogram's legacy DOM-frequency signal. */
  colorAreaHistogram?: { color: string; weight: number }[];
  /** Privacy-safe font family names weighted by visible text area. */
  fontHistogram?: { family: string; weight: number }[];
  visualLayerHistogram?: { layer: VisualLayer; weight: number }[];
  mediaCoverage: number;
  interactionDensity: number;
  statefulControlDensity?: number;
  roundedness: number;
  depthDensity?: number;
  alignmentDiversity?: number;
  sectionRhythm: number[];
  routeCount: number;
};

export type RenderSurfaceIdentity = {
  /** FNV-1a hashes only: no route names, labels, copy, or form values leave the preview. */
  routeKey: string;
  stateKey: string;
  activeStateCount: number;
  expectedStateCount: number;
};

export type RenderGateReport = {
  source: "verve-render-gate";
  probeId: string;
  sequence: number;
  viewport: { width: number; height: number; documentWidth: number };
  surface?: RenderSurfaceIdentity;
  checks: RenderGateCheck[];
  fingerprint: VisualFingerprint;
  firstViewport?: FirstViewportEvidence;
  functionalVisual?: FunctionalVisualEvidence;
  renderedEvidence?: RenderedEvidenceSalience;
  renderedComposition?: RenderedCompositionRealization;
};

function vectorDistance(left: number[], right: number[]): number {
  const size = Math.max(left.length, right.length);
  if (size === 0) return 0;
  let total = 0;
  for (let index = 0; index < size; index++) total += Math.abs((left[index] ?? 0) - (right[index] ?? 0));
  return Math.min(1, total / size);
}

function histogramDistance<T extends { weight: number }>(
  left: T[],
  right: T[],
  key: (entry: T) => string
): number {
  const values = new Set([...left.map(key), ...right.map(key)]);
  let total = 0;
  values.forEach((value) => {
    total += Math.abs((left.find((entry) => key(entry) === value)?.weight ?? 0) - (right.find((entry) => key(entry) === value)?.weight ?? 0));
  });
  return Math.min(1, total / 2);
}

export function visualFingerprintDistance(left: VisualFingerprint, right: VisualFingerprint): number {
  const routeDistance = Math.min(1, Math.abs(left.routeCount - right.routeCount) / Math.max(1, left.routeCount, right.routeCount));
  const hasPerceptualV2 = left.schemaVersion === 2
    && right.schemaVersion === 2
    && left.colorAreaHistogram
    && right.colorAreaHistogram
    && left.fontHistogram
    && right.fontHistogram
    && left.visualLayerHistogram
    && right.visualLayerHistogram;
  if (hasPerceptualV2) {
    const distance = vectorDistance(left.occupancyGrid, right.occupancyGrid) * 0.26
      + vectorDistance(left.typographyScale, right.typographyScale) * 0.1
      + histogramDistance(left.fontHistogram!, right.fontHistogram!, (entry) => entry.family.toLowerCase()) * 0.1
      + histogramDistance(left.colorAreaHistogram!, right.colorAreaHistogram!, (entry) => entry.color) * 0.14
      + Math.abs(left.mediaCoverage - right.mediaCoverage) * 0.08
      + Math.abs(left.interactionDensity - right.interactionDensity) * 0.05
      + Math.abs((left.statefulControlDensity ?? 0) - (right.statefulControlDensity ?? 0)) * 0.05
      + histogramDistance(left.visualLayerHistogram!, right.visualLayerHistogram!, (entry) => entry.layer) * 0.09
      + Math.abs((left.depthDensity ?? 0) - (right.depthDensity ?? 0)) * 0.04
      + Math.abs((left.alignmentDiversity ?? 0) - (right.alignmentDiversity ?? 0)) * 0.03
      + vectorDistance(left.sectionRhythm, right.sectionRhythm) * 0.03
      + routeDistance * 0.03;
    return Number(Math.min(1, distance).toFixed(3));
  }
  const distance = vectorDistance(left.occupancyGrid, right.occupancyGrid) * 0.35
    + vectorDistance(left.typographyScale, right.typographyScale) * 0.2
    + histogramDistance(left.colorHistogram, right.colorHistogram, (entry) => entry.color) * 0.15
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
  functionalVisualScore: number | null;
  renderedEvidenceScore: number | null;
  renderedCompositionScore: number | null;
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
    functionalVisualScore: null,
    renderedEvidenceScore: null,
    renderedCompositionScore: null,
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
  const functionalVisualScores = captured.flatMap((item) => item.functionalVisual ? [item.functionalVisual.score] : []);
  const renderedEvidenceScores = captured.flatMap((item) => item.renderedEvidence ? [item.renderedEvidence.score] : []);
  const renderedCompositionScores = captured.flatMap((item) => item.renderedComposition ? [item.renderedComposition.score] : []);
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
    functionalVisualScore: functionalVisualScores.length ? Math.min(...functionalVisualScores) : null,
    renderedEvidenceScore: renderedEvidenceScores.length ? Math.min(...renderedEvidenceScores) : null,
    renderedCompositionScore: renderedCompositionScores.length ? Math.min(...renderedCompositionScores) : null,
  };
}

const PROBE_FILE = "/__verve_render_probe.js";
const REACT_PROBE_FILE = "/src/__verve_render_probe.js";

export type RenderProbeContext = { routeId?: string; routePath?: string };

function visualIntentExpectation(spec?: VerveProjectSpec, context?: RenderProbeContext) {
  if (!spec) return null;
  const defaultRoute = spec.experience.routes.find((route) => context?.routeId === route.id || context?.routePath === route.path)
    ?? spec.experience.routes.find((route) => route.path === spec.experience.route)
    ?? spec.experience.routes[0];
  const evidenceKinds = new Map<string, BriefEvidenceKind>((spec.briefEvidence?.items ?? []).map((item) => [item.id, item.kind]));
  const narrativeScenes = spec.narrative?.scenes ?? [];
  const sceneDirections = spec.assetDirection?.sceneDirections ?? [];
  const compositionAssignments = new Map((spec.narrative?.compositionGenome?.assignments ?? []).map((assignment) => [assignment.sceneId, assignment]));
  return {
    defaultRouteIdentity: defaultRoute?.id ?? defaultRoute?.path ?? "root",
    routes: spec.experience.routes.map((route) => {
      const sceneIds = new Set(route.regionIds);
      const routeScenes = narrativeScenes.filter((scene) => scene.routeId === route.id);
      const componentIds = new Set(spec.components.filter((component) => component.routeId === route.id).map((component) => component.id));
      const evidence = [...new Set(routeScenes.flatMap((scene) => scene.evidenceIds ?? []))]
        .flatMap((id) => {
          const kind = evidenceKinds.get(id);
          return kind && kind !== "prohibited-pattern" ? [{ id, kind }] : [];
        });
      const firstScene = routeScenes[0];
      return {
        routeIdentity: route.id,
        path: route.path,
        expectedStateCount: Math.max(1, spec.interactions
          .filter((interaction) => componentIds.has(interaction.componentId))
          .reduce((total, interaction) => total + Math.max(1, interaction.states.length), 0)),
        evidence,
        firstViewportEvidenceIds: (firstScene?.evidenceIds ?? []).filter((id) => evidence.some((item) => item.id === id)),
        scenes: sceneDirections.filter((direction) => sceneIds.has(direction.sceneId)).map((direction) => {
          const composition = compositionAssignments.get(direction.sceneId);
          return {
            id: direction.sceneId,
            layers: direction.expectedLayers,
            assetIds: direction.selectedAssetIds,
            assetRequired: direction.requirement === "required",
            composition: composition ? {
              genes: composition.genes,
              mobileTransform: composition.mobileTransform,
            } : null,
          };
        }),
      };
    }),
  };
}

export function createRenderProbeSource(probeId: string, projectSpec?: VerveProjectSpec, context?: RenderProbeContext): string {
  return `(() => {
  const PROBE_ID = ${JSON.stringify(probeId)};
  const VISUAL_INTENT = ${JSON.stringify(visualIntentExpectation(projectSpec, context))};
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
  const privacyKey = (value) => {
    const source = String(value || "root");
    let hash = 2166136261;
    for (let index = 0; index < source.length; index++) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return "surface-" + (hash >>> 0).toString(36);
  };
  const visible = (element) => {
    let current = element;
    while (current instanceof Element) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity || "1") <= 0.01) return false;
      current = current.parentElement;
    }
    return element.getClientRects().length > 0;
  };
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(report, 180);
  };
  ["pushState", "replaceState"].forEach((method) => {
    try {
      const original = history[method].bind(history);
      history[method] = (...args) => {
        const outcome = original(...args);
        schedule();
        return outcome;
      };
    } catch {
      // Some embedded runtimes expose immutable History methods. Popstate,
      // hashchange, and mutation observation still collect useful evidence.
    }
  });
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
    const normalizedLocationPath = (location.pathname || "/").replace(/\\/+$/, "") || "/";
    const activeVisualIntent = VISUAL_INTENT && Array.isArray(VISUAL_INTENT.routes)
      ? VISUAL_INTENT.routes.find((route) => ((route.path || "/").replace(/\\/+$/, "") || "/") === normalizedLocationPath)
        || VISUAL_INTENT.routes.find((route) => route.routeIdentity === VISUAL_INTENT.defaultRouteIdentity)
        || VISUAL_INTENT.routes[0]
      : null;
    const viewportArea = Math.max(1, width * window.innerHeight);
    const clippedArea = (element) => {
      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(width, rect.right) - Math.max(0, rect.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
      return visibleWidth * visibleHeight;
    };
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
    const directlyAuthoredText = textElements.filter((element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim()));
    const fonts = new Map();
    directlyAuthoredText.forEach((element) => {
      const family = (getComputedStyle(element).fontFamily.split(",")[0] || "unknown").replace(/["']/g, "").trim().slice(0, 80);
      const weight = Math.min(viewportArea * 0.12, clippedArea(element));
      if (weight > 0) fonts.set(family, (fonts.get(family) || 0) + weight);
    });
    const fontTotal = Math.max(1, [...fonts.values()].reduce((sum, value) => sum + value, 0));
    const fontHistogram = [...fonts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([family, area]) => ({ family, weight: Number((area / fontTotal).toFixed(3)) }));
    const colors = new Map();
    const colorAreas = new Map();
    visibleElements.forEach((element) => {
      const style = getComputedStyle(element);
      [style.backgroundColor, style.color].forEach((color) => {
        if (!color || color === "rgba(0, 0, 0, 0)") return;
        colors.set(color, (colors.get(color) || 0) + 1);
      });
      if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)") {
        const area = Math.min(viewportArea, clippedArea(element));
        if (area > 0) colorAreas.set(style.backgroundColor, (colorAreas.get(style.backgroundColor) || 0) + area);
      }
    });
    const colorTotal = Math.max(1, [...colors.values()].reduce((sum, value) => sum + value, 0));
    const colorHistogram = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([color, count]) => ({ color, weight: Number((count / colorTotal).toFixed(3)) }));
    const colorAreaTotal = Math.max(1, [...colorAreas.values()].reduce((sum, value) => sum + value, 0));
    const colorAreaHistogram = [...colorAreas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([color, area]) => ({ color, weight: Number((area / colorAreaTotal).toFixed(3)) }));
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
    const statefulElements = visibleElements.filter((element) => element.matches("[aria-selected],[aria-pressed],[aria-expanded],[aria-current],[data-state],input:checked,option:checked"));
    const stateTokens = statefulElements.map((element) => {
      const state = ["aria-selected","aria-pressed","aria-expanded","aria-current","data-state"]
        .map((name) => name + "=" + (element.getAttribute(name) || ""))
        .filter((value) => !value.endsWith("="));
      if (element.matches("input:checked,option:checked")) state.push("checked=true");
      return selector(element) + ":" + state.join(",");
    }).sort();
    const roundedCount = visibleElements.filter((element) => parseFloat(getComputedStyle(element).borderRadius) >= 8).length;
    const depthCount = visibleElements.filter((element) => {
      const style = getComputedStyle(element);
      return style.boxShadow !== "none" || style.filter !== "none" || style.backdropFilter !== "none" || style.mixBlendMode !== "normal";
    }).length;
    const alignmentBuckets = new Set();
    visualElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (clippedArea(element) <= 0) return;
      [rect.left, rect.left + rect.width / 2, rect.right].forEach((position) => {
        alignmentBuckets.add(Math.max(0, Math.min(17, Math.round((position / Math.max(1, width)) * 17))));
      });
    });
    const layerAreas = new Map([["type", 0], ["media", 0], ["data", 0], ["shape", 0], ["motion", 0], ["interaction", 0]]);
    visualElements.forEach((element) => {
      const area = Math.min(viewportArea * 0.3, clippedArea(element));
      if (area <= 0) return;
      const style = getComputedStyle(element);
      const directText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim());
      const layers = [];
      if (directText) layers.push("type");
      if (element.matches("img,picture,video")) layers.push("media");
      if (element.matches("table,dl,[data-verve-layer=data]")) layers.push("data");
      if (element.matches("svg,canvas,[data-verve-layer=shape]") || style.clipPath !== "none") layers.push("shape");
      if (element.matches("a,button,input,select,textarea,[role=button],[tabindex]")) layers.push("interaction");
      const animated = style.animationName !== "none"
        || style.animationDuration.split(",").some((value) => parseFloat(value) > 0)
        || style.transitionDuration.split(",").some((value) => parseFloat(value) > 0);
      if (animated) layers.push("motion");
      layers.forEach((layer) => layerAreas.set(layer, (layerAreas.get(layer) || 0) + area));
    });
    const layerAreaTotal = Math.max(1, [...layerAreas.values()].reduce((sum, value) => sum + value, 0));
    const visualLayerHistogram = [...layerAreas.entries()].filter((entry) => entry[1] > 0)
      .map(([layer, area]) => ({ layer, weight: Number((area / layerAreaTotal).toFixed(3)) }));
    const sections = [...document.querySelectorAll("main > section, main > article, body > section")].filter(visible).slice(0, 12);
    const sectionRhythm = sections.map((element) => Number(Math.min(2, element.getBoundingClientRect().height / Math.max(1, window.innerHeight)).toFixed(3)));
    const routeCount = new Set([...document.querySelectorAll("a[href]")]
      .map((element) => element.getAttribute("href") || "")
      .filter((href) => href.startsWith("/") && !href.startsWith("/#"))
      .map((href) => href.split("#")[0])).size || 1;
    const fingerprint = {
      schemaVersion: 2,
      occupancyGrid: occupancyGrid.map((value) => Number(value.toFixed(3))),
      typographyScale,
      colorHistogram,
      colorAreaHistogram,
      fontHistogram,
      visualLayerHistogram,
      mediaCoverage: Number(Math.min(1, mediaArea / viewportArea).toFixed(3)),
      interactionDensity: Number(Math.min(1, interactionCount / Math.max(1, visibleElements.length)).toFixed(3)),
      statefulControlDensity: Number(Math.min(1, statefulElements.length / Math.max(1, interactionCount)).toFixed(3)),
      roundedness: Number(Math.min(1, roundedCount / Math.max(1, visibleElements.length)).toFixed(3)),
      depthDensity: Number(Math.min(1, depthCount / Math.max(1, visibleElements.length)).toFixed(3)),
      alignmentDiversity: Number(Math.min(1, Math.max(0, alignmentBuckets.size - 1) / 17).toFixed(3)),
      sectionRhythm,
      routeCount
    };
    const surface = {
      routeKey: privacyKey(activeVisualIntent?.routeIdentity || location.pathname || "root"),
      stateKey: privacyKey(stateTokens.length ? stateTokens.join("|") : "default"),
      activeStateCount: stateTokens.length,
      expectedStateCount: Math.max(1, Number(activeVisualIntent?.expectedStateCount || 1))
    };
    let functionalVisual = null;
    if (activeVisualIntent && Array.isArray(activeVisualIntent.scenes) && activeVisualIntent.scenes.length > 0) {
      const sceneResults = activeVisualIntent.scenes.map((expected) => {
        const root = document.querySelector('[data-verve-scene="' + CSS.escape(expected.id) + '"]');
        if (!root || !visible(root)) return { id: expected.id, rendered: false, score: 0, layers: [], assetMissing: Boolean(expected.assetRequired) };
        const descendants = [root, ...root.querySelectorAll('*')].filter(visible);
        const layers = new Set();
        if ((root.textContent || '').trim().length > 0) layers.add('type');
        if (descendants.some((element) => element.matches('img,video'))) layers.add('media');
        if (descendants.some((element) => element.matches('table,dl,[data-verve-layer="data"]'))) layers.add('data');
        if (descendants.some((element) => element.matches('svg,canvas,[data-verve-layer="shape"]'))) layers.add('shape');
        if (descendants.some((element) => element.matches('a,button,input,select,textarea,[role=button],[tabindex]'))) layers.add('interaction');
        descendants.filter((element) => element.hasAttribute('data-verve-layer')).forEach((element) => {
          const layer = element.getAttribute('data-verve-layer');
          if (!['type','media','data','shape','motion','interaction'].includes(layer)) return;
          if (layer === 'media' && !element.matches('img,video,picture,source') && !element.querySelector('img,video,picture,source')) return;
          if (layer === 'interaction' && !element.matches('a,button,input,select,textarea,[role=button],[tabindex]') && !element.querySelector('a,button,input,select,textarea,[role=button],[tabindex]')) return;
          if (layer === 'motion') {
            const style = getComputedStyle(element);
            const duration = style.animationDuration.split(',').some((value) => parseFloat(value) > 0) || style.transitionDuration.split(',').some((value) => parseFloat(value) > 0);
            if (style.animationName === 'none' && !duration) return;
          }
          layers.add(layer);
        });
        const purposeLinked = expected.layers.every((layer) => layer === 'type') || descendants.some((element) => (element.getAttribute('data-verve-visual-purpose') || '').trim().length > 0);
        const matchedLayers = expected.layers.filter((layer) => layers.has(layer)).length;
        const layerCoverage = expected.layers.length ? matchedLayers / expected.layers.length : 1;
        const assetMissing = Boolean(expected.assetRequired) && (!expected.assetIds.length || !expected.assetIds.some((id) => {
          const asset = root.querySelector('[data-verve-asset-id="' + CSS.escape(id) + '"]');
          return asset && visible(asset) && asset.matches('img,video,picture,source');
        }));
        let sceneScore = Math.sqrt(layerCoverage * (purposeLinked ? 1 : 0.45));
        if (assetMissing) sceneScore *= 0.5;
        return { id: expected.id, rendered: true, score: sceneScore, layers: [...layers], assetMissing };
      });
      const allScores = sceneResults.map((scene) => Math.max(0.001, scene.score));
      const harmonic = allScores.length / allScores.reduce((sum, value) => sum + 1 / value, 0);
      const visualCandidates = [...document.querySelectorAll('img,video,svg,canvas,[data-verve-layer]')].filter(visible);
      const visibleArea = (element) => {
        const rect = element.getBoundingClientRect();
        const visibleWidth = Math.max(0, Math.min(width, rect.right) - Math.max(0, rect.left));
        const visibleHeight = Math.max(0, rect.height);
        return visibleWidth * visibleHeight;
      };
      const totalVisualArea = Math.max(1, visualCandidates.reduce((sum, element) => sum + visibleArea(element), 0));
      const orphanVisualArea = visualCandidates.filter((element) => !element.closest('[data-verve-scene]')).reduce((sum, element) => sum + visibleArea(element), 0);
      const orphanVisualRatio = Math.min(1, orphanVisualArea / totalVisualArea);
      const requiredLayers = [...new Set(activeVisualIntent.scenes.flatMap((scene) => scene.layers))];
      const observedLayers = [...new Set(sceneResults.flatMap((scene) => scene.layers))];
      functionalVisual = {
        score: Number(Math.max(0, harmonic * (1 - orphanVisualRatio * 0.5)).toFixed(3)),
        expectedScenes: sceneResults.length,
        renderedScenes: sceneResults.filter((scene) => scene.rendered).length,
        fulfilledScenes: sceneResults.filter((scene) => scene.score >= 0.72).length,
        requiredLayers,
        observedLayers,
        missingLayers: requiredLayers.filter((layer) => !observedLayers.includes(layer)),
        orphanVisualRatio: Number(orphanVisualRatio.toFixed(3)),
        missingAssetSceneIds: sceneResults.filter((scene) => scene.assetMissing).map((scene) => scene.id)
      };
    }
    let renderedComposition = null;
    const expectedCompositionScenes = activeVisualIntent && Array.isArray(activeVisualIntent.scenes)
      ? activeVisualIntent.scenes.filter((scene) => scene.composition)
      : [];
    if (expectedCompositionScenes.length > 0) {
      const clampUnit = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
      const mean = (values) => values.length ? values.reduce((sum, value) => sum + clampUnit(value), 0) / values.length : 0;
      const emptyGeometry = () => ({ itemCount: 0, columnBands: 0, rowBands: 0, horizontalSpread: 0, verticalSpread: 0, overlapRatio: 0, boundaryCrossing: 0, dominance: 0, depthDensity: 0, edgeBias: 0, sizeVariation: 0, angularCoverage: 0, alignmentConcentration: 0, occupiedArea: 0, mediaCoverage: 0, mediaFragments: 0, internalPan: false });
      const geometryDistance = (left, right) => {
        const leftVector = [left.columnBands / 4, left.rowBands / 4, left.horizontalSpread, left.verticalSpread, left.overlapRatio, left.boundaryCrossing, left.dominance, left.depthDensity, left.edgeBias, left.sizeVariation, left.angularCoverage, left.alignmentConcentration, left.occupiedArea, left.mediaCoverage, Math.min(1, left.mediaFragments / 4), left.internalPan ? 1 : 0];
        const rightVector = [right.columnBands / 4, right.rowBands / 4, right.horizontalSpread, right.verticalSpread, right.overlapRatio, right.boundaryCrossing, right.dominance, right.depthDensity, right.edgeBias, right.sizeVariation, right.angularCoverage, right.alignmentConcentration, right.occupiedArea, right.mediaCoverage, Math.min(1, right.mediaFragments / 4), right.internalPan ? 1 : 0];
        return mean(leftVector.map((value, index) => Math.abs(value - rightVector[index])));
      };
      const scoreStructure = (structure, geometry) => {
        const items = Math.min(1, geometry.itemCount / 4);
        const columns = Math.min(1, geometry.columnBands / 3);
        const rows = Math.min(1, geometry.rowBands / 3);
        if (structure === 'single-object-stage') return mean([geometry.dominance, 1 - Math.min(1, Math.max(0, geometry.itemCount - 2) / 5), 1 - geometry.edgeBias * 0.55]);
        if (structure === 'split-stage') return mean([Math.min(1, geometry.horizontalSpread * 1.6), geometry.columnBands >= 2 ? 1 : 0, Math.min(1, geometry.itemCount / 2), 1 - geometry.overlapRatio]);
        if (structure === 'rail-canvas') return mean([Math.min(1, geometry.horizontalSpread * 1.5), columns, items, geometry.internalPan ? 1 : 0.65]);
        if (structure === 'layered-field') return mean([Math.min(1, Math.max(geometry.overlapRatio * 4, geometry.boundaryCrossing * 2, geometry.depthDensity * 2)), Math.min(1, geometry.itemCount / 3), geometry.sizeVariation]);
        if (structure === 'modular-matrix') return mean([items, columns, rows, 1 - geometry.overlapRatio]);
        if (structure === 'radial-map') return mean([Math.min(1, geometry.itemCount / 3), geometry.angularCoverage, 1 - geometry.alignmentConcentration, Math.min(1, geometry.horizontalSpread + geometry.verticalSpread)]);
        if (structure === 'editorial-spine') return mean([Math.min(1, geometry.verticalSpread * 1.4), rows, geometry.alignmentConcentration, Math.min(1, geometry.itemCount / 3)]);
        return mean([items, columns, rows, geometry.sizeVariation]);
      };
      const scoreGenes = (genes, geometry, largestCenterX) => {
        const horizontalLead = document.documentElement.dir === 'rtl' ? 0.75 : 0.25;
        const focal = genes.focalPosition === 'center' ? 1 - Math.min(1, Math.abs(largestCenterX - 0.5) * 2)
          : genes.focalPosition === 'edge' ? geometry.edgeBias
            : genes.focalPosition === 'distributed' ? mean([geometry.horizontalSpread, geometry.verticalSpread])
              : 1 - Math.min(1, Math.abs(largestCenterX - (genes.focalPosition === 'leading' ? horizontalLead : 1 - horizontalLead)) * 2);
        const flow = genes.flow === 'vertical' ? clampUnit(0.5 + (geometry.verticalSpread - geometry.horizontalSpread))
          : genes.flow === 'horizontal' ? clampUnit(0.5 + (geometry.horizontalSpread - geometry.verticalSpread))
            : genes.flow === 'radial' ? geometry.angularCoverage
              : genes.flow === 'freeform' ? mean([1 - geometry.alignmentConcentration, geometry.sizeVariation, Math.max(geometry.overlapRatio, geometry.boundaryCrossing)])
                : mean([Math.min(1, geometry.columnBands / 2), Math.min(1, geometry.rowBands / 2)]);
        const overlap = genes.overlap === 'none' ? 1 - geometry.overlapRatio
          : genes.overlap === 'contained' ? mean([1 - geometry.boundaryCrossing, Math.min(1, geometry.overlapRatio * 3 + geometry.depthDensity)])
            : Math.min(1, Math.max(geometry.boundaryCrossing * 2, geometry.overlapRatio * 3, geometry.depthDensity * 1.5));
        const depth = genes.depth === 'flat' ? 1 - geometry.depthDensity
          : genes.depth === 'layered' ? Math.min(1, geometry.depthDensity * 2 + geometry.overlapRatio)
            : Math.min(1, geometry.depthDensity * 1.7 + geometry.boundaryCrossing + geometry.dominance * 0.35);
        const density = genes.density === 'sparse' ? 1 - Math.min(1, Math.max(0, geometry.itemCount - 3) / 6)
          : genes.density === 'dense' ? mean([Math.min(1, geometry.itemCount / 5), geometry.occupiedArea])
            : mean([1 - Math.min(1, Math.abs(geometry.itemCount - 4) / 5), 1 - Math.min(1, Math.abs(geometry.occupiedArea - 0.55) / 0.55)]);
        const media = genes.mediaFrame === 'none' ? (geometry.mediaFragments === 0 ? 1 : 0)
          : genes.mediaFrame === 'full-bleed' ? Math.min(1, geometry.mediaCoverage / 0.5)
            : genes.mediaFrame === 'fragmented' ? mean([Math.min(1, geometry.mediaFragments / 2), geometry.sizeVariation])
              : genes.mediaFrame === 'strip' ? mean([geometry.mediaFragments > 0 ? 1 : 0, Math.min(1, geometry.horizontalSpread * 1.5)])
                : genes.mediaFrame === 'constellation' ? mean([Math.min(1, geometry.mediaFragments / 3), geometry.angularCoverage])
                  : mean([geometry.mediaFragments > 0 ? 1 : 0.65, 1 - Math.max(0, geometry.mediaCoverage - 0.65)]);
        return mean([focal, flow, overlap, depth, density, media]);
      };
      const sceneResults = expectedCompositionScenes.map((expected) => {
        const root = document.querySelector('[data-verve-scene="' + CSS.escape(expected.id) + '"]');
        if (!root || !visible(root)) return { id: expected.id, observed: false, markerMatch: false, score: 0, geometry: emptyGeometry(), structure: expected.composition.genes.structure, mobileTransform: expected.composition.mobileTransform };
        const rootRect = root.getBoundingClientRect();
        const meaningful = (element) => {
          if (!visible(element)) return false;
          const rect = element.getBoundingClientRect();
          return rect.width >= 4 && rect.height >= 4 && rect.bottom >= rootRect.top && rect.top <= rootRect.bottom;
        };
        let items = [...root.children].filter(meaningful);
        if (items.length === 1) {
          const unwrapped = [...items[0].children].filter(meaningful);
          if (unwrapped.length >= 2) items = unwrapped;
        }
        items = items.slice(0, 16);
        const rects = items.map((element) => element.getBoundingClientRect());
        const rootArea = Math.max(1, rootRect.width * rootRect.height);
        const areas = rects.map((rect) => Math.max(0, rect.width * rect.height));
        const totalArea = Math.max(1, areas.reduce((sum, value) => sum + value, 0));
        const largestIndex = areas.reduce((best, area, index) => area > (areas[best] || 0) ? index : best, 0);
        const largestRect = rects[largestIndex] || rootRect;
        const centerX = (rect) => clampUnit((rect.left + rect.width / 2 - rootRect.left) / Math.max(1, rootRect.width));
        const centerY = (rect) => clampUnit((rect.top + rect.height / 2 - rootRect.top) / Math.max(1, rootRect.height));
        const xCenters = rects.map(centerX);
        const yCenters = rects.map(centerY);
        const columnBands = new Set(xCenters.map((value) => Math.max(0, Math.min(3, Math.floor(value * 4))))).size;
        const rowBands = new Set(yCenters.map((value) => Math.max(0, Math.min(3, Math.floor(value * 4))))).size;
        let overlapTotal = 0;
        let overlapPairs = 0;
        for (let left = 0; left < rects.length; left++) for (let right = left + 1; right < rects.length; right++) {
          const intersectionWidth = Math.max(0, Math.min(rects[left].right, rects[right].right) - Math.max(rects[left].left, rects[right].left));
          const intersectionHeight = Math.max(0, Math.min(rects[left].bottom, rects[right].bottom) - Math.max(rects[left].top, rects[right].top));
          overlapTotal += intersectionWidth * intersectionHeight / Math.max(1, Math.min(areas[left], areas[right]));
          overlapPairs++;
        }
        const descendants = [root, ...root.querySelectorAll('*')].filter(visible).slice(0, 80);
        const depthSignals = descendants.filter((element) => {
          const style = getComputedStyle(element);
          const z = Number.parseInt(style.zIndex, 10);
          return Boolean(style.boxShadow && style.boxShadow !== 'none') || Boolean(style.filter && style.filter !== 'none') || Boolean(style.backdropFilter && style.backdropFilter !== 'none') || Boolean(style.transform && style.transform !== 'none') || ['absolute','fixed','sticky'].includes(style.position) || (Number.isFinite(z) && z !== 0);
        }).length;
        const mediaElements = descendants.filter((element) => element.matches('img,picture,video,canvas,svg'));
        const mediaArea = mediaElements.reduce((sum, element) => {
          const rect = element.getBoundingClientRect();
          return sum + Math.max(0, rect.width * rect.height);
        }, 0);
        const quadrants = new Set(rects.map((rect) => {
          const x = centerX(rect) - 0.5;
          const y = centerY(rect) - 0.5;
          return (x >= 0 ? 1 : 0) + (y >= 0 ? 2 : 0);
        }));
        const alignmentBuckets = new Map();
        rects.forEach((rect) => {
          const bucket = Math.max(0, Math.min(7, Math.round(clampUnit((rect.left - rootRect.left) / Math.max(1, rootRect.width)) * 7)));
          alignmentBuckets.set(bucket, (alignmentBuckets.get(bucket) || 0) + 1);
        });
        const geometry = {
          itemCount: items.length,
          columnBands,
          rowBands,
          horizontalSpread: xCenters.length > 1 ? Math.max(...xCenters) - Math.min(...xCenters) : 0,
          verticalSpread: yCenters.length > 1 ? Math.max(...yCenters) - Math.min(...yCenters) : 0,
          overlapRatio: overlapPairs ? clampUnit(overlapTotal / overlapPairs) : 0,
          boundaryCrossing: rects.length ? rects.filter((rect) => rect.left < rootRect.left - 2 || rect.right > rootRect.right + 2 || rect.top < rootRect.top - 2 || rect.bottom > rootRect.bottom + 2).length / rects.length : 0,
          dominance: areas.length ? clampUnit(Math.max(...areas) / totalArea) : 0,
          depthDensity: clampUnit(depthSignals / Math.max(1, Math.min(12, descendants.length))),
          edgeBias: clampUnit(Math.abs(centerX(largestRect) - 0.5) * 2),
          sizeVariation: areas.length > 1 ? clampUnit((Math.max(...areas) - Math.min(...areas)) / Math.max(1, Math.max(...areas))) : 0,
          angularCoverage: clampUnit(quadrants.size / 4),
          alignmentConcentration: items.length ? clampUnit(Math.max(0, ...alignmentBuckets.values()) / items.length) : 0,
          occupiedArea: clampUnit(totalArea / rootArea),
          mediaCoverage: clampUnit(mediaArea / rootArea),
          mediaFragments: mediaElements.length,
          internalPan: root.scrollWidth > root.clientWidth + 2
        };
        Object.keys(geometry).forEach((key) => { if (typeof geometry[key] === 'number') geometry[key] = key === 'itemCount' || key === 'columnBands' || key === 'rowBands' || key === 'mediaFragments' ? geometry[key] : Number(clampUnit(geometry[key]).toFixed(3)); });
        const genes = expected.composition.genes;
        const markerMatch = root.getAttribute('data-verve-composition') === genes.structure && root.getAttribute('data-verve-flow') === genes.flow && root.getAttribute('data-verve-depth') === genes.depth;
        const geometryScore = Math.sqrt(Math.max(0, scoreStructure(genes.structure, geometry) * scoreGenes(genes, geometry, centerX(largestRect))));
        return { id: expected.id, observed: true, markerMatch, score: Number((geometryScore * (markerMatch ? 1 : 0.45)).toFixed(3)), geometry, structure: genes.structure, mobileTransform: expected.composition.mobileTransform };
      });
      const observed = sceneResults.filter((scene) => scene.observed);
      const adjacentDistances = [];
      for (let index = 1; index < observed.length; index++) adjacentDistances.push(geometryDistance(observed[index - 1].geometry, observed[index].geometry));
      const minimumAdjacentDistance = adjacentDistances.length ? Math.min(...adjacentDistances) : 1;
      const repeatedAdjacentPairs = adjacentDistances.filter((distance) => distance < 0.12).length;
      const harmonicScores = sceneResults.map((scene) => Math.max(0.001, scene.score));
      const harmonicScore = harmonicScores.length / harmonicScores.reduce((sum, value) => sum + 1 / value, 0);
      const score = harmonicScore * (1 - repeatedAdjacentPairs / Math.max(1, adjacentDistances.length) * 0.35);
      renderedComposition = {
        score: Number(clampUnit(score).toFixed(3)),
        expectedScenes: sceneResults.length,
        observedScenes: observed.length,
        realizedScenes: sceneResults.filter((scene) => scene.score >= 0.6).length,
        minimumAdjacentDistance: Number(clampUnit(minimumAdjacentDistance).toFixed(3)),
        repeatedAdjacentPairs,
        scenes: observed.map((scene) => ({ sceneKey: privacyKey('composition:' + scene.id), structure: scene.structure, mobileTransform: scene.mobileTransform, markerMatch: scene.markerMatch, score: scene.score, geometry: scene.geometry })),
        missingSceneKeys: sceneResults.filter((scene) => !scene.observed).map((scene) => privacyKey('composition:' + scene.id)),
        weakSceneKeys: sceneResults.filter((scene) => scene.observed && scene.score < 0.6).map((scene) => privacyKey('composition:' + scene.id)),
        privacy: 'numeric-and-hashed-composition-only'
      };
    }
    let renderedEvidence = null;
    if (activeVisualIntent && Array.isArray(activeVisualIntent.evidence) && activeVisualIntent.evidence.length > 0) {
      const weightOf = (kind) => kind === 'record' || kind === 'collection-expectation' ? 3 : kind === 'comparison-dimension' ? 2 : 1;
      const firstViewportIds = new Set(activeVisualIntent.firstViewportEvidenceIds || []);
      const evidenceResults = activeVisualIntent.evidence.map((expected) => {
        const candidates = [...document.querySelectorAll('[data-verve-evidence-id="' + CSS.escape(expected.id) + '"]')]
          .filter((element) => {
            if (!visible(element)) return false;
            const content = (element.textContent || '').trim();
            return content.length >= 2 || element.matches('img,video,table,dl,input,select,button,a[href]') || Boolean(element.querySelector('img,video,table,dl,input,select,button,a[href]'));
          });
        const measured = candidates.map((element) => {
          const rect = element.getBoundingClientRect();
          const horizontalWidth = Math.max(0, Math.min(width, rect.right) - Math.max(0, rect.left));
          const elementArea = Math.max(0, horizontalWidth * Math.max(0, rect.height));
          const areaRatio = elementArea / viewportArea;
          // A page-sized proxy must remain below the pass threshold even when
          // its type is large. Evidence hooks belong on the rendered datum,
          // comparison row, or record group rather than a scene shell.
          const specificity = areaRatio > 0.35 ? 0.16 : areaRatio > 0.2 ? 0.55 : 1;
          const areaScore = Math.min(1, areaRatio / 0.06) * specificity;
          const fontScore = Math.min(1, (parseFloat(getComputedStyle(element).fontSize) || 0) / 24);
          const structured = element.matches('tr,td,th,table,dl,dt,dd,[data-verve-layer="data"]') || Boolean(element.closest('table,dl,[data-verve-layer="data"]')) ? 1 : 0.65;
          const prominence = Math.sqrt(Math.max(0, areaScore) * (fontScore * 0.55 + structured * 0.45));
          return { prominence, firstViewport: clippedArea(element) > 0 };
        }).sort((left, right) => right.prominence - left.prominence);
        const best = measured[0];
        return {
          id: expected.id,
          key: privacyKey('evidence:' + expected.id),
          kind: expected.kind,
          weight: weightOf(expected.kind),
          observed: Boolean(best),
          prominence: best ? Math.min(1, best.prominence) : 0,
          firstViewport: Boolean(best?.firstViewport)
        };
      });
      const expectedWeight = Math.max(1, evidenceResults.reduce((sum, item) => sum + item.weight, 0));
      const observedWeight = evidenceResults.filter((item) => item.observed).reduce((sum, item) => sum + item.weight, 0);
      const coverage = Math.min(1, observedWeight / expectedWeight);
      const prominence = observedWeight > 0
        ? evidenceResults.reduce((sum, item) => sum + item.prominence * item.weight, 0) / observedWeight
        : 0;
      const firstViewportExpected = evidenceResults.filter((item) => firstViewportIds.has(item.id));
      const firstViewportWeight = firstViewportExpected.reduce((sum, item) => sum + item.weight, 0);
      const firstViewportCovered = firstViewportExpected.filter((item) => item.firstViewport).reduce((sum, item) => sum + item.weight, 0);
      const missing = evidenceResults.filter((item) => !item.observed);
      const criticalKinds = new Set(['record', 'collection-expectation']);
      renderedEvidence = {
        score: Number(Math.sqrt(Math.max(0, coverage * prominence)).toFixed(3)),
        coverage: Number(coverage.toFixed(3)),
        prominence: Number(Math.min(1, prominence).toFixed(3)),
        firstViewportCoverage: Number((firstViewportWeight > 0 ? firstViewportCovered / firstViewportWeight : 1).toFixed(3)),
        expected: evidenceResults.length,
        observed: evidenceResults.filter((item) => item.observed).length,
        prominent: evidenceResults.filter((item) => item.prominence >= 0.55).length,
        missingEvidenceKeys: missing.map((item) => item.key),
        missingCriticalKeys: missing.filter((item) => criticalKinds.has(item.kind)).map((item) => item.key),
        privacy: 'numeric-and-hashed-evidence-only'
      };
    }
    const checks = [
      { id: "horizontal-overflow", title: "Rendered mobile width", status: documentWidth > width + 1 ? "fail" : "pass", message: documentWidth > width + 1 ? "Document is " + documentWidth + "px wide in a " + width + "px viewport. Offenders: " + (overflowElements.join(", ") || "unknown") : "No rendered horizontal overflow detected at " + width + "px." },
      { id: "runtime-errors", title: "Rendered runtime", status: runtimeErrors.length ? "fail" : "pass", message: runtimeErrors.length ? runtimeErrors.join(" | ") : "No runtime or console errors captured." },
      { id: "tiny-text", title: "Rendered text size", status: tinyText.length ? "warning" : "pass", message: tinyText.length ? "Visible text below 10px: " + tinyText.join(", ") : "No visible text below 10px detected." },
      { id: "image-alt", title: "Rendered image alternatives", status: missingAlt.length ? "warning" : "pass", message: missingAlt.length ? "Images without alt: " + missingAlt.join(", ") : "Every rendered image has an alt attribute." },
      { id: "duplicate-ids", title: "Rendered element identity", status: duplicateIds.length ? "warning" : "pass", message: duplicateIds.length ? "Duplicate ids: " + duplicateIds.join(", ") : "No duplicate rendered ids detected." },
      { id: "button-names", title: "Rendered button names", status: unnamedButtons.length ? "warning" : "pass", message: unnamedButtons.length ? "Unnamed buttons: " + unnamedButtons.join(", ") : "Every rendered button has an accessible name." },
      { id: "first-viewport-effectiveness", title: "First viewport effectiveness", status: taskSignalCount < ${FIRST_VIEWPORT_THRESHOLDS.minimumTaskSignals} || !primaryActionVisible || firstViewportScore < ${FIRST_VIEWPORT_THRESHOLDS.reviewScore} ? "warning" : "pass", message: "FVE " + firstViewport.score.toFixed(2) + ": " + taskSignalCount + "/${FIRST_VIEWPORT_THRESHOLDS.minimumTaskSignals} task signals, information salience " + firstViewport.informationSalience.toFixed(2) + ", primary action " + (primaryActionVisible ? "visible" : "not visible") + ". Opening size is not scored." },
      ...(functionalVisual ? [{ id: "functional-visual-fulfillment", title: "Functional visual fulfillment", status: functionalVisual.missingAssetSceneIds.length || functionalVisual.renderedScenes < functionalVisual.expectedScenes ? "fail" : functionalVisual.score < 0.72 ? "warning" : "pass", message: "FVF " + functionalVisual.score.toFixed(2) + ": " + functionalVisual.fulfilledScenes + "/" + functionalVisual.expectedScenes + " scenes fulfilled, layers " + functionalVisual.observedLayers.join(", ") + ", orphan visual area " + functionalVisual.orphanVisualRatio.toFixed(2) + (functionalVisual.missingAssetSceneIds.length ? ", missing required assets in " + functionalVisual.missingAssetSceneIds.join(", ") : "") + ". Harmonic aggregation prevents one polished scene from hiding weak scenes." }] : []),
      ...(renderedEvidence ? [{ id: "rendered-evidence-salience", title: "Rendered evidence salience", status: renderedEvidence.missingCriticalKeys.length ? "fail" : renderedEvidence.score < 0.65 || renderedEvidence.firstViewportCoverage < 1 ? "warning" : "pass", message: "RES " + renderedEvidence.score.toFixed(2) + ": " + renderedEvidence.observed + "/" + renderedEvidence.expected + " scene-bound evidence items rendered, prominence " + renderedEvidence.prominence.toFixed(2) + ", first-viewport evidence " + renderedEvidence.firstViewportCoverage.toFixed(2) + ". The report contains hashes and numeric measurements only." }] : []),
      ...(renderedComposition ? [{ id: "rendered-composition-realization", title: "Rendered composition realization", status: renderedComposition.missingSceneKeys.length || renderedComposition.scenes.some((scene) => !scene.markerMatch) ? "fail" : renderedComposition.score < 0.6 || renderedComposition.repeatedAdjacentPairs > 0 ? "warning" : "pass", message: "RCR " + renderedComposition.score.toFixed(2) + ": " + renderedComposition.realizedScenes + "/" + renderedComposition.expectedScenes + " scene geometries realized, minimum adjacent geometry distance " + renderedComposition.minimumAdjacentDistance.toFixed(2) + ", repeated adjacent pairs " + renderedComposition.repeatedAdjacentPairs + ". This measures DOM geometry, not beauty." }] : [])
    ];
    parent.postMessage({ source: "verve-render-gate", probeId: PROBE_ID, sequence: ++sequence, viewport: { width, height: window.innerHeight, documentWidth }, surface, checks, fingerprint, firstViewport, functionalVisual, renderedEvidence, renderedComposition }, "*");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
  window.addEventListener("popstate", schedule);
  window.addEventListener("hashchange", schedule);
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
export function instrumentSandboxFiles(
  project: GeneratedProject,
  probeId: string,
  projectSpec?: VerveProjectSpec,
  context?: RenderProbeContext
): SandboxFileMap {
  const files: SandboxFileMap = Object.fromEntries(
    project.files
      .filter((item) => item.encoding !== "base64")
      .map((item) => [`/${item.path}`, { code: replaceOwnedAssetReferences(item.content, project.files) }])
  );
  if (project.framework === "html" && files["/index.html"]) {
    files["/index.html"] = { code: injectHtmlProbe(files["/index.html"].code) };
    files[PROBE_FILE] = { code: createRenderProbeSource(probeId, projectSpec, context) };
  }
  if (project.framework === "react" && files["/src/main.tsx"]) {
    files["/src/main.tsx"] = { code: injectReactProbe(files["/src/main.tsx"].code) };
    files[REACT_PROBE_FILE] = { code: createRenderProbeSource(probeId, projectSpec, context) };
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
    && (report.fingerprint?.schemaVersion === undefined || report.fingerprint.schemaVersion === 2)
    && (report.fingerprint?.schemaVersion !== 2 || (
      Array.isArray(report.fingerprint.colorAreaHistogram)
      && Array.isArray(report.fingerprint.fontHistogram)
      && Array.isArray(report.fingerprint.visualLayerHistogram)
      && boundedUnit(report.fingerprint.statefulControlDensity)
      && boundedUnit(report.fingerprint.depthDensity)
      && boundedUnit(report.fingerprint.alignmentDiversity)
    ))
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
    && (!report.fingerprint.colorAreaHistogram || (
      Array.isArray(report.fingerprint.colorAreaHistogram)
      && report.fingerprint.colorAreaHistogram.length <= 8
      && report.fingerprint.colorAreaHistogram.every((entry) => entry && typeof entry.color === "string" && entry.color.length <= 80 && boundedUnit(entry.weight))
    ))
    && (!report.fingerprint.fontHistogram || (
      Array.isArray(report.fingerprint.fontHistogram)
      && report.fingerprint.fontHistogram.length <= 8
      && report.fingerprint.fontHistogram.every((entry) => entry && typeof entry.family === "string" && entry.family.length <= 80 && boundedUnit(entry.weight))
    ))
    && (!report.fingerprint.visualLayerHistogram || (
      Array.isArray(report.fingerprint.visualLayerHistogram)
      && report.fingerprint.visualLayerHistogram.length <= 6
      && report.fingerprint.visualLayerHistogram.every((entry) => entry && ["type", "media", "data", "shape", "motion", "interaction"].includes(entry.layer) && boundedUnit(entry.weight))
    ))
    && (report.fingerprint.statefulControlDensity === undefined || boundedUnit(report.fingerprint.statefulControlDensity))
    && (report.fingerprint.depthDensity === undefined || boundedUnit(report.fingerprint.depthDensity))
    && (report.fingerprint.alignmentDiversity === undefined || boundedUnit(report.fingerprint.alignmentDiversity))
    && (!report.surface || (
      /^surface-[a-z0-9]+$/.test(report.surface.routeKey)
      && /^surface-[a-z0-9]+$/.test(report.surface.stateKey)
      && Number.isInteger(report.surface.activeStateCount)
      && report.surface.activeStateCount >= 0
      && report.surface.activeStateCount <= 500
      && Number.isInteger(report.surface.expectedStateCount)
      && report.surface.expectedStateCount >= 1
      && report.surface.expectedStateCount <= 500
    ))
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
    && (!report.functionalVisual || (
      boundedUnit(report.functionalVisual.score)
      && Number.isInteger(report.functionalVisual.expectedScenes)
      && report.functionalVisual.expectedScenes >= 1
      && report.functionalVisual.expectedScenes <= 40
      && Number.isInteger(report.functionalVisual.renderedScenes)
      && report.functionalVisual.renderedScenes >= 0
      && report.functionalVisual.renderedScenes <= report.functionalVisual.expectedScenes
      && Number.isInteger(report.functionalVisual.fulfilledScenes)
      && report.functionalVisual.fulfilledScenes >= 0
      && report.functionalVisual.fulfilledScenes <= report.functionalVisual.expectedScenes
      && Array.isArray(report.functionalVisual.requiredLayers)
      && report.functionalVisual.requiredLayers.every((layer) => ["type", "media", "data", "shape", "motion", "interaction"].includes(layer))
      && Array.isArray(report.functionalVisual.observedLayers)
      && report.functionalVisual.observedLayers.every((layer) => ["type", "media", "data", "shape", "motion", "interaction"].includes(layer))
      && Array.isArray(report.functionalVisual.missingLayers)
      && report.functionalVisual.missingLayers.every((layer) => ["type", "media", "data", "shape", "motion", "interaction"].includes(layer))
      && boundedUnit(report.functionalVisual.orphanVisualRatio)
      && Array.isArray(report.functionalVisual.missingAssetSceneIds)
      && report.functionalVisual.missingAssetSceneIds.length <= 40
      && report.functionalVisual.missingAssetSceneIds.every((sceneId) => typeof sceneId === "string" && sceneId.length <= 160)
    ))
    && (!report.renderedEvidence || (
      boundedUnit(report.renderedEvidence.score)
      && boundedUnit(report.renderedEvidence.coverage)
      && boundedUnit(report.renderedEvidence.prominence)
      && boundedUnit(report.renderedEvidence.firstViewportCoverage)
      && Number.isInteger(report.renderedEvidence.expected)
      && report.renderedEvidence.expected >= 1
      && report.renderedEvidence.expected <= 64
      && Number.isInteger(report.renderedEvidence.observed)
      && report.renderedEvidence.observed >= 0
      && report.renderedEvidence.observed <= report.renderedEvidence.expected
      && Number.isInteger(report.renderedEvidence.prominent)
      && report.renderedEvidence.prominent >= 0
      && report.renderedEvidence.prominent <= report.renderedEvidence.observed
      && Array.isArray(report.renderedEvidence.missingEvidenceKeys)
      && report.renderedEvidence.missingEvidenceKeys.length <= 64
      && report.renderedEvidence.missingEvidenceKeys.every((key) => /^surface-[a-z0-9]+$/.test(key))
      && Array.isArray(report.renderedEvidence.missingCriticalKeys)
      && report.renderedEvidence.missingCriticalKeys.length <= 64
      && report.renderedEvidence.missingCriticalKeys.every((key) => /^surface-[a-z0-9]+$/.test(key))
      && report.renderedEvidence.privacy === "numeric-and-hashed-evidence-only"
    ))
    && (!report.renderedComposition || (
      boundedUnit(report.renderedComposition.score)
      && Number.isInteger(report.renderedComposition.expectedScenes)
      && report.renderedComposition.expectedScenes >= 1
      && report.renderedComposition.expectedScenes <= 40
      && Number.isInteger(report.renderedComposition.observedScenes)
      && report.renderedComposition.observedScenes >= 0
      && report.renderedComposition.observedScenes <= report.renderedComposition.expectedScenes
      && Number.isInteger(report.renderedComposition.realizedScenes)
      && report.renderedComposition.realizedScenes >= 0
      && report.renderedComposition.realizedScenes <= report.renderedComposition.observedScenes
      && boundedUnit(report.renderedComposition.minimumAdjacentDistance)
      && Number.isInteger(report.renderedComposition.repeatedAdjacentPairs)
      && report.renderedComposition.repeatedAdjacentPairs >= 0
      && report.renderedComposition.repeatedAdjacentPairs < report.renderedComposition.expectedScenes
      && Array.isArray(report.renderedComposition.scenes)
      && report.renderedComposition.scenes.length === report.renderedComposition.observedScenes
      && new Set(report.renderedComposition.scenes.map((scene) => scene.sceneKey)).size === report.renderedComposition.scenes.length
      && report.renderedComposition.scenes.every((scene) => scene
        && /^surface-[a-z0-9]+$/.test(scene.sceneKey)
        && ["single-object-stage", "split-stage", "rail-canvas", "layered-field", "modular-matrix", "radial-map", "editorial-spine", "mosaic-browser"].includes(scene.structure)
        && ["single-column-reorder", "focus-and-drawer", "stacked-overlap-preserved", "pan-and-focus", "sequenced-cards"].includes(scene.mobileTransform)
        && typeof scene.markerMatch === "boolean"
        && boundedUnit(scene.score)
        && scene.geometry
        && Number.isInteger(scene.geometry.itemCount)
        && scene.geometry.itemCount >= 0
        && scene.geometry.itemCount <= 16
        && Number.isInteger(scene.geometry.columnBands)
        && scene.geometry.columnBands >= 0
        && scene.geometry.columnBands <= 4
        && Number.isInteger(scene.geometry.rowBands)
        && scene.geometry.rowBands >= 0
        && scene.geometry.rowBands <= 4
        && Number.isInteger(scene.geometry.mediaFragments)
        && scene.geometry.mediaFragments >= 0
        && scene.geometry.mediaFragments <= 80
        && [scene.geometry.horizontalSpread, scene.geometry.verticalSpread, scene.geometry.overlapRatio, scene.geometry.boundaryCrossing, scene.geometry.dominance, scene.geometry.depthDensity, scene.geometry.edgeBias, scene.geometry.sizeVariation, scene.geometry.angularCoverage, scene.geometry.alignmentConcentration, scene.geometry.occupiedArea, scene.geometry.mediaCoverage].every(boundedUnit)
        && typeof scene.geometry.internalPan === "boolean")
      && Array.isArray(report.renderedComposition.missingSceneKeys)
      && report.renderedComposition.missingSceneKeys.length <= 40
      && report.renderedComposition.missingSceneKeys.every((key) => /^surface-[a-z0-9]+$/.test(key))
      && Array.isArray(report.renderedComposition.weakSceneKeys)
      && report.renderedComposition.weakSceneKeys.length <= 40
      && report.renderedComposition.weakSceneKeys.every((key) => /^surface-[a-z0-9]+$/.test(key))
      && report.renderedComposition.privacy === "numeric-and-hashed-composition-only"
    ))
    && report.checks.length <= 12
    && report.checks.every((item) => item
      && ["horizontal-overflow", "runtime-errors", "tiny-text", "image-alt", "duplicate-ids", "button-names", "first-viewport-effectiveness", "functional-visual-fulfillment", "rendered-evidence-salience", "rendered-composition-realization"].includes(item.id)
      && ["pass", "warning", "fail"].includes(item.status)
      && typeof item.title === "string"
      && item.title.length <= 120
      && typeof item.message === "string"
      && item.message.length <= 2_000);
}
