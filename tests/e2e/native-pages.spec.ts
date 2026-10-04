import { expect, test, type Page } from "@playwright/test";
import { analyzeBriefLocally } from "../../lib/engine/brief-analyzer";
import { generateDirectionBoard, buildPlanFromDirectionBoard, createDirectionCheckpoint } from "../../lib/engine/direction-board";
import { StaticReferenceLibraryRepository } from "../../lib/adapters/storage/static-content-repositories";
import { buildGeneratedProject } from "../../lib/project/project-builder";
import { projectRevision } from "../../lib/project/project-revision";
import { privacySafeSurfaceKey } from "../../lib/project/visual-truth";
import type { VerveProjectSpec } from "../../lib/domain/project-spec";
import type { RenderedEvaluationEvidence } from "../../lib/engine/evaluation-coherence";
import type { RenderGateReport } from "../../lib/project/render-gate";

type FixtureOptions = { failingPage?: boolean; withSpec?: boolean; rtl?: boolean };

// Native pointer/navigation regressions must not be hidden by CI retries.
test.describe.configure({ retries: 0 });

async function openFixture(page: Page, { failingPage = false, withSpec = false, rtl = false }: FixtureOptions = {}) {
  const brief = "An architecture practice. Include a home page, a separate work page and a separate contact page. Let visitors inspect the practice and begin an enquiry. No photography.";
  const analysis = analyzeBriefLocally(brief);
  const board = await generateDirectionBoard({ analysis, framework: "html", mode: "fast", referenceRepository: new StaticReferenceLibraryRepository(), llm: { async complete() { throw new Error("offline route fixture"); } } });
  const plan = buildPlanFromDirectionBoard(analysis, board);
  const markup = (title: string, content: string, prefix = "./", head = "") => `<!doctype html><html lang="${rtl ? "ar" : "en"}" ${rtl ? 'dir="rtl"' : ""}><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="${prefix}styles.css"><script defer src="${prefix}app.js"></script>${head}</head><body><main><h1>${title}</h1>${content}</main></body></html>`;
  const files = [
    { path: "index.html", language: "html", content: markup("Practice home", '<a href="./work/?v=1#details">Inspect work</a><a href="/contact">Contact practice</a><a id="delegated" href="/contact">Custom interaction link</a><output id="delegated-state">Not handled</output><a href="/missing">Missing page</a><a href="https://example.com/">External link</a><button id="tab" type="button" aria-pressed="false">Change enquiry state</button><output id="state">Initial state</output>') },
    { path: "work/index.html", language: "html", content: markup("Project evidence", '<a href="../index.html">Return home</a><a href="../contact.html">Contact from work</a><section id="details"><h2>Material detail</h2><p>Nested page scripts and styles use their own document base.</p></section><button id="inspect" type="button">Inspect detail</button><output id="detail">Not inspected</output>', "../", failingPage ? '<script>throw new Error("Controlled secondary-page failure")</script>' : "") },
    { path: "contact.html", language: "html", content: markup("Contact practice", '<a href="./index.html">Return home</a><label for="name">Your name</label><input id="name"><button type="button">Review locally</button>') },
    { path: "styles.css", language: "css", content: 'body{margin:0;background:#172b37;color:#fff;font:18px sans-serif}main{padding:24px;max-width:760px;box-sizing:border-box}a{display:block;color:#b9f0df;margin-block:12px}button,input{display:block;min-height:44px;margin-block:16px;max-width:100%;box-sizing:border-box}#details{margin-block-start:60px;padding:16px;background:#294353}:focus-visible{outline:3px solid #ffbf66;outline-offset:3px}' },
    { path: "app.js", language: "javascript", content: 'document.addEventListener("click",(event)=>{if(event.target.closest("#delegated")){event.preventDefault();document.getElementById("delegated-state").textContent="Custom interaction handled";}});document.getElementById("tab")?.addEventListener("click",function(){this.setAttribute("aria-pressed",this.getAttribute("aria-pressed")==="true"?"false":"true");document.getElementById("state").textContent=this.getAttribute("aria-pressed")==="true"?"Changed state":"Initial state";});document.getElementById("inspect")?.addEventListener("click",()=>{document.getElementById("detail").textContent="Detail inspected";});' },
  ];
  const code = { framework: "html", code: files[0].content, files, componentName: "NativePages", imports: [], setupNotes: "Controlled offline route fixture; not a provider quality benchmark." };
  const project = buildGeneratedProject(code, analysis, plan, [], []);
  // A small explicit observation contract: all scene-quality claims remain unverified.
  const spec = withSpec ? {
    experience: { routes: [
      { id: "home", path: "/", regionIds: [] }, { id: "work", path: "/work", regionIds: [] }, { id: "contact", path: "/contact", regionIds: [] },
    ] }, components: [{ id: "enquiry-tabs", routeId: "home" }],
    interactions: [{ componentId: "enquiry-tabs", states: [{ id: "initial" }, { id: "changed" }] }],
    narrative: { scenes: [], richness: { requiredLayers: ["type", "interaction"] } },
  } as unknown as VerveProjectSpec : undefined;
  const revision = await projectRevision(project, spec);
  const result = {
    mode: "fast", briefAnalysis: analysis, plan, code, project, ...(spec ? { projectSpec: spec } : {}), revisionCount: 0, durationMs: 1,
    critique: { passed: true, flaggedElements: [], positiveElements: [], verdict: "Offline fixture", transcript: "No remote critique." },
    distinctivenessReport: { score: 70, grade: "B", clichesAvoided: [], clichesDetected: [], signatureElement: plan.signatureElement.name, critiqueSummary: "Fixture only", revisionCount: 0, recommendations: [] },
    evaluationCoherence: { version: 1, status: "review", releaseDecision: "review-required", creativeClaim: "provisional", findings: [], policy: [], signals: [
      { id: "release-readiness", label: "Source", authority: "release-gate", stage: "release", status: "pass", score: 100, summary: "Fixture source" },
      { id: "render-evidence", label: "Browser", authority: "render-evidence", stage: "render", status: "unavailable", score: null, summary: "Awaiting browser" },
    ] },
  };
  await page.addInitScript(() => {
    if (window !== window.top) return;
    localStorage.setItem("verve_anthropic_api_key", "offline-fixture-not-sent-to-provider");
    (window as typeof window & { nativeReports: RenderGateReport[] }).nativeReports = [];
    window.addEventListener("message", (event) => {
      if (event.data?.source === "verve-render-gate") (window as typeof window & { nativeReports: RenderGateReport[] }).nativeReports.push(event.data);
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
  const frame = page.frameLocator('iframe[title$="live preview"]');
  await expect(frame.getByRole("heading", { name: "Practice home" })).toBeVisible();
  await expect.poll(() => page.locator("html").evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe("auto");
  const audit = () => page.evaluate(() => (JSON.parse(localStorage.getItem("verve_design_history") ?? "[]") as Array<{ renderAudit?: RenderedEvaluationEvidence }>)[0]?.renderAudit);
  return { workspace, frame, audit, revision, spec };
}

test("native pages retain local JS, route identity and every route/state/width receipt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser explicitly measures all three preview widths.");
  const { workspace, frame, audit, revision } = await openFixture(page, { withSpec: true });
  await frame.getByRole("link", { name: "Inspect work" }).focus();
  await page.keyboard.press("Enter");
  await expect(frame.getByRole("heading", { name: "Project evidence" })).toBeVisible();
  await expect.poll(() => frame.locator("html").evaluate(() => document.readyState)).toBe("complete");
  await expect(workspace.getByLabel("Preview page", { exact: true })).toHaveValue("work/index.html");
  await frame.getByRole("button", { name: "Inspect detail" }).click();
  await expect(frame.locator("#detail")).toHaveText("Detail inspected");
  await expect.poll(async () => (await audit())?.binding?.testedSurfaces.some((surface) => surface.routeKey === privacySafeSurfaceKey("work"))).toBe(true);
  expect(await frame.locator("main").evaluate((element) => getComputedStyle(element).padding)).toBe("24px");
  expect(await frame.locator("html").evaluate(() => { try { void parent.document.body; return false; } catch { return true; } })).toBe(true);
  await workspace.getByRole("button", { name: "Previous preview page" }).click();
  await expect(frame.getByRole("heading", { name: "Practice home" })).toBeVisible();
  await workspace.getByRole("button", { name: "Next preview page" }).click();
  await expect(frame.getByRole("heading", { name: "Project evidence" })).toBeVisible();
  for (const file of ["index.html", "work/index.html", "contact.html"]) {
    await workspace.getByLabel("Preview page", { exact: true }).selectOption(file);
    for (const width of [360, 768, 1440]) {
      await workspace.getByRole("group", { name: "Preview viewport" }).getByRole("button", { name: `${width}`, exact: true }).click();
      const route = file === "index.html" ? "home" : file === "work/index.html" ? "work" : "contact";
      await expect.poll(async () => (await audit())?.binding?.testedSurfaces.some((surface) => surface.routeKey === privacySafeSurfaceKey(route) && surface.width === width)).toBe(true);
      if (file === "index.html") {
        // Capture both actual aria states at this width, not two observations of the same state.
        await frame.getByRole("button", { name: "Change enquiry state" }).click();
        await expect.poll(async () => new Set((await audit())?.binding?.testedSurfaces.filter((surface) => surface.routeKey === privacySafeSurfaceKey("home") && surface.width === width).map((surface) => surface.stateKey)).size).toBe(2);
        await frame.getByRole("button", { name: "Change enquiry state" }).click();
      }
    }
  }
  await expect.poll(async () => (await audit())?.complete).toBe(true);
  const receipt = (await audit())!;
  expect(receipt.binding?.revision).toEqual(revision);
  expect(receipt.surfaceCoverage).toEqual({ version: 3, routes: { covered: 3, expected: 3 }, routeViewports: { covered: 9, expected: 9 }, stateViewports: { covered: 12, expected: 12 } });
  expect(receipt.binding?.testedSurfaces).toHaveLength(12);
  expect(JSON.stringify(receipt)).not.toMatch(/work\/index\.html|Practice home|enquiry-tabs/);
});

test("legacy results enumerate all pages and retain a secondary-page failure after returning home", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser explicitly measures legacy route coverage.");
  const { workspace, frame, audit } = await openFixture(page, { failingPage: true });
  for (const width of [360, 768, 1440]) {
    await workspace.getByRole("group", { name: "Preview viewport" }).getByRole("button", { name: `${width}`, exact: true }).click();
    await expect.poll(async () => (await audit())?.binding?.testedSurfaces.some((surface) => surface.width === width)).toBe(true);
  }
  expect((await audit())?.complete).toBe(false);
  expect((await audit())?.surfaceCoverage?.routes).toEqual({ covered: 1, expected: 3 });
  await frame.getByRole("link", { name: "Inspect work" }).click();
  await expect.poll(async () => (await audit())?.status).toBe("fail");
  await frame.getByRole("link", { name: "Return home" }).click();
  await expect(frame.getByRole("heading", { name: "Practice home" })).toBeVisible();
  await expect(workspace.getByText(/work\/index\.html.*Controlled secondary-page failure/)).toBeVisible();
  expect((await audit())?.failures).toBeGreaterThan(0);
  await page.getByRole("tab", { name: "Critique Report" }).click();
  await expect(page.getByText("Creative claim: withheld")).toBeVisible();
});

test("RTL keyboard navigation stays bounded; stale route/probe messages cannot navigate or overwrite evidence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The same opaque boundary is used on mobile; widths are covered above.");
  const { workspace, frame, audit } = await openFixture(page, { rtl: true });
  await expect(frame.locator("html")).toHaveAttribute("dir", "rtl");
  await expect.poll(async () => (await audit())?.binding?.testedSurfaces.length ?? 0).toBeGreaterThan(0);
  const oldProbe = await page.evaluate(() => (window as typeof window & { nativeReports: RenderGateReport[] }).nativeReports.at(-1)!);
  await frame.getByRole("link", { name: "Inspect work" }).click();
  await expect(frame.getByRole("heading", { name: "Project evidence" })).toBeVisible();
  await expect.poll(async () => (await audit())?.surfaceCoverage?.routes.covered).toBe(2);
  const before = (await audit())!;
  await frame.locator("html").evaluate((_, report) => {
    parent.postMessage({ source: "verve-native-navigation", version: 1, probeId: report.probeId, href: "/contact" }, "*");
    parent.postMessage({ ...report, checks: [{ id: "fake", title: "Replayed old page", status: "fail", message: "Invalid old-page report" }] }, "*");
    const activeId = (window as typeof window & { __verveRenderProbe: string }).__verveRenderProbe;
    parent.postMessage({ ...report, probeId: activeId, checks: [{ id: "fake-route", title: "Wrong route", status: "fail", message: "Active probe but wrong page identity" }] }, "*");
  }, oldProbe);
  await expect(frame.getByRole("heading", { name: "Project evidence" })).toBeVisible();
  await expect(workspace.getByLabel("Preview page", { exact: true })).toHaveValue("work/index.html");
  await expect.poll(async () => (await audit())?.failures).toBe(before.failures);
  await workspace.getByRole("button", { name: "Previous preview page" }).focus();
  await page.keyboard.press("Enter");
  await expect(frame.getByRole("heading", { name: "Practice home" })).toBeVisible();
  await expect.poll(() => frame.locator("html").evaluate(() => document.readyState)).toBe("complete");
  await frame.getByRole("link", { name: "Custom interaction link" }).click();
  await expect(frame.locator("#delegated-state")).toHaveText("Custom interaction handled");
  await expect(workspace.getByLabel("Preview page", { exact: true })).toHaveValue("index.html");
  for (const name of ["Missing page", "External link"]) {
    await expect.poll(() => frame.locator("html").evaluate(() => document.readyState)).toBe("complete");
    await frame.getByRole("link", { name, exact: true }).click();
    await expect(workspace.getByText(/This link is not a delivered HTML page/)).toBeVisible();
    await expect(frame.getByRole("heading", { name: "Practice home" })).toBeVisible();
  }
  expect(page.url()).toMatch(/\/create$/);
});

test("native diagnostic updates cannot move a pressed RTL control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Pointer geometry is measured in the explicit desktop canvas.");
  const { workspace, frame } = await openFixture(page, { rtl: true });
  await expect.poll(() => frame.locator("html").evaluate(() => document.readyState)).toBe("complete");
  const link = frame.getByRole("link", { name: "Custom interaction link" });
  await link.hover();
  const before = await link.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  try {
    // A real preview message arrives between pointer down and up. The host must
    // show its warning without moving the document or replacing its runtime.
    await frame.locator("html").evaluate(() => {
      const probeId = (window as typeof window & { __verveRenderProbe: string }).__verveRenderProbe;
      parent.postMessage({ source: "verve-native-navigation", version: 1, probeId, href: "/missing" }, "*");
    });
    await expect(workspace.getByText(/This link is not a delivered HTML page/)).toBeVisible();
    const after = await link.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
  } finally {
    await page.mouse.up();
  }
  await expect(frame.locator("#delegated-state")).toHaveText("Custom interaction handled");
  await expect(workspace.getByLabel("Preview page", { exact: true })).toHaveValue("index.html");
});
