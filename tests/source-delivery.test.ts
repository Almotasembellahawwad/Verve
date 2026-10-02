import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDesignPlanLocally } from "../lib/engine/fast-path";
import { generateCode, GeneratedSourceDeliveryError } from "../lib/engine/code-generator";
import type { GenerationMode } from "../lib/domain/generation-mode";
import type { VerveProjectSpec } from "../lib/domain/project-spec";
import type { LLMAdapter, LLMOptions } from "../lib/ports/llm";
import { classifyError } from "../lib/middleware/error-handler";

const analysis = analyzeBriefLocally("An independent print studio. Let buyers inspect supplied paper specifications and choose a wholesale or individual ordering path.");
const plan = generateDesignPlanLocally(analysis);
const entrySource = '<!doctype html><html><head><link rel="stylesheet" href="./styles/main.css"><script type="module" src="./scripts/app.js"></script></head><body><button id="inspect">Inspect specifications</button></body></html>';

function source(path: string, content = "export const supported = true;") {
  return { path, content, language: "text" };
}

function mockedProvider(raw: string) {
  const calls: LLMOptions[] = [];
  const adapter: LLMAdapter = {
    async complete(_messages, options) {
      calls.push(options ?? {});
      return raw;
    },
  };
  return { adapter, calls };
}

async function generated(files: ReturnType<typeof source>[], mode: GenerationMode = "fast") {
  const { adapter, calls } = mockedProvider(JSON.stringify({ files }));
  const result = await generateCode(adapter, analysis, plan, "", "html", mode);
  return { result, calls };
}

test("HTML source delivery retains app.js instead of silently dropping the external script", async () => {
  const html = entrySource.replace("./scripts/app.js", "./app.js");
  const { result, calls } = await generated([source("index.html", html), source("app.js", 'document.querySelector("button").addEventListener("click", () => {});'), source("styles/main.css", "body { margin: 0; }")]);
  assert.equal(result.entryPath, "index.html");
  assert.equal(result.code, html);
  assert.deepEqual(result.files?.map((file) => file.path), ["index.html", "app.js", "styles/main.css"]);
  assert.equal(result.files?.find((file) => file.path === "app.js")?.language, "javascript");
  assert.equal(calls.length, 1, "preserving local files must not consume an additional model call");
});

test("HTML source delivery normalizes relative paths and retains nested JavaScript modules and CSS", async () => {
  const { result, calls } = await generated([
    source("./index.html", entrySource),
    source("scripts\\app.js", 'import { format } from "./format.mjs"; document.querySelector("button").textContent = format("Inspect");'),
    source("scripts/format.mjs", "export const format = (value) => value;"),
    source("styles\\main.css", '@import "./components/tabs.css"; body { margin: 0; }'),
    source("styles/components/tabs.css", "button:focus-visible { outline: 3px solid; }"),
  ]);
  assert.deepEqual(result.files?.map((file) => file.path), ["index.html", "scripts/app.js", "scripts/format.mjs", "styles/main.css", "styles/components/tabs.css"]);
  assert.equal(result.files?.find((file) => file.path.endsWith(".mjs"))?.language, "javascript");
  assert.equal(result.files?.find((file) => file.path.endsWith(".css"))?.language, "css");
  assert.match(calls[0].systemPrompt ?? "", /every referenced local script, imported module, and stylesheet must be present/);
  assert.match(calls[0].systemPrompt ?? "", /actual included JavaScript event handlers/);
});

test("generation rejects unsafe and owned configuration paths instead of masking them as successful source output", async () => {
  const unsafePaths = [
    "../app.js", "/app.js", "\\app.js", "C:\\app.js", "https://example.com/app.js", "//example.com/app.js",
    "scripts/../app.js", "scripts/./app.js", "scripts//app.js", "./../app.js", "app.js?version=1", "app.js#module",
    "%2e%2e/app.js", ".git/app.js", "node_modules/app.js", "dist/app.js", "app.js ", " app.js", "app\u0000.js",
    "nul.js", "CON/main.css", "verve-design.css", "styles/verve-design.css", "__verve_render_probe.js", "src/__verve_render_probe.js",
    "vite.config.js", "next.config.js", "eslint.config.mjs", "app/layout.tsx", "package.json",
  ];
  for (const path of unsafePaths) {
    await assert.rejects(generated([source("index.html", entrySource), source(path)]), GeneratedSourceDeliveryError, path);
  }
});

test("generation rejects duplicate normalized or case-insensitive file paths", async () => {
  for (const paths of [["app.js", "./app.js"], ["scripts/app.js", "scripts\\app.js"], ["app.js", "App.js"]]) {
    await assert.rejects(generated([source("index.html", entrySource), ...paths.map((path) => source(path))]), /duplicate path/);
  }
});

test("Fast mode advertises its eight-file limit and rejects over-budget manifests without truncating a dependency", async () => {
  const eightFiles = [source("index.html", entrySource), ...Array.from({ length: 7 }, (_, index) => source(`scripts/module-${index}.js`))];
  const { result, calls } = await generated(eightFiles);
  const schema = calls[0].responseFormat?.schema as { properties: { files: { maxItems: number } } };
  assert.equal(schema.properties.files.maxItems, 8);
  assert.equal(result.files?.length, 8);
  await assert.rejects(generated([...eightFiles, source("scripts/app.js")]), /exceeds the 8-file budget; dependency files were not truncated/);
});

test("Creative mode advertises and preserves its sixteen-file limit", async () => {
  const sixteenFiles = [source("index.html", entrySource), ...Array.from({ length: 15 }, (_, index) => source(`scripts/module-${index}.js`))];
  const { result, calls } = await generated(sixteenFiles, "creative");
  const schema = calls[0].responseFormat?.schema as { properties: { files: { maxItems: number } } };
  assert.equal(schema.properties.files.maxItems, 16);
  assert.equal(result.files?.length, 16);
  await assert.rejects(generated([...sixteenFiles, source("scripts/app.js")], "creative"), /exceeds the 16-file budget/);
});

test("structured delivery requires the framework entry and never falls back to a stylesheet or raw JSON entry", async () => {
  await assert.rejects(generated([source("styles.css", "body { margin: 0; }")]), /missing its required entry: index.html/);
  const invalidResponses = [
    '{"files":[]}', '{"files":null}', '{"files":[{"path":"index.html","content":99}]}',
    '{"files":[{"path":"index.html","content":""}]}', '{"unexpected":"manifest"}', '{"files":',
    '```json\n{"files":\n```',
  ];
  for (const raw of invalidResponses) {
    const { adapter } = mockedProvider(raw);
    await assert.rejects(generateCode(adapter, analysis, plan, "", "html", "fast"), GeneratedSourceDeliveryError);
  }
});

test("source manifest rejection is classified as a recoverable provider-output failure", () => {
  const error = new GeneratedSourceDeliveryError("the source manifest contains an unsafe or reserved path.");
  assert.equal(error.failure, "malformed_output");
  assert.deepEqual(classifyError(error), { code: "PROVIDER_ERROR", status: 502 });
});

test("legacy unstructured HTML and component output remain compatible", async () => {
  for (const [framework, path, raw] of [
    ["html", "index.html", entrySource],
    ["html", "index.html", `\`\`\`html\n${entrySource}\n\`\`\``],
    ["react", "src/App.tsx", "export default function App() { const data = { title: 'Print' }; return <main>{data.title}</main>; }"],
    ["react", "src/App.tsx", 'export default function App() { const data = {"files":["catalog.pdf"]}; return <main>{data.files[0]}</main>; }'],
    ["html", "index.html", '<!doctype html><html><head><script type="application/json">{"files":["catalog.pdf"]}</script></head><body>Print studio</body></html>'],
    ["nextjs", "app/page.tsx", "export default function Page() { return <main>Print studio</main>; }"],
  ]) {
    const { adapter } = mockedProvider(raw);
    const result = await generateCode(adapter, analysis, plan, "", framework, "fast");
    assert.equal(result.entryPath, path);
    assert.equal(result.files?.length, 1);
    assert.doesNotMatch(result.code, /^```/);
  }
});

test("structured React and Next.js manifests preserve supported component and browser-source boundaries", async () => {
  for (const [framework, entry] of [["react", "src/App.tsx"], ["nextjs", "app/page.tsx"]]) {
    const { adapter } = mockedProvider(JSON.stringify({ files: [
      source(entry, "export default function App() { return <main>Print studio</main>; }"),
      source("components/Inspector.tsx", "export default function Inspector() { return <button>Inspect</button>; }"),
      source("src/styles/inspector.css", "button { color: #111; }"),
      source("src/utils/format.js", "export const format = (value) => value;"),
    ] }));
    const result = await generateCode(adapter, analysis, plan, "", framework, "fast");
    assert.equal(result.entryPath, entry);
    assert.equal(result.files?.length, 4);
  }
});

test("React and Next.js source delivery supports safe nested TypeScript helpers without allowing engine scaffold overrides", async () => {
  for (const [framework, entry] of [["react", "src/App.tsx"], ["nextjs", "app/page.tsx"]]) {
    const files = [
      source(entry, 'import { value } from "../lib/model"; export default function App() { return <main>{value}</main>; }'),
      source("lib/model.ts", 'export const value: string = "Print studio";'),
      source("app/data/products.ts", "export const products: string[] = [];"),
      source("src/hooks/useSelection.ts", "export const selected: boolean = false;"),
      source("components/inspection/Inspector.tsx", "export default function Inspector() { return <button>Inspect</button>; }"),
      source("src/components/controls/Choice.tsx", "export default function Choice() { return <button>Choose</button>; }"),
    ];
    const { adapter } = mockedProvider(JSON.stringify({ files }));
    const result = await generateCode(adapter, analysis, plan, "", framework, "fast");
    assert.deepEqual(result.files?.map((file) => file.path), files.map((file) => file.path));
    assert.equal(result.files?.find((file) => file.path === "lib/model.ts")?.language, "typescript");
    assert.equal(result.files?.find((file) => file.path.endsWith("Inspector.tsx"))?.language, "tsx");
    for (const path of ["app/layout.tsx", "src/main.tsx", "src/main.ts", "lib/next.config.ts", "src/.hidden/model.ts", "lib/../model.ts"]) {
      const { adapter: invalid } = mockedProvider(JSON.stringify({ files: [files[0], source(path, "export const unsafe = true;")] }));
      await assert.rejects(generateCode(invalid, analysis, plan, "", framework, "fast"), GeneratedSourceDeliveryError, `${framework}: ${path}`);
    }
  }
});

test("HTML manifests reject TypeScript and TSX helper files because browsers have no transpilation step", async () => {
  for (const path of ["app/data/products.ts", "src/model.ts", "lib/model.ts", "components/Inspector.tsx", "src/App.tsx", "app/page.tsx"]) {
    await assert.rejects(generated([source("index.html", entrySource), source(path, "export const amount: number = 10;")]), GeneratedSourceDeliveryError, path);
  }
});

test("React and Next.js manifests reject cross-framework HTML pages and React scaffold overrides", async () => {
  for (const [framework, entry] of [["react", "src/App.tsx"], ["nextjs", "app/page.tsx"]]) {
    for (const path of ["index.html", "compare/index.html", "compare.html", "content/project.html"]) {
      const { adapter } = mockedProvider(JSON.stringify({ files: [
        source(entry, "export default function App() { return <main>Print studio</main>; }"),
        source(path, "<!doctype html><html><body>Undeclared page</body></html>"),
      ] }));
      await assert.rejects(generateCode(adapter, analysis, plan, "", framework, "fast"), GeneratedSourceDeliveryError, `${framework}: ${path}`);
    }
  }
});

test("project specifications cannot expand the Fast file budget", async () => {
  const { buildVerveProjectSpec } = await import("../lib/engine/project-spec-builder");
  const projectSpec: VerveProjectSpec = buildVerveProjectSpec({
    analysis, plan, framework: "html", mode: "fast",
    assetBundle: {
      photos: [], icons: [], extractedPalette: [], warnings: [], readinessWarnings: [], assetSummary: "No approved media.",
      font: { family: "Arial", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
      mediaRequirement: { level: "recommended", minimumAssets: 0, reason: "Optional evidence", suggestedSubjects: [] },
    },
  });
  projectSpec.complexity.maxSourceFiles = 16;
  const { adapter, calls } = mockedProvider(JSON.stringify({ files: [source("index.html", entrySource)] }));
  await generateCode(adapter, analysis, plan, "", "html", "fast", projectSpec);
  const schema = calls[0].responseFormat?.schema as { properties: { files: { maxItems: number } } };
  assert.equal(schema.properties.files.maxItems, 8);
});

test("a single declared route explicitly forbids invented comparison pages even when older plan prose suggests one", async () => {
  const { buildVerveProjectSpec } = await import("../lib/engine/project-spec-builder");
  const legacyPlan = { ...plan, layoutConcept: `${plan.layoutConcept}\nLegacy checkpoint: consider an additional /compare page.` };
  const projectSpec = buildVerveProjectSpec({
    analysis, plan: legacyPlan, framework: "html", mode: "fast",
    assetBundle: {
      photos: [], icons: [], extractedPalette: [], warnings: [], readinessWarnings: [], assetSummary: "No approved media.",
      font: { family: "Arial", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
      mediaRequirement: { level: "recommended", minimumAssets: 0, reason: "Optional evidence", suggestedSubjects: [] },
    },
  });
  projectSpec.experience.routes = projectSpec.experience.routes.filter((route) => route.path === "/");
  assert.equal(projectSpec.experience.routes.length, 1);
  const { adapter, calls } = mockedProvider(JSON.stringify({ files: [source("index.html", entrySource)] }));
  await generateCode(adapter, analysis, legacyPlan, "", "html", "fast", projectSpec);
  const prompt = calls[0].systemPrompt ?? "";
  assert.match(prompt, /Implement all and ONLY the declared page routes/);
  assert.match(prompt, /Declared page routes \(exclusive\): \["\/"\]/);
  assert.match(prompt, /budgets are ceilings, not quotas/);
  assert.match(prompt, /Never add an automatic comparison page; \/compare is permitted only when it is already in the declared page routes/);
  assert.match(prompt, /Older plan prose or checkpoint notes cannot authorize an undeclared route/);
});
