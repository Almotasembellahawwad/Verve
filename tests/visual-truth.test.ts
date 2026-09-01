import test from "node:test";
import assert from "node:assert/strict";
import type { VerveProjectSpec, VisualLayer } from "../lib/domain/project-spec";
import {
  isRenderGateReport,
  visualFingerprintDistance,
  type RenderGateReport,
  type VisualFingerprint,
} from "../lib/project/render-gate";
import {
  buildDirectionRealizationReport,
  createVisualTruthMatrix,
  privacySafeSurfaceKey,
  recordVisualTruth,
} from "../lib/project/visual-truth";

const layers: VisualLayer[] = ["type", "shape", "interaction"];

const spec = {
  experience: {
    routes: [
      { id: "catalog", path: "/", purpose: "Compare", regionIds: ["opening", "proof"] },
      { id: "order", path: "/order", purpose: "Order", regionIds: ["choice", "payoff"] },
    ],
  },
  components: [
    { id: "filters", routeId: "catalog" },
    { id: "order-form", routeId: "order" },
  ],
  interactions: [
    { componentId: "filters", states: [{ id: "all" }, { id: "paper" }] },
    { componentId: "order-form", states: [{ id: "ready" }] },
  ],
  narrative: {
    scenes: [{ id: "opening" }, { id: "proof" }],
    richness: { requiredLayers: layers },
  },
  typographyContract: {
    display: { family: "Fraunces Variable" },
    body: { family: "Manrope Variable" },
  },
} as unknown as VerveProjectSpec;

function fingerprint(overrides: Partial<VisualFingerprint> = {}): VisualFingerprint {
  return {
    schemaVersion: 2,
    occupancyGrid: Array(144).fill(0.2),
    typographyScale: [0, 0.1, 0.4, 0.3, 0.2, 0],
    colorHistogram: [{ color: "rgb(20, 20, 20)", weight: 1 }],
    colorAreaHistogram: [{ color: "rgb(245, 80, 40)", weight: 1 }],
    fontHistogram: [
      { family: "Fraunces Variable", weight: 0.4 },
      { family: "Manrope Variable", weight: 0.6 },
    ],
    visualLayerHistogram: layers.map((layer) => ({ layer, weight: Number((1 / layers.length).toFixed(3)) })),
    mediaCoverage: 0.2,
    interactionDensity: 0.18,
    statefulControlDensity: 0.5,
    roundedness: 0.1,
    depthDensity: 0.2,
    alignmentDiversity: 0.7,
    sectionRhythm: [0.8, 1.1],
    routeCount: 2,
    ...overrides,
  };
}

function report(route: string, state: string, width: 360 | 768 | 1440, sequence: number): RenderGateReport {
  return {
    source: "verve-render-gate",
    probeId: "truth",
    sequence,
    viewport: { width, height: 900, documentWidth: width },
    surface: {
      routeKey: privacySafeSurfaceKey(route),
      stateKey: privacySafeSurfaceKey(state),
      activeStateCount: state === "default" ? 0 : 1,
      expectedStateCount: route === "catalog" ? 2 : 1,
    },
    checks: [{ id: "horizontal-overflow", title: "Responsive width", status: "pass", message: "Measured" }],
    fingerprint: fingerprint(),
    functionalVisual: {
      score: 0.9,
      expectedScenes: 2,
      renderedScenes: 2,
      fulfilledScenes: 2,
      requiredLayers: layers,
      observedLayers: layers,
      missingLayers: [],
      orphanVisualRatio: 0.05,
      missingAssetSceneIds: [],
    },
  };
}

test("Visual Truth stays incomplete until every route, viewport, and declared state is rendered", () => {
  let matrix = createVisualTruthMatrix(spec);
  matrix = recordVisualTruth(matrix, report("catalog", "all", 360, 1));
  matrix = recordVisualTruth(matrix, report("catalog", "paper", 768, 2));
  matrix = recordVisualTruth(matrix, report("catalog", "all", 1440, 3));
  assert.equal(matrix.coveredRoutes, 1);
  assert.equal(matrix.coveredStates, 2);
  assert.equal(matrix.complete, false);

  matrix = recordVisualTruth(matrix, report("order", "default", 360, 4));
  matrix = recordVisualTruth(matrix, report("order", "default", 768, 5));
  matrix = recordVisualTruth(matrix, report("order", "default", 1440, 6));
  assert.equal(matrix.coveredRoutes, 2);
  assert.equal(matrix.coveredRouteViewports, 6);
  assert.equal(matrix.coveredStates, 3);
  assert.equal(matrix.complete, true);
  assert.equal(matrix.status, "pass");

  const realization = buildDirectionRealizationReport(spec, matrix);
  assert.equal(realization.status, "pass");
  assert.equal(realization.fidelity, 0.984);
  assert.deepEqual(realization.unverified, []);
  assert.equal(realization.privacy, "numeric-and-hashed-render-evidence-only");
});

test("Direction Fidelity reports missing surfaces instead of rewarding a polished single viewport", () => {
  let matrix = createVisualTruthMatrix(spec);
  matrix = recordVisualTruth(matrix, report("catalog", "all", 1440, 1));
  const realization = buildDirectionRealizationReport(spec, matrix);
  assert.notEqual(realization.status, "pass");
  assert.ok(realization.fidelity < 0.7);
  assert.ok(realization.unverified.some((message) => message.includes("route")));
  assert.ok(realization.unverified.some((message) => message.includes("state")));
});

test("Direction Fidelity requires measured desktop-to-mobile Composition Genome realization", () => {
  const compositionSpec = structuredClone(spec);
  compositionSpec.narrative.compositionGenome = {
    assignments: [
      { sceneId: "opening", mobileTransform: "single-column-reorder" },
      { sceneId: "choice", mobileTransform: "focus-and-drawer" },
    ],
  } as VerveProjectSpec["narrative"]["compositionGenome"];
  const geometry = (columns: number, rows: number, horizontalSpread: number, verticalSpread: number) => ({
    itemCount: 4, columnBands: columns, rowBands: rows, horizontalSpread, verticalSpread,
    overlapRatio: 0, boundaryCrossing: 0, dominance: 0.35, depthDensity: 0.2,
    edgeBias: 0.4, sizeVariation: 0.35, angularCoverage: 0.75,
    alignmentConcentration: 0.5, occupiedArea: 0.7, mediaCoverage: 0.25,
    mediaFragments: 2, internalPan: false,
  });
  const withComposition = (base: RenderGateReport, mobile: boolean, weak = false): RenderGateReport => ({
    ...base,
    renderedComposition: {
      score: 0.85,
      expectedScenes: 1,
      observedScenes: 1,
      realizedScenes: 1,
      minimumAdjacentDistance: 1,
      repeatedAdjacentPairs: 0,
      scenes: [{
        sceneKey: base.surface?.routeKey === privacySafeSurfaceKey("catalog") ? "surface-opening" : "surface-choice",
        structure: base.surface?.routeKey === privacySafeSurfaceKey("catalog") ? "split-stage" : "modular-matrix",
        mobileTransform: base.surface?.routeKey === privacySafeSurfaceKey("catalog") ? "single-column-reorder" : "focus-and-drawer",
        markerMatch: true,
        score: 0.85,
        geometry: weak || !mobile ? geometry(3, 1, 0.7, 0.1) : geometry(1, 3, 0.1, 0.7),
      }],
      missingSceneKeys: [],
      weakSceneKeys: [],
      privacy: "numeric-and-hashed-composition-only",
    },
  });
  const buildMatrix = (weak: boolean) => {
    let matrix = createVisualTruthMatrix(compositionSpec);
    matrix = recordVisualTruth(matrix, withComposition(report("catalog", "all", 360, 1), true, weak));
    matrix = recordVisualTruth(matrix, withComposition(report("catalog", "paper", 768, 2), false, weak));
    matrix = recordVisualTruth(matrix, withComposition(report("catalog", "all", 1440, 3), false, weak));
    matrix = recordVisualTruth(matrix, withComposition(report("order", "default", 360, 4), true, weak));
    matrix = recordVisualTruth(matrix, withComposition(report("order", "default", 768, 5), false, weak));
    matrix = recordVisualTruth(matrix, withComposition(report("order", "default", 1440, 6), false, weak));
    return matrix;
  };

  const realized = buildDirectionRealizationReport(compositionSpec, buildMatrix(false));
  assert.ok(realized.axes.composition.score >= 0.9);
  assert.equal(realized.status, "pass");
  const unchanged = buildDirectionRealizationReport(compositionSpec, buildMatrix(true));
  assert.ok(unchanged.axes.composition.score < 0.6);
  assert.equal(unchanged.status, "review");
  assert.ok(unchanged.unverified.some((message) => message.includes("Composition Genome")));
});

test("Visual Fingerprint v2 detects font, area-color, and functional-layer differences", () => {
  const left = fingerprint();
  const right = fingerprint({
    colorAreaHistogram: [{ color: "rgb(15, 40, 180)", weight: 1 }],
    fontHistogram: [{ family: "System UI", weight: 1 }],
    visualLayerHistogram: [{ layer: "type", weight: 1 }],
    depthDensity: 0.9,
  });
  assert.equal(visualFingerprintDistance(left, left), 0);
  assert.ok(visualFingerprintDistance(left, right) >= 0.25);
});

test("Render Gate validates v2 evidence without exposing raw route or state names", () => {
  const measured = report("private-order-route", "wholesale-approved", 1440, 1);
  assert.equal(isRenderGateReport(measured, "truth"), true);
  assert.equal(isRenderGateReport({ ...measured, fingerprint: { ...measured.fingerprint, fontHistogram: undefined } }, "truth"), false);
  const serialized = JSON.stringify(measured.surface);
  assert.doesNotMatch(serialized, /private-order-route|wholesale-approved/);
  assert.match(measured.surface!.routeKey, /^surface-[a-z0-9]+$/);
});
