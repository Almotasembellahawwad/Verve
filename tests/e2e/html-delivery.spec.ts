import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { analyzeBriefLocally } from "../../lib/engine/brief-analyzer";
import { generateCode, type GeneratedSourceFile } from "../../lib/engine/code-generator";
import { generateDesignPlanLocally } from "../../lib/engine/fast-path";
import { createProjectArchive } from "../../lib/client/project-archive";
import { buildGeneratedProject } from "../../lib/project/project-builder";
import { buildHtmlPreviewDocument } from "../../lib/project/html-preview";
import type { RenderGateReport } from "../../lib/project/render-gate";
import type { GeneratedProject, ProjectFile } from "../../lib/project/types";

const WIDTHS = [360, 768, 1440] as const;
const PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Z4sAAAAASUVORK5CYII=";
const PIXEL_ASSET: ProjectFile = { path: "assets/pixel.png", content: PIXEL_PNG, encoding: "base64", mediaType: "image/png", language: "binary", role: "asset" };

function source(path: string, content: string): GeneratedSourceFile {
  return { path, content, language: path.endsWith(".css") ? "css" : /\.(?:js|mjs)$/.test(path) ? "javascript" : "html" };
}

async function generatedHtml(files: GeneratedSourceFile[], assets: ProjectFile[] = []): Promise<GeneratedProject> {
  const analysis = analyzeBriefLocally("A focused print-studio page where visitors inspect supplied specifications and select a product locally.");
  const plan = generateDesignPlanLocally(analysis);
  let calls = 0;
  // Exercise the production source-manifest parser, never a remote provider.
  const generated = await generateCode({ async complete() { calls++; return JSON.stringify({ files }); } }, analysis, plan, "", "html", "fast");
  expect(calls).toBe(1);
  return buildGeneratedProject(generated, analysis, plan, [], [], undefined, undefined, assets);
}

async function preview(page: Page, project: GeneratedProject, probeId: string, entryFile = "index.html"): Promise<void> {
  await page.goto("about:blank");
  // These fixtures are self-contained. Any accidental remote dependency fails.
  await page.route(/^https?:\/\//, (route) => route.abort());
  const capture = '<script>window.__deliveryReport=null;window.addEventListener("message",function(event){if(event.data&&event.data.source==="verve-render-gate")window.__deliveryReport=event.data});</script>';
  const html = buildHtmlPreviewDocument(project, probeId, undefined, { entryFile });
  await page.setContent(html.replace(/<head([^>]*)>/i, `<head$1>${capture}`), { waitUntil: "load" });
}

async function renderReport(page: Page, probeId: string): Promise<RenderGateReport> {
  await page.waitForFunction((id) => (window as unknown as { __deliveryReport?: RenderGateReport }).__deliveryReport?.probeId === id, probeId);
  return page.evaluate(() => (window as unknown as { __deliveryReport: RenderGateReport }).__deliveryReport);
}

const CLASSIC_FILES = [
  source("index.html", '<!doctype html><html><head><meta charset="utf-8"><title>Delivery fixture</title><link rel="stylesheet" href="./styles.css"><script src="./app.js" defer></script></head><body><main><h1>Inspect the supplied specification</h1><button type="button" id="inspect">Inspect product</button><output id="selection" aria-live="polite">No product selected</output></main></body></html>'),
  source("styles.css", "body{margin:0;padding:24px;font-family:Arial,sans-serif}main{max-width:720px}button,output{display:block;margin-block:16px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}"),
  source("app.js", 'document.getElementById("inspect").addEventListener("click",()=>{document.getElementById("selection").textContent="Riso Notebook selected";});'),
];

test("HTML head defer delivery binds a real button at all three viewport widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser explicitly exercises all three widths.");
  const project = await generatedHtml(CLASSIC_FILES);
  expect(project.files.some((file) => file.path === "app.js")).toBe(true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    const probeId = `classic-delivery-${width}`;
    await preview(page, project, probeId);
    await expect(page.locator("#selection")).toHaveText("No product selected");
    await page.getByRole("button", { name: "Inspect product" }).click();
    await expect(page.locator("#selection")).toHaveText("Riso Notebook selected");
    const report = await renderReport(page, probeId);
    expect(report.checks.find((check) => check.id === "runtime-errors")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "horizontal-overflow")?.status).toBe("pass");
  }
  expect(errors).toEqual([]);
});

test("HTML import maps execute multiline static imports, dynamic literals and .mjs cycles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Module semantics are independent of the duplicated mobile project.");
  const project = await generatedHtml([
    source("index.html", '<!doctype html><html><head><title>Module fixture</title><script type="module" src="./scripts/app.js"></script><script type="module" src="./scripts/app.js"></script></head><body><output id="modules">pending</output><button type="button" id="module-action">Inspect module state</button><output id="module-state">not selected</output></body></html>'),
    source("scripts/app.js", 'import /* static dependency */ {\n getCycleLabel\n} from "./cycle-a.mjs";\nimport { cyclicEcho } from "./cycle-b.mjs";\nexport const entryLabel="canonical-entry"; window.__entryInitializations=(window.__entryInitializations||0)+1;\nconst { dynamicLabel } = await import(/* lazy dependency */ "./dynamic.mjs");\ndocument.getElementById("modules").textContent=getCycleLabel()+" / "+cyclicEcho()+" / "+dynamicLabel;\ndocument.getElementById("module-action").addEventListener("click",()=>{document.getElementById("module-state").textContent="module selected";});'),
    source("scripts/cycle-a.mjs", 'import { suffix } from "./cycle-b.mjs"; import { entryLabel } from "./app.js"; export const prefix="A"; export function getCycleLabel(){return prefix+suffix+" / "+entryLabel;}'),
    source("scripts/cycle-b.mjs", 'import { prefix } from "./cycle-a.mjs"; export const suffix="B"; export function cyclicEcho(){return prefix;}'),
    source("scripts/dynamic.mjs", 'export const dynamicLabel="dynamic-ready";'),
  ]);
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await preview(page, project, "module-delivery");
  await expect(page.locator("#modules")).toHaveText("AB / canonical-entry / A / dynamic-ready");
  expect(await page.evaluate(() => (window as unknown as { __entryInitializations: number }).__entryInitializations)).toBe(1);
  await page.getByRole("button", { name: "Inspect module state" }).click();
  await expect(page.locator("#module-state")).toHaveText("module selected");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  expect((await renderReport(page, "module-delivery")).checks.find((check) => check.id === "runtime-errors")?.status).toBe("pass");
});

test("native JavaScript and modules also execute inside the real opaque-origin sandbox boundary", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The isolated iframe boundary needs one browser.");
  const project = await generatedHtml([
    source("index.html", '<!doctype html><html><head><title>Sandbox execution</title><script id="classic-entry" data-state="bound" src="./app.js" defer></script><script type="module" src="./scripts/feature.mjs"></script></head><body><button id="inspect" type="button">Inspect in sandbox</button><output id="state">pending</output><output id="module">pending</output></body></html>'),
    source("app.js", 'window.__scriptAttribute=document.currentScript.dataset.state; document.getElementById("inspect").addEventListener("click",()=>{document.getElementById("state").textContent=window.__scriptAttribute+" selection";});'),
    source("scripts/feature.mjs", 'import { label } from "./label.mjs"; document.getElementById("module").textContent=label;'),
    source("scripts/label.mjs", 'export const label="module in opaque origin";'),
  ]);
  // Use the actual production page: srcDoc inherits its CSP as well as base.
  // A policy-free about:blank test would miss blocked data-URL execution.
  await page.goto("/create", { waitUntil: "load" });
  await page.evaluate(() => {
    const iframe = document.createElement("iframe");
    iframe.id = "sandbox";
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.title = "Controlled native preview";
    iframe.style.cssText = "position:fixed;inset:0;z-index:999999;width:100%;height:100%;background:white;border:0";
    document.body.append(iframe);
  });
  await page.evaluate(() => {
    (window as unknown as { __deliveryReport: RenderGateReport | null }).__deliveryReport = null;
    window.addEventListener("message", (event) => {
      if (event.source === (document.getElementById("sandbox") as HTMLIFrameElement).contentWindow && event.data?.source === "verve-render-gate") {
        (window as unknown as { __deliveryReport: RenderGateReport }).__deliveryReport = event.data;
      }
    });
  });
  await page.locator("#sandbox").evaluate((iframe: HTMLIFrameElement, previewHtml) => { iframe.srcdoc = previewHtml; }, buildHtmlPreviewDocument(project, "opaque-sandbox-delivery"));
  const frame = page.frameLocator("#sandbox");
  await expect(frame.locator("#module")).toHaveText("module in opaque origin");
  await frame.getByRole("button", { name: "Inspect in sandbox" }).focus();
  await page.keyboard.press("Enter");
  await expect(frame.locator("#state")).toHaveText("bound selection");
  expect(await frame.locator("html").evaluate(() => {
    try { void parent.document.body; return "unsafe same-origin access"; } catch { return "isolated"; }
  })).toBe("isolated");
  expect((await renderReport(page, "opaque-sandbox-delivery")).checks.find((check) => check.id === "runtime-errors")?.status).toBe("pass");
});

test("nested HTML preserves CSS imports, layer/supports/media and cache-busted binary assets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser explicitly exercises root/nested entries and three widths.");
  const pageMarkup = (prefix: string) => `<!doctype html><html><head><title>Nested delivery</title><link rel="stylesheet" href="${prefix}styles/main.css?v=1"><link rel="stylesheet" href="${prefix}styles/desktop.css" media="(min-width:1440px)"></head><body><main><h1>Nested visual evidence</h1><img id="photo" src="${prefix}assets/pixel.png?v=1" alt="Controlled pixel fixture" width="64" height="64"><p id="common">Unquoted CSS import</p><p id="frame">Conditional composition</p><p id="desktop-only">Desktop link media</p><p id="unsupported">Unsupported declaration stays off</p></main></body></html>`;
  const project = await generatedHtml([
    source("index.html", pageMarkup("./")),
    source("projects/index.html", pageMarkup("../")),
    source("styles/main.css", '@import url(./nested/common.css);\n@import "./nested/frame.css" layer(composition) supports(display: grid) screen and (min-width:768px);\n@import "./nested/unsupported.css" supports(not-a-real-css-property:unsupported);\nbody{margin:0;padding:24px;color:rgb(30,31,32);font-family:Arial,sans-serif}img{max-width:100%}'),
    source("styles/nested/common.css", "#common{color:rgb(10,11,12)}"),
    source("styles/nested/frame.css", '#frame{display:grid;color:rgb(1,2,3);background-image:url("../../assets/pixel.png?theme=1")}'),
    source("styles/nested/unsupported.css", "#unsupported{color:rgb(199,0,0)}"),
    source("styles/desktop.css", "#desktop-only{color:rgb(7,8,9)}"),
  ], [PIXEL_ASSET]);
  const remoteRequests: string[] = [];
  page.on("request", (request) => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  for (const entryFile of ["index.html", "projects/index.html"]) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await preview(page, project, `nested-delivery-${entryFile}-${width}`, entryFile);
      await expect(page.locator("#common")).toHaveCSS("color", "rgb(10, 11, 12)");
      await expect(page.locator("#frame")).toHaveCSS("color", width >= 768 ? "rgb(1, 2, 3)" : "rgb(30, 31, 32)");
      await expect(page.locator("#desktop-only")).toHaveCSS("color", width >= 1440 ? "rgb(7, 8, 9)" : "rgb(30, 31, 32)");
      await expect(page.locator("#unsupported")).toHaveCSS("color", "rgb(30, 31, 32)");
      expect(await page.locator("#photo").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1)).toBe(true);
      if (width >= 768) await expect(page.locator("#frame")).toHaveCSS("background-image", /data:image\/png;base64,/);
      else await expect(page.locator("#frame")).toHaveCSS("background-image", "none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  }
  expect(remoteRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("nested-html-css-assets.png"), fullPage: true });
});

test("the render probe captures authored head exceptions before DOM readiness", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The early-error boundary needs one browser.");
  const project = await generatedHtml([
    source("index.html", '<!doctype html><html><head><title>Early failure</title><script>throw new Error("controlled early head failure");</script></head><body><main><h1>Failure fixture</h1></main></body></html>'),
  ]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await preview(page, project, "early-runtime-delivery");
  const runtime = (await renderReport(page, "early-runtime-delivery")).checks.find((check) => check.id === "runtime-errors");
  expect(errors).toContain("controlled early head failure");
  expect(runtime?.status).toBe("fail");
  expect(runtime?.message).toContain("controlled early head failure");
});

test("the render probe captures image resource failures rather than reporting a clean runtime", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The resource-error capture boundary needs one browser.");
  const project = await generatedHtml([
    source("index.html", '<!doctype html><html><head><title>Resource failure</title></head><body><main><h1>Failure fixture</h1><img src="https://verve-delivery-failure.invalid/missing.png" alt="Controlled failed resource"></main></body></html>'),
  ]);
  await page.goto("about:blank");
  await page.route("https://verve-delivery-failure.invalid/**", (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "Controlled missing fixture" }));
  const capture = '<script>window.__deliveryReport=null;window.addEventListener("message",function(event){if(event.data&&event.data.source==="verve-render-gate")window.__deliveryReport=event.data});</script>';
  await page.setContent(buildHtmlPreviewDocument(project, "failed-image-delivery").replace(/<head([^>]*)>/i, `<head$1>${capture}`), { waitUntil: "load" });
  const runtime = (await renderReport(page, "failed-image-delivery")).checks.find((check) => check.id === "runtime-errors");
  expect(await page.getByRole("img", { name: "Controlled failed resource" }).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 0)).toBe(true);
  expect(runtime?.status).toBe("fail");
  expect(runtime?.message).toMatch(/img resource failed to load/i);
});

test("the downloaded vanilla ZIP keeps app.js executable and contains no synthetic compare or preview probe", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "The exported file:// interaction needs one browser.");
  const project = await generatedHtml(CLASSIC_FILES);
  const archive = await JSZip.loadAsync(await (await createProjectArchive(project)).arrayBuffer());
  const paths = Object.keys(archive.files);
  expect(paths).toContain("app.js");
  expect(paths).not.toContain("compare/index.html");
  expect(paths.some((path) => /__verve_render_probe/.test(path))).toBe(false);
  expect(await archive.file("index.html")!.async("string")).not.toContain("data-verve-render-probe");
  expect(await archive.file("app.js")!.async("string")).toContain("addEventListener");
  const outputDirectory = resolve(testInfo.outputPath("downloaded-html-project"));
  await mkdir(outputDirectory, { recursive: true });
  for (const [path, entry] of Object.entries(archive.files)) {
    if (entry.dir) continue;
    const destination = resolve(outputDirectory, path);
    expect(destination.startsWith(`${outputDirectory}${sep}`), `Archive path escapes the test output directory: ${path}`).toBe(true);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await entry.async("nodebuffer"));
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(outputDirectory, "index.html")).href);
  await page.getByRole("button", { name: "Inspect product" }).click();
  await expect(page.locator("#selection")).toHaveText("Riso Notebook selected");
  expect(errors).toEqual([]);
});
