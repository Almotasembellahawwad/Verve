import test from "node:test";
import assert from "node:assert/strict";
import { getAllCliches, runBlocklistFilter } from "../lib/engine/blocklist-filter";
import { fixPaletteContrast } from "../lib/engine/contrast-fixer";
import { extractJSON } from "../lib/engine/llm-utils";
import { runCodeQualityLoop } from "../lib/engine/code-quality-loop";
import { PROVIDER_MODELS } from "../lib/llm-adapter/types";
import { fetchPublicDesignSource } from "../lib/security/safe-url";
import type { LLMAdapter } from "../lib/llm-adapter/types";
import { buildGeneratedProject, buildRecoveryProject, inspectProductionRisks } from "../lib/project/project-builder";
import type { BriefAnalysis } from "../lib/engine/brief-analyzer";
import type { DesignPlan } from "../lib/engine/plan-generator";
import { validateGeneratedProject } from "../lib/project/project-validator";
import { mergeEditorFiles } from "../lib/project/editor-project";

test("the public blocklist has truthful family and signal counts", () => {
  const data = getAllCliches();
  assert.equal(data.cliches.length, 21);
  assert.equal(data.cliches.reduce((sum, entry) => sum + entry.example_values.length, 0), 67);
});

test("blocklist scans the delivered code content", () => {
  const result = runBlocklistFilter('<section style="background: linear-gradient(#6366F1, #8B5CF6)">');
  assert.ok(result.matches.length > 0);
});

test("JSON extraction skips an earlier malformed brace pair", () => {
  assert.deepEqual(extractJSON<{ ok: boolean }>('noise {not-json} then {"ok":true}'), { ok: true });
});

test("palette correction applies one stable text token across dark surfaces", () => {
  const result = fixPaletteContrast([
    { name: "Void", hex: "#080808", role: "background" },
    { name: "Panel", hex: "#202020", role: "surface" },
    { name: "Copy", hex: "#555555", role: "text" },
  ]);
  const copy = result.fixedPalette.find((color) => color.name === "Copy");
  assert.notEqual(copy?.hex.toLowerCase(), "#555555");
  assert.equal(result.report.fixesApplied, 1);
  assert.equal(result.report.allPass, true);
  assert.ok(result.report.checked.every((check) => check.ratio >= 4.5 && check.passesAA));
});

test("code quality loop uses syntax diagnostics and accepts a valid repair", async () => {
  const fakeAdapter: LLMAdapter = {
    async complete() {
      return "export default function Demo() { return <main>Repaired</main>; }";
    },
  };
  const result = await runCodeQualityLoop(
    fakeAdapter,
    "export default function Demo() { return <main><div>Broken</main>; }",
    "",
    "react"
  );
  assert.equal(result.wasRepaired, true);
  assert.match(result.code, /<main>Repaired<\/main>/);
  assert.ok(result.issues.some((issue) => issue.includes("Syntax error") || issue.includes("Unclosed")));
});

test("provider registry contains no retired model IDs", () => {
  const ids = Object.values(PROVIDER_MODELS).flat().map((model) => model.id);
  for (const retired of [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ]) {
    assert.equal(ids.includes(retired), false);
  }
  assert.ok(ids.includes("openrouter/free"));
});

test("URL critic rejects insecure and private-network targets before fetching", async () => {
  await assert.rejects(() => fetchPublicDesignSource("http://example.com"), /public HTTPS/);
  await assert.rejects(() => fetchPublicDesignSource("https://127.0.0.1"), /private network/);
});

test("project engine assembles a runnable Next.js file contract", () => {
  const analysis = {
    subject: "Precision Architecture Studio",
    audience: "Property developers",
    primaryJob: "Book a consultation",
    tone: "measured and architectural",
    industry: "Architecture",
    constraints: [],
    rawBrief: "Architecture studio",
  } as BriefAnalysis;
  const plan = {
    colorPalette: [
      { name: "Ink", hex: "#111111", role: "background" },
      { name: "Paper", hex: "#f5f2ea", role: "text" },
      { name: "Signal", hex: "#ff5a36", role: "accent" },
    ],
    typePairing: { display: "Arial", body: "Arial", rationale: "System reliability" },
    layoutConcept: "A clear editorial sequence with an intentional closing consultation section.",
    signatureElement: { name: "Measured edge", description: "A single calibrated edge.", implementation: "CSS border", justification: "Fits architectural precision." },
    referencesSampled: [],
  } as unknown as DesignPlan;
  const project = buildGeneratedProject(
    {
      framework: "nextjs",
      componentName: "StudioPage",
      imports: [],
      setupNotes: "",
      code: "export default function StudioPage() { return <main><h1>Studio</h1></main>; }",
    },
    analysis,
    plan
  );

  const paths = project.files.map((entry) => entry.path);
  assert.ok(paths.includes("app/page.tsx"));
  assert.ok(paths.includes("app/layout.tsx"));
  assert.ok(paths.includes("package.json"));
  assert.ok(paths.includes("tsconfig.json"));
  assert.ok(paths.includes("README.md"));
  assert.equal(project.entryFile, "app/page.tsx");
  assert.equal(project.readiness.status, "review-required");
  assert.ok(project.warnings.some((warning) => warning.includes("Reduced-motion")));
});

test("project risk scan rejects deceptive form behavior", () => {
  const warnings = inspectProductionRisks(`<form><button>Send</button></form><script>alert('Success — sent')</script>`);
  assert.ok(warnings.some((warning) => warning.includes("submission contract")));
  assert.ok(warnings.some((warning) => warning.includes("simulated")));
});

test("Fast mode validation never spends an extra repair call", async () => {
  let calls = 0;
  const fakeAdapter: LLMAdapter = { async complete() { calls++; return "export default function App() { return <main />; }"; } };
  const result = await runCodeQualityLoop(fakeAdapter, "function App() { return <main />; }", "", "react", false);
  assert.equal(calls, 0);
  assert.equal(result.wasRepaired, false);
  assert.ok(result.issues.some((issue) => issue.includes("default export")));
});

test("provider recovery always yields a previewable project", () => {
  const project = buildRecoveryProject("A studio portfolio with a real contact path", "nextjs", "05");
  assert.equal(project.framework, "html");
  assert.equal(project.entryFile, "index.html");
  assert.equal(project.readiness.status, "review-required");
  assert.match(project.files[0].content, /Generation can resume/);
});

test("project validator blocks broken imports, anchors, and forms", () => {
  const recovery = buildRecoveryProject("Validation fixture project", "html", "test");
  const project = {
    ...recovery,
    files: [{
      ...recovery.files[0],
      content: `<!doctype html><html><body><a href="#missing">Go</a><form><button>Send</button></form><script type="module">import x from './missing.js'; import route from 'react-router-dom'; console.log(x, route)</script></body></html>`,
    }],
  };
  const validation = validateGeneratedProject(project);
  assert.equal(validation.status, "blocked");
  assert.ok(validation.checks.some((item) => item.id === "relative-imports" && item.status === "fail"));
  assert.ok(validation.checks.some((item) => item.id === "dependencies" && item.status === "fail"));
  assert.ok(validation.checks.some((item) => item.id === "anchors" && item.status === "fail"));
  assert.ok(validation.checks.some((item) => item.id === "forms" && item.status === "fail"));
});

test("project validator reads reduced-motion policy from stylesheet files", () => {
  const recovery = buildRecoveryProject("Motion policy project", "html", "test");
  const project = {
    ...recovery,
    files: [
      recovery.files[0],
      { path: "styles.css", content: "@media (prefers-reduced-motion: reduce) { * { animation: none; } }", language: "css" as const, role: "source" as const },
    ],
  };
  const validation = validateGeneratedProject(project);
  assert.ok(validation.checks.some((item) => item.id === "reduced-motion" && item.status === "pass"));
});

test("ZIP project source follows the live editor state", () => {
  const project = buildRecoveryProject("Editable recovery project", "html", "test");
  const edited = mergeEditorFiles(project, {
    "/index.html": { code: "<!doctype html><html><body>Edited and exported</body></html>" },
  });
  assert.match(edited.files.find((file) => file.path === "index.html")?.content ?? "", /Edited and exported/);
  assert.notEqual(edited.files[0].content, project.files[0].content);
});
