import { expect, test } from "@playwright/test";
import { analyzeBriefLocally } from "../../lib/engine/brief-analyzer";
import { generateDirectionBoard, buildPlanFromDirectionBoard, createDirectionCheckpoint } from "../../lib/engine/direction-board";
import { StaticReferenceLibraryRepository } from "../../lib/adapters/storage/static-content-repositories";
import { buildVerveProjectSpec } from "../../lib/engine/project-spec-builder";
import { buildGeneratedProject } from "../../lib/project/project-builder";
import { projectRevision } from "../../lib/project/project-revision";
import type { AssetBundle } from "../../lib/engine/asset-sourcer";
import type { RenderedEvaluationEvidence } from "../../lib/engine/evaluation-coherence";
import type { RenderGateReport } from "../../lib/project/render-gate";
import { RENDER_RECEIPT_PROBE_VERSION } from "../../lib/domain/render-receipt";

test("design choices reach preview and export; edited output cannot inherit the original render receipt", async ({ page }, testInfo) => {
  const brief = "A Cairo print studio. Riso Notebook: A5, 80 pages, 120gsm paper, EGP 450. Compare specifications before a wholesale enquiry. No photography.";
  const analysis = analyzeBriefLocally(brief);
  const board = await generateDirectionBoard({ analysis, framework: "html", mode: "fast", referenceRepository: new StaticReferenceLibraryRepository(), llm: { async complete() { throw new Error("offline fixture"); } } });
  const plan = buildPlanFromDirectionBoard(analysis, board);
  const assets: AssetBundle = {
    photos: [], icons: [], extractedPalette: [], warnings: [], readinessWarnings: [], assetSummary: "No photos requested.",
    mediaRequirement: { level: "avoid", minimumAssets: 0, reason: "Explicit exclusion.", suggestedSubjects: [] },
    font: { family: "Manrope", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
  };
  const spec = buildVerveProjectSpec({ analysis, plan, framework: "html", mode: "fast", assetBundle: assets });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Print specification</title>
    <style>body{margin:0;background:var(--verve-color-surface);color:var(--verve-color-text-primary);font:16px sans-serif}main{padding:var(--verve-space-4);max-width:64rem}h1{font-size:clamp(2rem,5vw,4rem)}button{min-height:44px;padding:1rem}th,td{text-align:left;padding:.5rem}:focus-visible{outline:3px solid currentColor}</style></head>
    <body><main><h1 data-verve-task="primary-object">Paper specifications</h1><table data-verve-task="decision-evidence"><caption>Riso Notebook</caption><tr><th>Format</th><td>A5</td></tr><tr><th>Pages</th><td>80</td></tr><tr><th>Paper</th><td>120gsm</td></tr><tr><th>Price</th><td>EGP 450</td></tr></table><button type="button" data-verve-primary-action>Compare this line</button></main></body></html>`;
  const code = { framework: "html", code: html, componentName: "PrintSpecs", imports: [], setupNotes: "Offline browser fixture; not a provider quality benchmark." };
  const project = buildGeneratedProject(code, analysis, plan, [], [], undefined, undefined, [], undefined, undefined, [], "", undefined, spec.designContract);
  const expectedRevision = await projectRevision(project, spec);
  const result = {
    mode: "fast", briefAnalysis: analysis, plan, code, project, projectSpec: spec, revisionCount: 0, durationMs: 1,
    critique: { passed: true, flaggedElements: [], positiveElements: [], verdict: "Offline fixture", transcript: "No remote critique." },
    distinctivenessReport: { score: 70, grade: "B", clichesAvoided: [], clichesDetected: [], signatureElement: plan.signatureElement.name, critiqueSummary: "Fixture only", revisionCount: 0, recommendations: [] },
    evaluationCoherence: { version: 1, status: "review", releaseDecision: "review-required", creativeClaim: "provisional", findings: [], policy: [], signals: [
      { id: "release-readiness", label: "Source", authority: "release-gate", stage: "release", status: "pass", score: 100, summary: "Fixture source" },
      { id: "render-evidence", label: "Browser", authority: "render-evidence", stage: "render", status: "unavailable", score: null, summary: "Awaiting browser" },
    ] },
  };
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem("verve_anthropic_api_key", "offline-fixture-not-sent-to-provider");
    const target = window as typeof window & { receiptProbeReports: RenderGateReport[] };
    target.receiptProbeReports = [];
    window.addEventListener("message", (event) => {
      if (event.data?.source === "verve-render-gate") target.receiptProbeReports.push(event.data);
    });
  });
  await page.route("**/api/directions/stream", (route) => route.fulfill({ contentType: "text/event-stream", body: `event: directions:complete\ndata: ${JSON.stringify({ board, checkpoint: createDirectionCheckpoint(board) })}\n\n` }));
  await page.route("**/api/generate/stream", (route) => route.fulfill({ contentType: "text/event-stream", body: `event: result\ndata: ${JSON.stringify(result)}\n\n` }));
  await page.goto("/create");
  await page.getByLabel("Design brief").fill(brief);
  await page.getByText("Project options", { exact: true }).click();
  await page.getByLabel("Framework", { exact: true }).selectOption("html");
  await page.getByRole("button", { name: "Explore 6 directions" }).click();
  await page.getByRole("button", { name: "Generate Fast result" }).click();
  const workspace = page.getByRole("region", { name: "Generated HTML project workspace" });
  const choices = workspace.locator("details").filter({ hasText: "Design choices" });
  await expect(choices).not.toHaveAttribute("open");
  await choices.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(choices).toHaveAttribute("open", "");
  await expect(choices).toContainText(spec.designContract!.identity.concept);
  await expect(choices.getByRole("list", { name: "Design color roles" }).getByRole("listitem")).toHaveCount(5);
  const preview = page.frameLocator('iframe[title$="live preview"]');
  await expect(preview.getByRole("heading", { name: "Paper specifications" })).toBeVisible();
  expect(await preview.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--verve-color-surface").trim())).toBe(spec.designContract!.colorRoles.surface);
  await choices.screenshot({ path: testInfo.outputPath("design-choices.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  const historyAudit = () => page.evaluate(() => {
    const entries = JSON.parse(localStorage.getItem("verve_design_history") ?? "[]") as Array<{ renderAudit?: RenderedEvaluationEvidence }>;
    return entries[0]?.renderAudit;
  });
  for (const width of [360, 768, 1440]) {
    await workspace.getByRole("group", { name: "Preview viewport" }).getByRole("button", { name: `${width}`, exact: true }).click();
    await expect.poll(async () => (await historyAudit())?.binding?.testedSurfaces.some((surface) => surface.width === width)).toBe(true);
  }
  const receipt = (await historyAudit())!;
  expect(receipt.covered).toBe(3);
  expect(receipt.binding?.revision).toEqual(expectedRevision);
  expect(receipt.binding?.probeVersion).toBe(RENDER_RECEIPT_PROBE_VERSION);
  expect(receipt.binding?.testedSurfaces.every((surface) => /^surface-[a-z0-9]+$/.test(surface.routeKey) && /^surface-[a-z0-9]+$/.test(surface.stateKey))).toBe(true);

  const oldProbe = await page.evaluate(() => (window as typeof window & { receiptProbeReports: RenderGateReport[] }).receiptProbeReports.find((report) => Math.abs(report.viewport.width - 360) <= 2)!);
  expect(oldProbe).toBeDefined();
  await workspace.getByLabel("Edit index.html").fill(html.replace("Paper specifications", "Revised paper specifications"));
  await expect(preview.getByRole("heading", { name: "Revised paper specifications" })).toBeVisible();
  const renderStatus = workspace.getByText(/NATIVE HTML.*RENDER GATE/);
  await expect(renderStatus).toContainText("1/3");
  // The original frame can legitimately refresh its capture timestamp between
  // the three-width capture and the edit. Snapshot *after* the edited frame has
  // reported, so the replay assertion tests stale-message rejection, not timer
  // scheduling. The saved evidence must still describe the original artifact.
  const storedReceiptBeforeReplay = (await historyAudit())!;
  const { capturedAt: originalCapturedAt, ...originalEvidence } = receipt;
  const { capturedAt: latestCapturedAt, ...storedEvidence } = storedReceiptBeforeReplay;
  expect(storedEvidence).toEqual(originalEvidence);
  expect(latestCapturedAt).toBeGreaterThanOrEqual(originalCapturedAt);
  // A queued message from the old frame cannot re-populate the edited matrix.
  const receivedBeforeInjection = await page.evaluate(() => (window as typeof window & { receiptProbeReports: RenderGateReport[] }).receiptProbeReports.length);
  await preview.locator("html").evaluate((_, report) => parent.postMessage(report, "*"), oldProbe);
  await expect.poll(() => page.evaluate(({ start, probeId }) => (window as typeof window & { receiptProbeReports: RenderGateReport[] }).receiptProbeReports.slice(start).some((report) => report.probeId === probeId), { start: receivedBeforeInjection, probeId: oldProbe.probeId })).toBe(true);
  await expect(renderStatus).toContainText("1/3");
  await expect.poll(() => historyAudit()).toEqual(storedReceiptBeforeReplay);
  await page.getByRole("tab", { name: "Critique Report" }).click();
  await expect(page.getByText("Creative claim: provisional")).toBeVisible();
  await expect(page.getByText(/Browser evidence must match this exact source/)).toBeVisible();
  expect(errors).toEqual([]);
});
