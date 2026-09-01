import type { VerveProjectSpec, VisualLayer } from "../domain/project-spec";
import {
  RENDER_EVIDENCE_WIDTHS,
  type RenderEvidenceWidth,
  type RenderGateReport,
} from "./render-gate";

export const VISUAL_TRUTH_VERSION = 1 as const;

export type VisualTruthRouteExpectation = {
  routeKey: string;
  expectedStateCount: number;
};

export type VisualTruthContract = {
  version: typeof VISUAL_TRUTH_VERSION;
  routes: VisualTruthRouteExpectation[];
  requiredLayers: VisualLayer[];
  expectedFontFamilies: string[];
};

export type VisualTruthMatrix = {
  contract: VisualTruthContract;
  reports: Record<string, RenderGateReport>;
  coveredRoutes: number;
  coveredRouteViewports: number;
  coveredStates: number;
  expectedRoutes: number;
  expectedRouteViewports: number;
  expectedStates: number;
  failures: number;
  warnings: number;
  complete: boolean;
  status: "waiting" | "collecting" | "pass" | "review" | "fail";
  score: number;
};

export type DirectionFidelityAxis = {
  score: number;
  weight: number;
  observed: number;
  expected: number;
};

export type DirectionRealizationReport = {
  version: typeof VISUAL_TRUTH_VERSION;
  fidelity: number;
  status: "pass" | "review" | "fail";
  axes: {
    routes: DirectionFidelityAxis;
    responsive: DirectionFidelityAxis;
    states: DirectionFidelityAxis;
    scenes: DirectionFidelityAxis;
    layers: DirectionFidelityAxis;
    typography: DirectionFidelityAxis;
  };
  unverified: string[];
  privacy: "numeric-and-hashed-render-evidence-only";
};

export function privacySafeSurfaceKey(value: string): string {
  const source = value || "root";
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `surface-${(hash >>> 0).toString(36)}`;
}

function normalizeFontFamily(value: string): string {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+(variable|vf)$/i, "")
    .trim();
}

export function createVisualTruthContract(spec?: VerveProjectSpec): VisualTruthContract {
  if (!spec) {
    return {
      version: VISUAL_TRUTH_VERSION,
      routes: [{ routeKey: privacySafeSurfaceKey("root"), expectedStateCount: 1 }],
      requiredLayers: ["type", "interaction"],
      expectedFontFamilies: [],
    };
  }

  const routes = spec.experience.routes.map((route) => {
    const componentIds = new Set(spec.components
      .filter((component) => component.routeId === route.id)
      .map((component) => component.id));
    const expectedStateCount = Math.max(1, spec.interactions
      .filter((interaction) => componentIds.has(interaction.componentId))
      .reduce((total, interaction) => total + Math.max(1, interaction.states.length), 0));
    return { routeKey: privacySafeSurfaceKey(route.id), expectedStateCount };
  });
  const assignments = spec.typographyContract
    ? [spec.typographyContract.display, spec.typographyContract.body, spec.typographyContract.mono].filter(Boolean)
    : [];

  return {
    version: VISUAL_TRUTH_VERSION,
    routes,
    requiredLayers: [...new Set(spec.narrative.richness.requiredLayers)],
    expectedFontFamilies: [...new Set(assignments.map((assignment) => normalizeFontFamily(assignment!.family)))],
  };
}

export function createVisualTruthMatrix(spec?: VerveProjectSpec): VisualTruthMatrix {
  return summarizeMatrix(createVisualTruthContract(spec), {});
}

function evidenceWidth(width: number): RenderEvidenceWidth | undefined {
  return RENDER_EVIDENCE_WIDTHS.find((candidate) => Math.abs(candidate - width) <= 2);
}

function summarizeMatrix(
  contract: VisualTruthContract,
  reports: Record<string, RenderGateReport>
): VisualTruthMatrix {
  const captured = Object.values(reports);
  const expectedRouteKeys = new Set(contract.routes.map((route) => route.routeKey));
  const coveredRouteKeys = new Set(captured
    .map((report) => report.surface?.routeKey)
    .filter((key): key is string => Boolean(key && expectedRouteKeys.has(key))));
  const routeViewportKeys = new Set(captured.flatMap((report) => {
    const routeKey = report.surface?.routeKey;
    const width = evidenceWidth(report.viewport.width);
    return routeKey && width && expectedRouteKeys.has(routeKey) ? [`${routeKey}:${width}`] : [];
  }));
  const stateKeys = new Set(captured.flatMap((report) => {
    const routeKey = report.surface?.routeKey;
    const stateKey = report.surface?.stateKey;
    return routeKey && stateKey && expectedRouteKeys.has(routeKey) ? [`${routeKey}:${stateKey}`] : [];
  }));
  const checks = captured.flatMap((report) => report.checks);
  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  const expectedRoutes = contract.routes.length;
  const expectedRouteViewports = expectedRoutes * RENDER_EVIDENCE_WIDTHS.length;
  const expectedStates = contract.routes.reduce((total, route) => total + route.expectedStateCount, 0);
  const complete = coveredRouteKeys.size === expectedRoutes
    && routeViewportKeys.size === expectedRouteViewports
    && stateKeys.size >= expectedStates;
  const coverageScore = (
    coveredRouteKeys.size / Math.max(1, expectedRoutes) * 0.35
    + routeViewportKeys.size / Math.max(1, expectedRouteViewports) * 0.4
    + Math.min(1, stateKeys.size / Math.max(1, expectedStates)) * 0.25
  );
  const status = failures > 0
    ? "fail"
    : complete && warnings === 0
      ? "pass"
      : complete
        ? "review"
        : captured.length
          ? "collecting"
          : "waiting";

  return {
    contract,
    reports,
    coveredRoutes: coveredRouteKeys.size,
    coveredRouteViewports: routeViewportKeys.size,
    coveredStates: stateKeys.size,
    expectedRoutes,
    expectedRouteViewports,
    expectedStates,
    failures,
    warnings,
    complete,
    status,
    score: Math.max(0, Math.round(coverageScore * 100 - failures * 25 - warnings * 5)),
  };
}

export function recordVisualTruth(matrix: VisualTruthMatrix, report: RenderGateReport): VisualTruthMatrix {
  const width = evidenceWidth(report.viewport.width);
  if (!width) return matrix;
  const fallbackRoute = matrix.contract.routes[0]?.routeKey ?? privacySafeSurfaceKey("root");
  const routeKey = report.surface?.routeKey ?? fallbackRoute;
  const stateKey = report.surface?.stateKey ?? privacySafeSurfaceKey("default");
  const key = `${routeKey}:${stateKey}:${width}`;
  const previous = matrix.reports[key];
  if (previous && previous.sequence > report.sequence) return matrix;
  return summarizeMatrix(matrix.contract, { ...matrix.reports, [key]: report });
}

function axis(score: number, weight: number, observed: number, expected: number): DirectionFidelityAxis {
  return {
    score: Number(Math.max(0, Math.min(1, score)).toFixed(3)),
    weight,
    observed,
    expected,
  };
}

export function buildDirectionRealizationReport(
  spec: VerveProjectSpec,
  matrix: VisualTruthMatrix
): DirectionRealizationReport {
  const reports = Object.values(matrix.reports);
  const sceneEvidenceByRoute = matrix.contract.routes.map((route) => {
    const evidence = reports
      .filter((report) => report.surface?.routeKey === route.routeKey)
      .flatMap((report) => report.functionalVisual ? [report.functionalVisual] : []);
    const declaredScenes = spec.narrative.scenes
      .filter((scene) => privacySafeSurfaceKey(scene.routeId) === route.routeKey)
      .length;
    return {
      observed: evidence.length
        ? Math.min(...evidence.map((item) => item.fulfilledScenes))
        : 0,
      expected: evidence.length
        ? Math.max(...evidence.map((item) => item.expectedScenes))
        : Math.max(1, declaredScenes),
      score: evidence.length
        ? Math.min(...evidence.map((item) => item.score))
        : 0,
    };
  });
  const sceneObserved = sceneEvidenceByRoute.reduce((total, evidence) => total + evidence.observed, 0);
  const sceneExpected = sceneEvidenceByRoute.reduce((total, evidence) => total + evidence.expected, 0);
  const sceneScore = sceneEvidenceByRoute.length
    ? Math.min(...sceneEvidenceByRoute.map((evidence) => evidence.score))
    : 0;
  const observedLayers = new Set<VisualLayer>();
  for (const report of reports) {
    report.functionalVisual?.observedLayers.forEach((layer) => observedLayers.add(layer));
    report.fingerprint.visualLayerHistogram?.forEach((entry) => {
      if (entry.weight > 0.005) observedLayers.add(entry.layer);
    });
  }
  const requiredLayers = matrix.contract.requiredLayers;
  const observedFonts = new Set(reports.flatMap((report) => report.fingerprint.fontHistogram ?? [])
    .map((entry) => normalizeFontFamily(entry.family)));
  const expectedFonts = matrix.contract.expectedFontFamilies;
  const matchedFonts = expectedFonts.filter((family) => observedFonts.has(family)).length;

  const axes = {
    routes: axis(matrix.coveredRoutes / Math.max(1, matrix.expectedRoutes), 0.2, matrix.coveredRoutes, matrix.expectedRoutes),
    responsive: axis(matrix.coveredRouteViewports / Math.max(1, matrix.expectedRouteViewports), 0.15, matrix.coveredRouteViewports, matrix.expectedRouteViewports),
    states: axis(matrix.coveredStates / Math.max(1, matrix.expectedStates), 0.15, matrix.coveredStates, matrix.expectedStates),
    scenes: axis(sceneScore, 0.2, sceneObserved, sceneExpected),
    layers: axis(requiredLayers.filter((layer) => observedLayers.has(layer)).length / Math.max(1, requiredLayers.length), 0.15, requiredLayers.filter((layer) => observedLayers.has(layer)).length, requiredLayers.length),
    typography: axis(expectedFonts.length ? matchedFonts / expectedFonts.length : 1, 0.15, matchedFonts, expectedFonts.length),
  };
  const fidelity = Number(Object.values(axes)
    .reduce((total, item) => total + item.score * item.weight, 0)
    .toFixed(3));
  const unverified: string[] = [];
  if (axes.routes.score < 1) unverified.push(`${matrix.expectedRoutes - matrix.coveredRoutes} route(s) have no render evidence.`);
  if (axes.responsive.score < 1) unverified.push(`${matrix.expectedRouteViewports - matrix.coveredRouteViewports} route/viewport surface(s) are missing.`);
  if (axes.states.score < 1) unverified.push(`${Math.max(0, matrix.expectedStates - matrix.coveredStates)} declared state(s) were not exercised.`);
  if (axes.scenes.score < 0.72) unverified.push("Functional scene fulfillment is below the release threshold.");
  if (axes.layers.score < 1) unverified.push("One or more required visual layers were not observed.");
  if (axes.typography.score < 1) unverified.push("The bundled typography contract was not fully observed in the render.");
  const status = matrix.failures > 0 || fidelity < 0.5
    ? "fail"
    : matrix.complete && fidelity >= 0.85 && unverified.length === 0
      ? "pass"
      : "review";

  return {
    version: VISUAL_TRUTH_VERSION,
    fidelity,
    status,
    axes,
    unverified,
    privacy: "numeric-and-hashed-render-evidence-only",
  };
}
