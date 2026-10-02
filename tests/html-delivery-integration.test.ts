import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { buildRecoveryProject, buildGeneratedProject } from "../lib/project/project-builder";
import { buildHtmlPreviewDocument } from "../lib/project/html-preview";
import { validateGeneratedProject } from "../lib/project/project-validator";
import { inspectDeclaredSourceRoutes, inspectLocalSourceDependencies, sourcePageRoute } from "../lib/project/source-dependencies";
import { hasStaticJavaScriptModuleSyntax, resolveProjectResource, javaScriptImportReferences, rewriteJavaScriptImports } from "../lib/project/resource-paths";
import { createProjectArchive } from "../lib/client/project-archive";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDesignPlanLocally } from "../lib/engine/fast-path";
import { buildTypographyContract, applyTypographyContract } from "../lib/engine/typography-contract";
import { deliverTypographyContract } from "../lib/engine/typography-delivery";
import type { ProjectFile } from "../lib/project/types";

const source = (path: string, content: string): ProjectFile => ({ path, content, language: path.endsWith(".css") ? "css" : path.endsWith(".html") ? "html" : "javascript", role: "source" });

test("page route validation distinguishes explicit pages from support modules without filling quotas", () => {
  assert.equal(sourcePageRoute("index.html", "html"), "/");
  assert.equal(sourcePageRoute("compare/index.html", "html"), "/compare");
  assert.equal(sourcePageRoute("projects/archive.html", "html"), "/projects/archive");
  assert.equal(sourcePageRoute("app/(public)/projects/page.tsx", "nextjs"), "/projects");
  assert.equal(sourcePageRoute("scripts/compare.js", "html"), undefined);
  const files = [source("index.html", ""), source("scripts/compare.js", ""), source("compare/index.html", "")];
  assert.deepEqual(inspectDeclaredSourceRoutes(files, "html", ["/"]), ["Undeclared page route: /compare; deliver only the explicitly planned routes"]);
  assert.deepEqual(inspectDeclaredSourceRoutes(files, "html", ["/", "/compare"]), []);
  assert.deepEqual(inspectDeclaredSourceRoutes(files, "react", ["/", "/compare"]), []);
  assert.deepEqual(inspectDeclaredSourceRoutes([source("index.html", "")], "html", ["/", "/projects"]), ["Missing declared page route: /projects"]);
  assert.ok(inspectDeclaredSourceRoutes([source("app/page.tsx", ""), source("compare/index.html", "")], "nextjs", ["/"]).some((issue) => issue.includes("Wrong-framework page source")));
});

test("commented CSS imports and URLs are not dependencies, while encoded and escaping paths are checked", () => {
  assert.deepEqual(inspectLocalSourceDependencies([source("styles.css", '/* @import "./missing.css"; */ body { color: #111; }')], "html"), []);
  const files = [source("index.html", '<!doctype html><html><body><img alt="A" src="./assets/a%2Epng"><img alt="B" src="../../assets/a.png"></body></html>'),
    source("styles.css", '/* url("./missing.png") */'), { ...source("assets/a.png", "AA=="), encoding: "base64" as const, role: "asset" as const }];
  const validation = validateGeneratedProject({ ...buildRecoveryProject("Fixture", "html", "test"), files });
  const resource = validation.checks.find((check) => check.id === "local-resources");
  assert.equal(resource?.status, "fail");
  assert.match(resource!.message, /\.\.\/\.\.\/assets\/a.png/);
  assert.doesNotMatch(resource!.message, /a%2Epng|missing.png/);
});

test("an anchor cannot borrow its target from another HTML page", () => {
  const files = [source("index.html", '<!doctype html><html><body><a href="#detail">Details</a></body></html>'), source("projects/index.html", '<!doctype html><html><body><section id="detail">Details</section></body></html>')];
  const validation = validateGeneratedProject({ ...buildRecoveryProject("Fixture", "html", "test"), files });
  assert.equal(validation.checks.find((check) => check.id === "anchors")?.status, "fail");
});

test("React and Next scaffolds permit delivered JavaScript modules without a conflicting TypeScript configuration", () => {
  const analysis = analyzeBriefLocally("A private service with a working inspection tool.");
  const plan = generateDesignPlanLocally(analysis);
  for (const framework of ["react", "nextjs"] as const) {
    const entryPath = framework === "react" ? "src/App.tsx" : "app/page.tsx";
    const helper = framework === "react" ? "src/utils/model.mjs" : "app/utils/model.mjs";
    const code = 'import { title } from "./utils/model"; export default function App() { return <main>{title}</main>; }';
    const project = buildGeneratedProject({ code, framework, componentName: "Inspection", imports: [], setupNotes: "", entryPath, files: [source(entryPath, code), source(helper, 'export const title = "Inspection";')] }, analysis, plan);
    assert.equal(project.validation.checks.find((check) => check.id === "relative-imports")?.status, "pass");
    assert.equal(project.validation.checks.find((check) => check.id === "source-dependencies")?.status, "pass");
    const config = JSON.parse(project.files.find((file) => file.path === "tsconfig.json")!.content);
    assert.equal(config.compilerOptions.allowJs, true);
    assert.equal(config.compilerOptions.checkJs, false);
  }
});

test("Next aliases resolve to source files and missing aliases remain blockers", () => {
  const analysis = analyzeBriefLocally("A private service with a working inspection tool.");
  const plan = generateDesignPlanLocally(analysis);
  const code = 'import { title } from "@/lib/model"; export default function App() { return <main>{title}</main>; }';
  const files = [source("app/page.tsx", code), source("lib/model.ts", 'export const title = "Inspection";')];
  assert.deepEqual(inspectLocalSourceDependencies(files, "nextjs"), []);
  const project = buildGeneratedProject({ code, framework: "nextjs", componentName: "Inspection", imports: [], setupNotes: "", entryPath: "app/page.tsx", files }, analysis, plan);
  assert.equal(project.validation.checks.find((check) => check.id === "dependencies")?.status, "pass");
  assert.equal(project.validation.checks.find((check) => check.id === "relative-imports")?.status, "pass");
  assert.ok(inspectLocalSourceDependencies([files[0]], "nextjs").some((issue) => issue.includes("@/lib/model")));
});

test("native HTML distinguishes browser module specifiers from script src filenames and documents HTTP startup", () => {
  const files = [source("index.html", '<!doctype html><html><head><script type="module" src="app.js"></script></head><body></body></html>'), source("app.js", 'import "theme.js";'), source("theme.js", "export const color = 'red';")];
  assert.ok(inspectLocalSourceDependencies(files, "html").some((issue) => issue.startsWith("Unresolved browser module specifier")));
  files[1].content = 'import "./theme.js";';
  assert.deepEqual(inspectLocalSourceDependencies(files, "html"), []);
  const analysis = analyzeBriefLocally("A small local inspection tool.");
  const project = buildGeneratedProject({ code: files[0].content, framework: "html", componentName: "Inspection", imports: [], setupNotes: "", entryPath: "index.html", files }, analysis, generateDesignPlanLocally(analysis));
  assert.match(project.files.find((file) => file.path === "README.md")!.content, /Browser modules require HTTP rather than file:\/\//);
});

test("source dependency validation catches missing classic scripts, literal module imports and CSS imports", () => {
  const files = [source("index.html", '<!doctype html><html><head><script type="module" src="app.js"></script><link rel="stylesheet" href="styles.css"></head><body></body></html>'),
    source("app.js", "import { color } from './scripts/theme.mjs'; import('./scripts/missing.js');"),
    source("scripts/theme.mjs", "export const color = 'red';"), source("styles.css", "@import url(./theme.css);")];
  const issues = inspectLocalSourceDependencies(files, "html");
  assert.deepEqual(issues, ["Unresolved source dependency: app.js -> ./scripts/missing.js", "Unresolved source dependency: styles.css -> ./theme.css"]);
  const validation = validateGeneratedProject({ ...buildRecoveryProject("Fixture", "html", "test"), files });
  assert.equal(validation.checks.find((item) => item.id === "source-dependencies")?.status, "fail");
});

test("resource resolution preserves nested context and rejects above-root traversal", () => {
  assert.equal(resolveProjectResource("projects/index.html", "../assets/photo.png?v=1#detail"), "assets/photo.png");
  assert.equal(resolveProjectResource("index.html", "../../private.js"), null);
  assert.equal(resolveProjectResource("index.html", "https://example.com/app.js"), null);
  assert.equal(resolveProjectResource("index.html", "//example.com/app.js"), null);
  assert.deepEqual(javaScriptImportReferences("// import './fake.js'\nconst hint = \"import './fake2.js'\";\nimport {\n value\n} from './actual.js';\nimport('./dynamic.mjs');").map((item) => item.source), ["./actual.js", "./dynamic.mjs"]);
});

test("comments inside import syntax cannot conceal dependencies or escape preview rewriting", () => {
  const code = 'import /* dependency */ "./missing.js"; import(/* dependency */ "./lazy.mjs"); export /* reexport */ { value } from "./shared.js";';
  assert.deepEqual(javaScriptImportReferences(code).map((reference) => reference.source), ["./missing.js", "./lazy.mjs", "./shared.js"]);
  assert.match(rewriteJavaScriptImports(code, (path) => `https://verve-preview.invalid/${path.slice(2)}`), /import \/\* dependency \*\/ "https:\/\/verve-preview.invalid\/missing.js"/);
  assert.equal(inspectLocalSourceDependencies([source("app.js", code)], "html").length, 3);
});

test("static module syntax needs a module script, while dynamic import is allowed in classic JavaScript", () => {
  const script = source("app.js", 'import /* dependency */ { value } from "./shared.js";');
  const shared = source("shared.js", "export const value = true;");
  const classic = source("index.html", '<script src="./app.js" defer></script>');
  assert.ok(inspectLocalSourceDependencies([classic, script, shared], "html").some((issue) => issue.startsWith("Script module contract")));
  assert.deepEqual(inspectLocalSourceDependencies([source("index.html", '<script type="module" src="./app.js"></script>'), script, shared], "html"), []);
  assert.deepEqual(inspectLocalSourceDependencies([classic, source("app.js", 'import(/* lazy */ "./shared.js");'), shared], "html"), []);
  assert.equal(hasStaticJavaScriptModuleSyntax('const text = "export const fake = 0"; import("./shared.js"); const obj = {}; obj.import = true;'), false);
  assert.equal(hasStaticJavaScriptModuleSyntax("export const value = 1;"), true);
});

test("nested preview resolves module imports, media conditions and binary query URLs without mutating ZIP source", () => {
  const files = [source("index.html", "<!doctype html><html><head></head><body>Home</body></html>"),
    source("projects/index.html", '<!doctype html><html><head><link rel="stylesheet" href="../styles/main.css" media="(min-width: 2000px)"><script src="../scripts/app.js" defer></script></head><body><img src="../assets/photo.png?v=1"></body></html>'),
    source("styles/main.css", '@import url(./theme.css) layer(example) supports(display: grid) (min-width: 500px);'),
    source("styles/theme.css", "body { color: rgb(1,2,3); }"), source("scripts/app.js", 'window.ready = document.querySelector("img") !== null;'),
    { path: "assets/photo.png", content: "iVBORw0KGgo=", encoding: "base64" as const, mediaType: "image/png", language: "binary", role: "asset" as const }];
  const project = { ...buildRecoveryProject("Fixture", "html", "test"), files };
  const saved = structuredClone(project);
  const preview = buildHtmlPreviewDocument(project, "nested-source", undefined, { entryFile: "projects/index.html" });
  assert.match(preview, /media="\(min-width: 2000px\)"/);
  assert.match(preview, /@layer example/);
  assert.match(preview, /@supports \(display: grid\)/);
  assert.match(preview, /@media \(min-width: 500px\)/);
  assert.match(preview, /src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(preview, /defer src="data:text\/javascript/);
  assert.deepEqual(project, saved);
});

test("nested typography stylesheet URLs and the font validation receipt resolve from the CSS directory", async () => {
  const analysis = analyzeBriefLocally("A legal service with a confidential consultation.");
  const initial = generateDesignPlanLocally(analysis);
  const contract = buildTypographyContract(analysis, initial);
  const plan = applyTypographyContract(initial, contract);
  const typography = await deliverTypographyContract(contract, "html", async () => Buffer.from("wOF2:fixture"));
  const html = '<!doctype html><html><head><link rel="stylesheet" href="./css/theme.css"></head><body><h1>Guidance</h1></body></html>';
  const project = buildGeneratedProject({ code: html, framework: "html", componentName: "Guidance", imports: [], setupNotes: "", entryPath: "index.html", files: [source("index.html", html), source("css/theme.css", "body { font-family: var(--verve-font-body); }")] }, analysis, plan, [], [], undefined, undefined, [], contract, typography.receipt, typography.files, typography.css, typography.licenseFile);
  assert.match(project.files.find((file) => file.path === "css/theme.css")!.content, /url\("\.\.\/assets\/fonts\//);
  assert.equal(project.validation.checks.find((item) => item.id === "font-delivery")?.status, "pass");
  assert.equal(project.validation.checks.find((item) => item.id === "local-resources")?.status, "pass");
});

test("ZIP contains delivered JavaScript and only authored pages, without adding compare or preview instrumentation", async () => {
  const files = [source("index.html", '<!doctype html><html><head><link rel="stylesheet" href="styles.css"><script src="app.js" defer></script></head><body><button type="button">Inspect</button></body></html>'), source("styles.css", "body { margin: 0; }"), source("app.js", "document.querySelector('button').addEventListener('click', () => { document.title = 'Inspected'; });")];
  const project = { ...buildRecoveryProject("Fixture", "html", "test"), files };
  buildHtmlPreviewDocument(project, "zip-private-probe");
  const archive = await JSZip.loadAsync(await (await createProjectArchive(project)).arrayBuffer());
  assert.deepEqual(Object.keys(archive.files).sort(), ["app.js", "index.html", "styles.css"]);
  assert.equal(await archive.file("app.js")!.async("string"), files[2].content);
  assert.doesNotMatch(await archive.file("index.html")!.async("string"), /verve-render-probe|zip-private-probe|compare/);
});
