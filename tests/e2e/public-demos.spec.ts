import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PUBLIC_DEMOS } from "../../lib/demo/public-demo-gallery";
import visualTruthBaseline from "../../data/public-demo-visual-truth.json";
import { buildHtmlPreviewDocument } from "../../lib/project/html-preview";
import {
  createRenderProbeSource,
  isRenderGateReport,
  visualFingerprintDistance,
  type RenderGateReport,
} from "../../lib/project/render-gate";
import type { VerveProjectSpec } from "../../lib/domain/project-spec";
import { privacySafeSurfaceKey } from "../../lib/project/visual-truth";

const VIEWPORTS = [360, 768, 1440] as const;

test("all six frozen examples pass the three-width render contract", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser is sufficient for the fixed 18-render matrix.");
  const runtimeErrors: string[] = [];
  const measured: Array<{ demoId: string; width: number; report: RenderGateReport }> = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  for (const demo of PUBLIC_DEMOS) {
    for (const width of VIEWPORTS) {
      runtimeErrors.length = 0;
      const probeId = `e2e-${demo.id}-${width}`;
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await page.goto("about:blank");
      const preview = buildHtmlPreviewDocument(demo.result.project, probeId);
      const capture = `<script>window.__verveMeasuredReport=null;window.addEventListener("message",function(event){if(event.data&&event.data.source==="verve-render-gate")window.__verveMeasuredReport=event.data});</script>`;
      await page.setContent(preview.replace(/<head([^>]*)>/i, `<head$1>${capture}`), { waitUntil: "load" });
      await page.waitForFunction(
        (activeProbeId) => (window as unknown as { __verveMeasuredReport?: { probeId?: string } }).__verveMeasuredReport?.probeId === activeProbeId,
        probeId
      );
      const renderReport = await page.evaluate(() => (window as unknown as { __verveMeasuredReport?: unknown }).__verveMeasuredReport);
      expect(isRenderGateReport(renderReport, probeId), `${demo.id} emitted invalid render evidence at ${width}px: ${JSON.stringify(renderReport)}`).toBe(true);
      measured.push({ demoId: demo.id, width, report: renderReport as RenderGateReport });
      const audit = await page.evaluate(() => {
        const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        const unnamedButtons = [...document.querySelectorAll<HTMLButtonElement>("button")]
          .filter((button) => !(button.textContent ?? "").trim() && !button.getAttribute("aria-label") && !button.title)
          .length;
        const inFirstViewport = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" && rect.bottom > 0 && rect.top < window.innerHeight;
        };
        const taskSignals = new Set([...document.querySelectorAll<HTMLElement>("[data-verve-task]")]
          .filter(inFirstViewport)
          .map((element) => element.dataset.verveTask));
        const primaryActionVisible = [...document.querySelectorAll<HTMLElement>("[data-verve-primary-action]")]
          .some(inFirstViewport);
        return {
          viewport: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          missingAlt: document.querySelectorAll("img:not([alt])").length,
          unnamedButtons,
          duplicates: [...new Set(duplicates)],
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          taskSignalCount: taskSignals.size,
          primaryActionVisible,
        };
      });
      expect(audit.documentWidth, `${demo.id} overflows at ${width}px`).toBeLessThanOrEqual(audit.viewport + 1);
      expect(audit.missingAlt, `${demo.id} has an image without alt text`).toBe(0);
      expect(audit.unnamedButtons, `${demo.id} has an unnamed button`).toBe(0);
      expect(audit.duplicates, `${demo.id} has duplicate element ids`).toEqual([]);
      expect(audit.lang, `${demo.id} has no document language`).not.toBe("");
      if (demo.id === "cairo") expect(audit.dir).toBe("rtl");
      expect(audit.taskSignalCount, `${demo.id} lacks first-viewport task evidence at ${width}px`).toBeGreaterThanOrEqual(2);
      expect(audit.primaryActionVisible, `${demo.id} postpones its primary action at ${width}px`).toBe(true);
      expect(runtimeErrors, `${demo.id} raised a runtime error at ${width}px`).toEqual([]);
      const fingerprint = (renderReport as RenderGateReport).fingerprint;
      expect(fingerprint.schemaVersion, `${demo.id} did not emit Visual Fingerprint v2`).toBe(2);
      expect(fingerprint.fontHistogram?.length, `${demo.id} has no measured typography evidence`).toBeGreaterThan(0);
      expect(fingerprint.colorAreaHistogram?.length, `${demo.id} has no area-weighted color evidence`).toBeGreaterThan(0);
      expect(fingerprint.visualLayerHistogram?.length, `${demo.id} has no functional-layer evidence`).toBeGreaterThanOrEqual(2);
    }
  }

  const desktop = measured.filter((entry) => entry.width === 1440);
  const receipt = desktop.map((entry) => {
    const peers = desktop.filter((candidate) => candidate.demoId !== entry.demoId);
    const nearestDistance = Math.min(...peers.map((candidate) => visualFingerprintDistance(entry.report.fingerprint, candidate.report.fingerprint)));
    const allViewports = measured.filter((candidate) => candidate.demoId === entry.demoId);
    return {
      demoId: entry.demoId,
      fingerprintVersion: entry.report.fingerprint.schemaVersion,
      verifiedViewports: allViewports.map((candidate) => candidate.width),
      failures: allViewports.flatMap((candidate) => candidate.report.checks).filter((check) => check.status === "fail").length,
      warnings: allViewports.flatMap((candidate) => candidate.report.checks).filter((check) => check.status === "warning").length,
      warningChecks: [...new Set(allViewports.flatMap((candidate) => candidate.report.checks
        .filter((check) => check.status === "warning")
        .map((check) => `${check.id}@${candidate.width}`)))],
      nearestMeasuredExampleDistance: nearestDistance,
      desktopFingerprint: entry.report.fingerprint,
    };
  });
  const visualTruthReceipt = { version: 1, generatedBy: "playwright-render-gate-v2", examples: receipt };
  const artifactDirectory = resolve(process.cwd(), "test-results");
  const artifactPath = resolve(artifactDirectory, "public-demo-visual-truth.json");
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(visualTruthReceipt, null, 2)}\n`, "utf8");
  await testInfo.attach("visual-truth-receipts.json", {
    body: Buffer.from(JSON.stringify(visualTruthReceipt, null, 2)),
    contentType: "application/json",
  });
  expect(receipt).toHaveLength(6);
  for (const example of receipt) {
    const baseline = visualTruthBaseline.examples[example.demoId as keyof typeof visualTruthBaseline.examples];
    expect(
      Math.abs(example.nearestMeasuredExampleDistance - baseline.nearestMeasuredExampleDistance),
      `${example.demoId} visual distance drifted beyond the cross-platform tolerance`
    ).toBeLessThanOrEqual(visualTruthBaseline.crossPlatformDistanceTolerance);
    expect(
      example.nearestMeasuredExampleDistance >= visualTruthBaseline.releaseDistanceThreshold,
      `${example.demoId} crossed the published diversity release threshold`
    ).toBe(baseline.nearestMeasuredExampleDistance >= visualTruthBaseline.releaseDistanceThreshold);
    expect(example.failures, `${example.demoId} render failures drifted from its published receipt`).toBe(baseline.failures);
    expect(example.warnings, `${example.demoId} render warnings drifted from its published receipt`).toBe(baseline.warnings);
    expect(example.desktopFingerprint.fontHistogram?.map((entry) => entry.family), `${example.demoId} font evidence drifted`).toEqual(baseline.fontFamilies);
    expect(example.desktopFingerprint.visualLayerHistogram?.map((entry) => entry.layer), `${example.demoId} layer evidence drifted`).toEqual(baseline.observedLayers);
  }
});

test("Visual Truth follows SPA route and interaction-state changes without exposing their names", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser is sufficient for route/state identity evidence.");
  const probeId = "route-state-truth";
  const routeSpec = {
    experience: {
      route: "/",
      routes: [
        { id: "catalog", path: "/", regionIds: [] },
        { id: "private-order", path: "/order", regionIds: [] },
      ],
    },
    components: [
      { id: "catalog-control", routeId: "catalog" },
      { id: "order-control", routeId: "private-order" },
    ],
    interactions: [
      { componentId: "catalog-control", states: [{ id: "idle" }] },
      { componentId: "order-control", states: [{ id: "draft" }, { id: "ready" }] },
    ],
    assetDirection: { sceneDirections: [] },
  } as unknown as VerveProjectSpec;
  const probe = createRenderProbeSource(probeId, routeSpec);

  await page.goto("/", { waitUntil: "networkidle" });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body>
    <main><h1 data-verve-task="primary-object">Catalog</h1><p data-verve-task="decision-evidence">Measured evidence</p><button id="route" data-state="idle" data-verve-primary-action>Continue</button></main>
    <script>window.__truthReports=[];window.addEventListener("message",event=>{if(event.data&&event.data.source==="verve-render-gate")window.__truthReports.push(event.data)});document.querySelector("#route").addEventListener("click",event=>{event.currentTarget.dataset.state="ready";history.pushState({},"","/order")});</script>
    <script>${probe}</script></body></html>`, { waitUntil: "load" });
  const catalogKey = privacySafeSurfaceKey("catalog");
  const orderKey = privacySafeSurfaceKey("private-order");
  await page.waitForFunction(
    (expected) => (window as unknown as { __truthReports: RenderGateReport[] }).__truthReports.some((report) => report.surface?.routeKey === expected),
    catalogKey
  );
  await page.locator("#route").click();
  await page.waitForFunction(
    (expected) => (window as unknown as { __truthReports: RenderGateReport[] }).__truthReports.some((report) => report.surface?.routeKey === expected),
    orderKey
  );
  const surfaces = await page.evaluate(() => (window as unknown as { __truthReports: RenderGateReport[] }).__truthReports.map((report) => report.surface));
  expect(surfaces.some((surface) => surface?.routeKey === catalogKey)).toBe(true);
  expect(surfaces.some((surface) => surface?.routeKey === orderKey && surface.expectedStateCount === 2)).toBe(true);
  expect(new Set(surfaces.map((surface) => surface?.stateKey)).size).toBeGreaterThanOrEqual(2);
  expect(JSON.stringify(surfaces)).not.toContain("private-order");
  expect(JSON.stringify(surfaces)).not.toContain("ready");
});

test("Rendered Evidence Salience measures visible prominence and reports only hashed missing evidence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser is sufficient for deterministic evidence measurement.");
  const evidenceSpec = {
    briefEvidence: {
      items: [
        { id: "evidence-1", kind: "record" },
        { id: "evidence-2", kind: "comparison-dimension" },
      ],
    },
    experience: { route: "/", routes: [{ id: "catalog", path: "/", regionIds: ["opening", "choice"] }] },
    narrative: {
      scenes: [
        { id: "opening", routeId: "catalog", evidenceIds: ["evidence-1"] },
        { id: "choice", routeId: "catalog", evidenceIds: ["evidence-2"] },
      ],
    },
    components: [],
    interactions: [],
    assetDirection: { sceneDirections: [] },
  } as unknown as VerveProjectSpec;

  const measure = async (hidden: boolean, transparentAncestor = false) => {
    const probeId = `evidence-salience-${hidden ? "hidden" : transparentAncestor ? "transparent" : "visible"}`;
    const probe = createRenderProbeSource(probeId, evidenceSpec);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setContent(`<!doctype html><html><head><style>
      body{margin:0;font:18px Arial,sans-serif}.record{${hidden ? "display:none;" : ""}min-height:190px;padding:48px;background:#17223b;color:white}.record h1{font-size:56px;margin:0 0 16px}.matrix{width:80%;margin:48px auto;border-collapse:collapse}.matrix th{padding:28px;text-align:left;border:1px solid #333}
    </style></head><body><main><div style="${transparentAncestor ? "opacity:0" : ""}"><article class="record" data-verve-evidence-id="evidence-1"><h1 data-verve-task="primary-object">Riso Notebook</h1><p>A5 · 80 pages · 120gsm · EGP 450</p></article></div><table class="matrix"><thead><tr data-verve-evidence-id="evidence-2"><th data-verve-task="decision-evidence">Paper weight</th><th>Binding</th><th>Batch</th><th>Price</th></tr></thead></table><button data-verve-primary-action>Compare</button></main><script>window.__evidenceReport=null;window.addEventListener("message",event=>{if(event.data&&event.data.probeId==="${probeId}")window.__evidenceReport=event.data});</script><script>${probe}</script></body></html>`, { waitUntil: "load" });
    await page.waitForFunction(
      (activeProbeId) => (window as unknown as { __evidenceReport?: RenderGateReport }).__evidenceReport?.probeId === activeProbeId,
      probeId
    );
    return page.evaluate(() => (window as unknown as { __evidenceReport: RenderGateReport }).__evidenceReport);
  };

  const visible = await measure(false);
  expect(isRenderGateReport(visible, "evidence-salience-visible")).toBe(true);
  expect(visible.renderedEvidence?.coverage).toBe(1);
  expect(visible.renderedEvidence?.firstViewportCoverage).toBe(1);
  expect(visible.renderedEvidence?.score).toBeGreaterThanOrEqual(0.65);
  expect(visible.checks.find((check) => check.id === "rendered-evidence-salience")?.status).toBe("pass");

  const hidden = await measure(true);
  expect(isRenderGateReport(hidden, "evidence-salience-hidden")).toBe(true);
  expect(hidden.renderedEvidence?.observed).toBe(1);
  expect(hidden.renderedEvidence?.missingCriticalKeys).toHaveLength(1);
  expect(hidden.checks.find((check) => check.id === "rendered-evidence-salience")?.status).toBe("fail");
  expect(JSON.stringify(hidden.renderedEvidence)).not.toContain("evidence-1");
  expect(hidden.renderedEvidence?.missingCriticalKeys[0]).toMatch(/^surface-[a-z0-9]+$/);

  const transparent = await measure(false, true);
  expect(isRenderGateReport(transparent, "evidence-salience-transparent")).toBe(true);
  expect(transparent.renderedEvidence?.missingCriticalKeys).toHaveLength(1);
  expect(transparent.checks.find((check) => check.id === "rendered-evidence-salience")?.status).toBe("fail");
});

test("Rendered Composition Realization rejects truthful markers around repeated centered stacks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser is sufficient for deterministic geometry measurement.");
  const compositionSpec = {
    experience: { route: "/", routes: [{ id: "gallery", path: "/", regionIds: ["scene-split", "scene-matrix", "scene-layered"] }] },
    components: [],
    interactions: [],
    narrative: {
      scenes: [
        { id: "scene-split", routeId: "gallery", evidenceIds: [] },
        { id: "scene-matrix", routeId: "gallery", evidenceIds: [] },
        { id: "scene-layered", routeId: "gallery", evidenceIds: [] },
      ],
      compositionGenome: {
        assignments: [
          { sceneId: "scene-split", genes: { structure: "split-stage", focalPosition: "leading", flow: "horizontal", overlap: "contained", depth: "layered", density: "balanced", mediaFrame: "full-bleed" }, mobileTransform: "single-column-reorder" },
          { sceneId: "scene-matrix", genes: { structure: "modular-matrix", focalPosition: "distributed", flow: "alternating", overlap: "none", depth: "flat", density: "dense", mediaFrame: "inset" }, mobileTransform: "focus-and-drawer" },
          { sceneId: "scene-layered", genes: { structure: "layered-field", focalPosition: "edge", flow: "freeform", overlap: "cross-boundary", depth: "immersive", density: "balanced", mediaFrame: "fragmented" }, mobileTransform: "stacked-overlap-preserved" },
        ],
      },
    },
    assetDirection: {
      sceneDirections: ["scene-split", "scene-matrix", "scene-layered"].map((sceneId) => ({ sceneId, expectedLayers: ["type", "shape"], selectedAssetIds: [], requirement: "not-applicable" })),
    },
  } as unknown as VerveProjectSpec;
  const markup = `<main>
    <section class="scene split" data-verve-scene="scene-split" data-verve-composition="split-stage" data-verve-flow="horizontal" data-verve-depth="layered"><article><h1 data-verve-task="primary-object">Material catalog</h1><p>Measured stock</p></article><figure data-verve-layer="shape" data-verve-visual-purpose="material evidence"><svg viewBox="0 0 200 120" aria-label="Material map"><rect width="200" height="120" fill="#e95d3f"/></svg></figure><aside><button data-verve-primary-action>Compare</button></aside></section>
    <section class="scene matrix" data-verve-scene="scene-matrix" data-verve-composition="modular-matrix" data-verve-flow="alternating" data-verve-depth="flat">${Array.from({ length: 6 }, (_, index) => `<article data-verve-layer="shape" data-verve-visual-purpose="comparison cell"><strong>${index + 1}</strong><p data-verve-task="${index === 0 ? "decision-evidence" : "support"}">Specification</p></article>`).join("")}</section>
    <section class="scene layered" data-verve-scene="scene-layered" data-verve-composition="layered-field" data-verve-flow="freeform" data-verve-depth="immersive"><article><h2>Layer one</h2></article><figure data-verve-layer="shape" data-verve-visual-purpose="spatial relationship"><svg viewBox="0 0 240 180" aria-label="Layer field"><circle cx="100" cy="80" r="75" fill="#425cc7"/></svg></figure><aside>Depth note</aside></section>
  </main>`;
  const measure = async (strong: boolean) => {
    const probeId = `composition-realization-${strong ? "strong" : "deceptive"}`;
    const probe = createRenderProbeSource(probeId, compositionSpec);
    const style = strong
      ? `.scene{box-sizing:border-box;min-height:420px;margin:0;padding:48px;position:relative}.split{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}.split>*{min-height:240px}.split figure{margin:0;box-shadow:18px 18px 0 #111}.split svg{width:100%;height:100%}.matrix{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.matrix article{padding:28px;border:2px solid #111}.layered{height:520px;overflow:visible}.layered>*{position:absolute;width:42%;min-height:220px;padding:30px;box-shadow:18px 20px 50px #0004}.layered article{left:4%;top:14%}.layered figure{left:31%;top:4%;z-index:2;transform:rotate(-5deg)}.layered aside{right:-2%;bottom:5%;z-index:3}.layered svg{width:100%;height:100%}`
      : `.scene{box-sizing:border-box;min-height:420px;margin:0;padding:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}.scene>*{box-sizing:border-box;width:62%;min-height:72px;margin:0;padding:18px;text-align:center;border:1px solid #111}.scene svg{width:100%;height:72px}`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.setContent(`<!doctype html><html><head><style>body{margin:0;font:18px Arial,sans-serif}${style}</style></head><body>${markup}<script>window.__compositionReport=null;window.addEventListener("message",event=>{if(event.data&&event.data.probeId==="${probeId}")window.__compositionReport=event.data});</script><script>${probe}</script></body></html>`, { waitUntil: "load" });
    await page.waitForFunction(
      (activeProbeId) => (window as unknown as { __compositionReport?: RenderGateReport }).__compositionReport?.probeId === activeProbeId,
      probeId
    );
    return page.evaluate(() => (window as unknown as { __compositionReport: RenderGateReport }).__compositionReport);
  };

  const strong = await measure(true);
  const deceptive = await measure(false);
  expect(isRenderGateReport(strong, "composition-realization-strong")).toBe(true);
  expect(isRenderGateReport(deceptive, "composition-realization-deceptive")).toBe(true);
  expect(strong.renderedComposition?.observedScenes).toBe(3);
  expect(strong.renderedComposition?.score).toBeGreaterThanOrEqual(0.6);
  expect(strong.renderedComposition?.repeatedAdjacentPairs).toBe(0);
  expect(deceptive.renderedComposition?.score ?? 1).toBeLessThan((strong.renderedComposition?.score ?? 0) - 0.12);
  expect(deceptive.renderedComposition?.repeatedAdjacentPairs).toBeGreaterThan(0);
  expect(deceptive.checks.find((check) => check.id === "rendered-composition-realization")?.status).toBe("warning");
  expect(JSON.stringify(deceptive.renderedComposition)).not.toContain("scene-split");
});
