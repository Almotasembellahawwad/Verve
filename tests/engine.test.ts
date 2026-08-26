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
import { runOptionalProviderStep } from "../lib/engine/provider-resilience";
import { readWithInactivityTimeout, StreamInactivityError } from "../lib/client/generation-stream";
import { runSelfCritique } from "../lib/engine/critique-loop";
import type { CritiqueResult } from "../lib/engine/critique-loop";
import { generateDistinctivenessReport } from "../lib/engine/scorer";
import { scoreEngineering } from "../lib/engine/engineering-score";
import { critiquePlanLocally, resolveArchetypeLocally } from "../lib/engine/fast-path";
import { runRestraintCheck } from "../lib/engine/restraint-check";

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

test("blocklist does not infer a compound visual cliché from two generic CSS words", () => {
  const result = runBlocklistFilter(".hero-heading { font-weight: 700; }");
  assert.equal(result.matches.some((match) => match.id === "type-002"), false);
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

test("static HTML projects ship truthful no-build instructions", () => {
  const analysis = {
    subject: "Static studio",
    audience: "Clients",
    primaryJob: "Review work",
    tone: "Measured",
    industry: "Architecture",
    constraints: [],
    rawBrief: "Static architecture portfolio",
  } as BriefAnalysis;
  const plan = {
    colorPalette: [{ name: "Ink", hex: "#111111", role: "background" }],
    typePairing: { display: "Arial", body: "Arial", rationale: "Reliable system typography." },
    layoutConcept: "A measured portfolio register with a direct closing contact path.",
    signatureElement: { name: "Register", description: "A project register.", implementation: "Semantic list.", justification: "Connects work to evidence." },
    referencesSampled: [],
  } as unknown as DesignPlan;
  const project = buildGeneratedProject(
    {
      framework: "html",
      componentName: "StaticPage",
      imports: [],
      setupNotes: "",
      code: "<!doctype html><html><body><main><h1>Studio</h1></main><style>@media (prefers-reduced-motion: reduce) { * { animation: none; } }</style></body></html>",
    },
    analysis,
    plan
  );
  const readme = project.files.find((entry) => entry.path === "README.md")?.content ?? "";
  assert.equal(Object.keys(project.scripts).length, 0);
  assert.doesNotMatch(readme, /npm install|npm run dev/);
  assert.match(readme, /Open `index\.html` directly/);
  assert.match(readme, /npx --yes serve \./);
});

test("engineering checks distinguish fluid CSS and accessibility policy from real debt", () => {
  const code = `<main><h1>Fluid</h1></main><style>
    .shell { width: min(1440px, calc(100% - 48px)); max-width: 780px; }
    @media (max-width: 700px) { .shell { width: 100%; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  </style>`;
  const result = scoreEngineering(code, "html");
  const responsive = result.dimensions.find((dimension) => dimension.id === "responsive");
  const css = result.dimensions.find((dimension) => dimension.id === "css");
  assert.equal(responsive?.flags.includes("fixed large pixel width (breaks mobile)"), false);
  assert.equal(css?.flags.includes("!important overrides outside reduced-motion policy"), false);

  const fixed = scoreEngineering("<style>.shell { width: 1200px; }</style>", "html");
  assert.ok(fixed.dimensions.find((dimension) => dimension.id === "responsive")?.flags.includes("fixed large pixel width (breaks mobile)"));

  const replacedFocus = scoreEngineering("<button>Open</button><style>button { outline: none; } button:focus-visible { outline: 2px solid currentColor; }</style>", "html");
  assert.equal(replacedFocus.dimensions.find((dimension) => dimension.id === "a11y")?.flags.includes("focus outline removed without a visible replacement"), false);

  const missingFocus = scoreEngineering("<button>Open</button><style>button { outline: 0; }</style>", "html");
  assert.ok(missingFocus.dimensions.find((dimension) => dimension.id === "a11y")?.flags.includes("focus outline removed without a visible replacement"));
});

test("Fast evidence cannot turn a blocked visual result into an S grade", () => {
  const analysis = {
    subject: "Luxury interior design studio",
    audience: "Hotel developers",
    primaryJob: "Book a consultation",
    tone: "Quiet and exacting",
    industry: "Interior Design",
    constraints: [],
    rawBrief: "Abu Dhabi luxury interiors",
  } as BriefAnalysis;
  const plan = {
    colorPalette: [
      { name: "Cream", hex: "#F4F1EA", role: "background" },
      { name: "Ink", hex: "#111111", role: "text" },
      { name: "Stone", hex: "#665f55", role: "accent" },
    ],
    typePairing: { display: "Georgia", body: "Arial", rationale: "Editorial contrast for hospitality decision makers." },
    layoutConcept: "A long material register connects residential and hospitality evidence to one consultation threshold at the end of the page.",
    signatureElement: {
      name: "The Material Datum",
      description: "A single measured line joining project evidence.",
      implementation: "One semantic list with a responsive CSS rule.",
      justification: "It turns the studio's material decisions into a navigable project argument instead of a decorative gallery motif.",
    },
    referencesSampled: [],
    cognitiveGrounding: {
      vonRestorffCompliance: "The datum is isolated through spacing and one contrasting rule while all other sections remain quiet.",
      gutenbergCompliance: "The consultation action closes the reading path.",
      signalNoiseRatio: 0.8,
      peakEndDesign: "The material line resolves into the consultation action.",
      usabilityBaseline: "AA contrast and 44px controls.",
    },
    rawPlan: "fixture",
  } as DesignPlan;
  const critique = critiquePlanLocally(plan);
  const archetype = resolveArchetypeLocally(analysis);
  const report = generateDistinctivenessReport(runBlocklistFilter("#F4F1EA"), plan, critique, 0, archetype);
  assert.ok(report.score <= 84);
  assert.notEqual(report.grade, "S");
  assert.ok(report.normanLevels.reflective.score <= 84);
  assert.equal(report.archetypeCoherence, 68);
  assert.deepEqual(report.clichesAvoided, []);
  assert.match(report.critiqueSummary, /blocked visual pattern/);

  const restraint = runRestraintCheck(plan);
  assert.doesNotMatch(restraint.reasoning, /The The Material Datum/);
  assert.match(restraint.reasoning, /The Material Datum is purposeful/);
});

test("a rejected adversarial review cannot produce a 100 distinctiveness score", () => {
  const plan = {
    colorPalette: [{ name: "Zinc", hex: "#777777", role: "background" }],
    typePairing: { display: "Clash Display", body: "Arial", rationale: "Common editorial pairing." },
    layoutConcept: "A conventional editorial portfolio sequence.",
    signatureElement: {
      name: "Occupation Hinge",
      description: "An interactive project index.",
      implementation: "SVG and CSS.",
      justification: "A long explanation that exceeds eighty characters but should not earn credit after the critic explicitly rejects the signature element as generic.",
    },
    referencesSampled: [],
    cognitiveGrounding: {
      vonRestorffCompliance: "The hinge is isolated in a long, detailed visual explanation that is not evidence of originality.",
      gutenbergCompliance: "Primary and terminal areas are clear.",
      signalNoiseRatio: 0.8,
      peakEndDesign: "A direct ending.",
      usabilityBaseline: "AA contrast and usable controls.",
    },
    rawPlan: "fixture",
  } as DesignPlan;
  const critique = {
    passed: false,
    genericElementCount: 5,
    flaggedElements: [
      { element: "Weathered Zinc", reason: "Common material cue", severity: "high" },
      { element: "Clash Display", reason: "Common type choice", severity: "high" },
      { element: "Horizontal reading plan", reason: "Conventional", severity: "high" },
      { element: "Occupation Hinge", reason: "Generic signature", severity: "high" },
      { element: "Conventional hero", reason: "Expected", severity: "high" },
    ],
    positiveElements: ["Clear hierarchy", "Usable controls"],
    overallVerdict: "A generic model could produce most of this plan.",
    endingCheck: { quality: "strong", description: "Clear ending", recommendation: "Keep" },
    usabilityFloor: { passed: true, contrastOk: true, touchTargetsOk: true, bodyTextOk: true, issues: [] },
    cognitiveScore: 25,
    cognitiveFailures: [],
    rawCritique: "Rejected for generic visual decisions.",
  } as CritiqueResult;
  const report = generateDistinctivenessReport(runBlocklistFilter(""), plan, critique, 2);
  assert.ok(report.score <= 49);
  assert.ok(report.normanLevels.visceral.score <= 44);
  assert.notEqual(report.normanLevels.reflective.score, 100);
  assert.match(report.normanSummary, /Weakest level/);
});

test("Fast mode validation never spends an extra repair call", async () => {
  let calls = 0;
  const fakeAdapter: LLMAdapter = { async complete() { calls++; return "export default function App() { return <main />; }"; } };
  const result = await runCodeQualityLoop(fakeAdapter, "function App() { return <main />; }", "", "react", false);
  assert.equal(calls, 0);
  assert.equal(result.wasRepaired, false);
  assert.ok(result.issues.some((issue) => issue.includes("default export")));
});

test("code validation reports unsafe DOM APIs and runtime font imports", async () => {
  const fakeAdapter: LLMAdapter = { async complete() { throw new Error("repair must remain disabled"); } };
  const result = await runCodeQualityLoop(
    fakeAdapter,
    `<!doctype html><html><body><main id="app"></main><style>@import url('https://api.fontshare.com/v2/css?family=test');</style><script>document.querySelector('#app').innerHTML = '<p>Unsafe</p>';</script></body></html>`,
    "",
    "html",
    false
  );
  assert.ok(result.issues.some((issue) => issue.includes("Unsafe HTML injection")));
  assert.ok(result.issues.some((issue) => issue.includes("runtime font import")));
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

test("optional provider intelligence falls back instead of stopping delivery", async () => {
  const result = await runOptionalProviderStep(
    async () => { throw new Error("Provider request timed out"); },
    () => "deterministic review"
  );
  assert.equal(result.value, "deterministic review");
  assert.equal(result.degraded, true);
  assert.equal(result.reason, "timeout");
});

test("optional provider fallback never swallows user cancellation", async () => {
  const controller = new AbortController();
  controller.abort(new Error("cancelled by user"));
  await assert.rejects(
    () => runOptionalProviderStep(
      async () => { throw new Error("request aborted"); },
      () => "must not run",
      controller.signal
    ),
    /cancelled by user/
  );
});

test("Studio critique uses one bounded provider call", async () => {
  let calls = 0;
  let observedTimeout = 0;
  const fakeAdapter: LLMAdapter = {
    async complete(_messages, options) {
      calls++;
      observedTimeout = options?.timeoutMs ?? 0;
      return JSON.stringify({
        critique: { genericElementCount: 0, flaggedElements: [], positiveElements: ["Specific"], overallVerdict: "Distinct." },
        endingCheck: { quality: "intentional", description: "Purposeful close", recommendation: "Keep it." },
        usabilityFloor: { contrastOk: true, touchTargetsOk: true, bodyTextOk: true, issues: [], passed: true },
      });
    },
  };
  const plan = {
    colorPalette: [{ name: "Ink", hex: "#111111", role: "background" }],
    typePairing: { display: "Arial", body: "Arial", rationale: "Legible system typography." },
    layoutConcept: "An asymmetrical editorial path ending with one clear consultation action.",
    signatureElement: { name: "Measured edge", description: "One calibrated edge.", implementation: "CSS border", justification: "Specific to precision." },
  } as DesignPlan;
  const analysis = { subject: "Studio", primaryJob: "Book", tone: "Measured", audience: "Clients", industry: "Design", constraints: [], rawBrief: "Studio" } as BriefAnalysis;
  const result = await runSelfCritique(fakeAdapter, plan, analysis, 12_345);
  assert.equal(result.passed, true);
  assert.equal(calls, 1);
  assert.equal(observedTimeout, 12_345);
});

test("generation stream watchdog detects missed heartbeats", async () => {
  const stream = new ReadableStream<Uint8Array>({ start() {} });
  const reader = stream.getReader();
  await assert.rejects(
    () => readWithInactivityTimeout(reader, 10),
    (error: unknown) => error instanceof StreamInactivityError
  );
  await reader.cancel();
});
