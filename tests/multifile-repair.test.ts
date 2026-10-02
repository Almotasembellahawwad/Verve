import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDesignPlanLocally } from "../lib/engine/fast-path";
import { inspectSupportingSource, runCodeQualityLoop } from "../lib/engine/code-quality-loop";
import type { CodeQualityContext } from "../lib/engine/code-quality-loop";
import type { GeneratedSourceFile } from "../lib/engine/code-generator";
import { buildGeneratedProject } from "../lib/project/project-builder";
import type { LLMAdapter, LLMMessage, LLMOptions } from "../lib/ports/llm";

const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="./styles.css"><script src="./app.js" defer></script></head><body><main><h1 data-verve-task="primary-object">Print studio</h1><p data-verve-task="decision-evidence">Choose an ordering path</p><button id="inspect" type="button" data-verve-primary-action>Inspect specifications</button><output id="selection">No selection</output></main></body></html>';
const css = "body { margin: 0; color: #111; background: #fff; } button:focus-visible { outline: 3px solid #111; }";
const js = 'document.querySelector("#inspect").addEventListener("click", () => { document.querySelector("#selection").textContent = "Specifications selected"; });';
const analysis = analyzeBriefLocally("An independent print studio. Compare verified paper specifications and choose a wholesale or individual ordering path.");
const plan = generateDesignPlanLocally(analysis);

function source(path: string, content: string): GeneratedSourceFile {
  return { path, content, language: path.endsWith(".html") ? "html" : path.endsWith(".css") ? "css" : "javascript" };
}

function mockProvider(response: string | Error) {
  const calls: { messages: LLMMessage[]; options?: LLMOptions }[] = [];
  const llm: LLMAdapter = {
    async complete(messages, options) {
      calls.push({ messages, options });
      if (response instanceof Error) throw response;
      return response;
    },
  };
  return { llm, calls };
}

function context(files: GeneratedSourceFile[]): CodeQualityContext {
  return { sourceFiles: files, entryPath: "index.html", maxSourceFiles: 8 };
}

test("Creative repair restores a missing app.js through one complete manifest without losing the stylesheet", async () => {
  const original = [source("index.html", html), source("styles.css", css)];
  const repaired = [...original, source("app.js", js)];
  const { llm, calls } = mockProvider(JSON.stringify({ files: repaired }));
  const result = await runCodeQualityLoop(llm, html, "", "html", true, analysis.rawBrief, [], context(original));

  assert.equal(calls.length, 1);
  assert.match(calls[0].messages[0].content, /Unresolved source dependency: index\.html -> \.\/app\.js/);
  assert.match(calls[0].messages[0].content, /complete source manifest/);
  assert.equal(calls[0].options?.responseFormat?.name, "repaired_project_sources");
  assert.equal(result.wasRepaired, true);
  assert.equal(result.repairAttempted, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.code, html);
  assert.deepEqual(result.files, repaired);
  assert.equal(result.files?.find((file) => file.path === "styles.css")?.content, css);
});

test("HTML JavaScript syntax validation rejects TypeScript annotations in actual .js and .mjs files", async () => {
  for (const path of ["app.js", "app.mjs"]) {
    const problems = inspectSupportingSource("const amount: number = 10;", path, "html");
    assert.ok(problems.some((problem) => problem.includes("Type annotations can only be used in TypeScript files")), path);
  }
  const files = [source("index.html", html), source("styles.css", css), source("app.js", "const amount: number = 10;")];
  const { llm, calls } = mockProvider(new Error("A local-only validation must not call a provider"));
  const result = await runCodeQualityLoop(llm, html, "", "html", false, analysis.rawBrief, [], context(files));
  assert.equal(calls.length, 0);
  assert.equal(result.wasRepaired, false);
  assert.ok(result.issues.some((issue) => issue.includes("app.js: Syntax error") && issue.includes("Type annotations")));
});

test("malformed, unsafe, over-budget, and dropped-support repair manifests retain the original draft", async () => {
  const original = [source("index.html", html), source("styles.css", css)];
  const responses = [
    '{"files":',
    JSON.stringify({ files: [source("index.html", html), source("app.js", js)] }),
    JSON.stringify({ files: [...original, source("../app.js", js)] }),
    JSON.stringify({ files: [...original, ...Array.from({ length: 7 }, (_, index) => source(`scripts/module-${index}.js`, "export const ready = true;"))] }),
    html,
  ];
  for (const response of responses) {
    const saved = structuredClone(original);
    const { llm, calls } = mockProvider(response);
    const result = await runCodeQualityLoop(llm, html, "", "html", true, analysis.rawBrief, [], context(original));
    assert.equal(calls.length, 1);
    assert.equal(result.code, html);
    assert.equal(result.wasRepaired, false);
    assert.equal(result.repairAttempted, true, "a rejected repair still consumes the optional repair call");
    assert.equal(result.files, undefined, "the caller retains its untouched original source files");
    assert.ok(result.issues.some((issue) => issue.includes("app.js")));
    assert.deepEqual(original, saved);
  }
});

test("a partially successful full-project repair reports remaining supporting issues", async () => {
  const missingDoctype = html.replace("<!doctype html>", "");
  const badScript = source("app.js", "const amount: number = 10;");
  const original = [source("index.html", missingDoctype), source("styles.css", css), badScript];
  const partial = [source("index.html", html), source("styles.css", css), badScript];
  const { llm, calls } = mockProvider(JSON.stringify({ files: partial }));
  const result = await runCodeQualityLoop(llm, missingDoctype, "", "html", true, analysis.rawBrief, [], context(original));
  assert.equal(calls.length, 1);
  assert.equal(result.wasRepaired, true);
  assert.equal(result.repairAttempted, true);
  assert.deepEqual(result.files, partial);
  assert.ok(result.issues.some((issue) => issue.includes("app.js: Syntax error")));
  assert.ok(result.issues.every((issue) => !issue.includes("Missing <!DOCTYPE")), "fixed issues must not masquerade as unresolved diagnostics");

  const project = buildGeneratedProject({ code: result.code, framework: "html", componentName: "PrintStudio", imports: [], setupNotes: "", entryPath: "index.html", files: result.files }, analysis, plan, result.issues);
  assert.ok(project.warnings.some((warning) => warning.includes("app.js: Syntax error")), "an accepted entry repair must not suppress supporting errors during assembly");
  assert.equal(project.readiness.status, "blocked");
});

test("Fast local preflight detects missing scripts and transitive CSS imports without spending a repair call", async () => {
  const original = [source("index.html", html), source("styles.css", `@import "./theme.css"; ${css}`)];
  const { llm, calls } = mockProvider(new Error("Fast mode must not call a repair model"));
  const result = await runCodeQualityLoop(llm, html, "", "html", false, analysis.rawBrief, [], context(original));
  assert.equal(calls.length, 0);
  assert.equal(result.wasRepaired, false);
  assert.notEqual(result.repairAttempted, true);
  assert.ok(result.issues.some((issue) => issue.includes("index.html -> ./app.js")));
  assert.ok(result.issues.some((issue) => issue.includes("styles.css -> ./theme.css")));
});

test("a failed or no-op repair records the consumed attempt so a diversity retry cannot spend the same allowance twice", async () => {
  const original = [source("index.html", html), source("styles.css", css)];
  for (const response of [new Error("Provider unavailable"), JSON.stringify({ files: original })]) {
    const { llm, calls } = mockProvider(response);
    const result = await runCodeQualityLoop(llm, html, "", "html", true, analysis.rawBrief, [], context(original));
    assert.equal(calls.length, 1);
    assert.equal(result.wasRepaired, false);
    assert.equal(result.repairAttempted, true);
    assert.ok(result.issues.some((issue) => issue.includes("app.js")));
  }
});

test("a clean complete HTML source graph needs no repair call", async () => {
  const original = [source("index.html", html), source("styles.css", css), source("app.js", js)];
  const { llm, calls } = mockProvider(new Error("An already-valid project must not call a provider"));
  const result = await runCodeQualityLoop(llm, html, "", "html", true, analysis.rawBrief, [], context(original));
  assert.equal(calls.length, 0);
  assert.equal(result.wasRepaired, false);
  assert.notEqual(result.repairAttempted, true);
  assert.deepEqual(result.issues, []);
});

test("an undeclared compare page is rejected, and a complete repair may remove only that page", async () => {
  const original = [source("index.html", html), source("styles.css", css), source("app.js", js), source("compare/index.html", html.replaceAll("./styles.css", "../styles.css").replaceAll("./app.js", "../app.js"))];
  const ctx = { ...context(original), declaredRoutePaths: ["/"] };
  const repaired = original.filter((file) => file.path !== "compare/index.html");
  const { llm, calls } = mockProvider(JSON.stringify({ files: repaired }));
  const result = await runCodeQualityLoop(llm, html, "", "html", true, analysis.rawBrief, [], ctx);
  assert.equal(calls.length, 1);
  assert.match(calls[0].messages[0].content, /Undeclared page route: \/compare/);
  assert.equal(result.wasRepaired, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.files?.map((file) => file.path), ["index.html", "styles.css", "app.js"]);

  const destructive = mockProvider(JSON.stringify({ files: repaired.filter((file) => file.path !== "styles.css") }));
  const rejected = await runCodeQualityLoop(destructive.llm, html, "", "html", true, analysis.rawBrief, [], ctx);
  assert.equal(rejected.wasRepaired, false);
  assert.equal(rejected.repairAttempted, true);
  assert.ok(rejected.issues.some((issue) => issue.includes("Undeclared page route")));
});
