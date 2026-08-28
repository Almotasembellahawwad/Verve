import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { getAllCliches, runBlocklistFilter } from "../lib/engine/blocklist-filter";
import { fixPaletteContrast } from "../lib/engine/contrast-fixer";
import { extractJSON } from "../lib/engine/llm-utils";
import { runCodeQualityLoop } from "../lib/engine/code-quality-loop";
import { PROVIDER_MODELS } from "../lib/llm-adapter/types";
import { fetchPublicDesignSource } from "../lib/security/safe-url";
import type { LLMAdapter } from "../lib/llm-adapter/types";
import { buildGeneratedProject, buildRecoveryProject, inspectProductionRisks } from "../lib/project/project-builder";
import { analyzeBriefLocally, type BriefAnalysis } from "../lib/engine/brief-analyzer";
import type { DesignPlan } from "../lib/engine/plan-generator";
import { validateGeneratedProject } from "../lib/project/project-validator";
import { mergeEditorFiles } from "../lib/project/editor-project";
import { runOptionalProviderStep } from "../lib/engine/provider-resilience";
import { readWithInactivityTimeout, StreamInactivityError } from "../lib/client/generation-stream";
import { runSelfCritique } from "../lib/engine/critique-loop";
import type { CritiqueResult } from "../lib/engine/critique-loop";
import { generateDistinctivenessReport } from "../lib/engine/scorer";
import { scoreEngineering } from "../lib/engine/engineering-score";
import { critiquePlanLocally, generateDesignPlanLocally, resolveArchetypeLocally } from "../lib/engine/fast-path";
import { buildOpenRouterModelChain, openRouterDeadline } from "../lib/llm-adapter/openrouter";
import { createAdapter } from "../lib/llm-adapter";
import { runRestraintCheck } from "../lib/engine/restraint-check";
import { analyzeCompetitiveField } from "../lib/engine/competitive-field";
import { findUnsupportedQuantifiedClaims } from "../lib/engine/content-safety";
import { liveSandboxTemplate, supportsLiveSandbox } from "../lib/project/live-sandbox";
import { instrumentSandboxFiles, isRenderGateReport } from "../lib/project/render-gate";
import { buildHtmlPreviewDocument } from "../lib/project/html-preview";
import { buildFeedbackUrl, buildResultCardFilename, buildResultShareText, normalizeResultShareInput } from "../lib/share/result-share";
import {
  runGenerationUseCase,
  type PipelineEvent,
  type PipelineInput,
} from "../lib/application/run-generation-use-case";
import { createGenerationDependencies } from "../lib/adapters/composition-root";
import { CallbackProgressPublisher } from "../lib/adapters/progress/callback-progress-publisher";
import { assessMediaRequirement, buildMediaReadinessWarnings } from "../lib/engine/media-requirement";
import { sourceAssets } from "../lib/engine/asset-sourcer";
import { inspectDesignDiversity } from "../lib/engine/design-diversity";
import { attachOwnedAssets, replaceOwnedAssetReferences, type LocalOwnedAsset } from "../lib/project/brand-kit";
import { PUBLIC_DEMOS } from "../lib/demo/public-demo-gallery";
import {
  checkpointMatchesInput,
  createPipelineCheckpoint,
  isPipelineCheckpoint,
  type PipelineCheckpoint,
} from "../lib/engine/pipeline-checkpoint";
import { CircuitBreaker, CircuitOpenError } from "../lib/application/circuit-breaker";
import { createGenerationStrategy } from "../lib/application/generation-strategy";
import { executePipelineStages } from "../lib/application/pipeline-stage";
import type { BlocklistRepositoryPort } from "../lib/ports/repositories";
import { InMemoryRateLimitStore } from "../lib/adapters/rate-limit/in-memory-rate-limit-store";
import { UpstashRateLimitStore } from "../lib/adapters/rate-limit/upstash-rate-limit-store";
import { readHealthUseCase } from "../lib/application/read-health-use-case";
import { StructuredLogProgressPublisher } from "../lib/adapters/observability/structured-log-progress-publisher";
import { DEFAULT_GENERATION_MODE } from "../lib/domain/generation-mode";
import { GenerationRequestSchema } from "../lib/api/generation-request";

async function runPipeline(
  input: PipelineInput & {
    apiKey: string;
    pexelsKey?: string;
    onEvent?: (event: PipelineEvent) => void;
  }
) {
  const { apiKey, pexelsKey, onEvent, ...pipelineInput } = input;
  const provider = pipelineInput.provider ?? "anthropic";
  const progress = onEvent
    ? new CallbackProgressPublisher((event) => onEvent(event as PipelineEvent))
    : undefined;
  return runGenerationUseCase(
    { ...pipelineInput, provider },
    createGenerationDependencies({
      provider,
      apiKey,
      model: pipelineInput.model,
      pexelsKey,
      signal: pipelineInput.signal,
      progress,
    })
  );
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

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

test("blocklist rules can be supplied through a repository port", () => {
  const repository: BlocklistRepositoryPort = {
    get: () => ({
      version: "test",
      cliches: [{
        id: "custom-1",
        category: "layout",
        pattern: "Injected repository pattern",
        description: "Test rule",
        example_values: ["exact-custom-signal"],
        severity: "high",
        date_observed: "2026-08-28",
        tags: ["test"],
      }],
    }),
  };
  assert.equal(runBlocklistFilter("exact-custom-signal", undefined, repository).matches[0]?.id, "custom-1");
});

test("Fast and Studio behavior is selected by one strategy factory", () => {
  const fast = createGenerationStrategy("fast");
  const studio = createGenerationStrategy("studio");
  assert.equal(fast.emitsCheckpoints(), true);
  assert.equal(fast.allowsRevision(), false);
  assert.equal(fast.allowsCodeRepair("anthropic"), false);
  assert.equal(studio.emitsCheckpoints(), false);
  assert.equal(studio.allowsRevision(), true);
  assert.equal(studio.allowsCodeRepair("anthropic"), true);
  assert.equal(studio.allowsCodeRepair("openrouter"), false);
});

test("Fast is the shared default for application and API generation requests", () => {
  assert.equal(DEFAULT_GENERATION_MODE, "fast");
  const request = GenerationRequestSchema.parse({
    brief: "A focused product page for an operations team.",
    apiKey: "test-key",
  });
  assert.equal(request.mode, DEFAULT_GENERATION_MODE);
});

test("circuit breaker opens, fails fast, and recovers through half-open", async () => {
  let now = 0;
  let attempts = 0;
  const breaker = new CircuitBreaker("test-provider", {
    failureThreshold: 2,
    failureWindowMs: 100,
    cooldownMs: 50,
    now: () => now,
  });
  const fail = () => breaker.execute(async () => {
    attempts++;
    throw new Error("provider down");
  });
  await assert.rejects(fail, /provider down/);
  await assert.rejects(fail, /provider down/);
  await assert.rejects(fail, (error: unknown) => error instanceof CircuitOpenError);
  assert.equal(attempts, 2, "open circuit must not call the dependency");
  now = 51;
  assert.equal(await breaker.execute(async () => "recovered"), "recovered");
  assert.equal(breaker.state, "closed");
});

test("pipeline stages receive immutable snapshots and can be reordered", async () => {
  type Context = { value: number; trace: string[] };
  const increment = {
    id: "increment",
    async execute(context: Readonly<Context>) { return { value: context.value + 1, trace: [...context.trace, "increment"] }; },
  };
  const double = {
    id: "double",
    async execute(context: Readonly<Context>) { return { value: context.value * 2, trace: [...context.trace, "double"] }; },
  };
  const first = await executePipelineStages([increment, double], { value: 2, trace: [] });
  const second = await executePipelineStages([double, increment], { value: 2, trace: [] });
  assert.deepEqual(first, { value: 6, trace: ["increment", "double"] });
  assert.deepEqual(second, { value: 5, trace: ["double", "increment"] });
});

test("hexagonal dependency boundaries are mechanically enforced", () => {
  const projectRoot = process.cwd();
  for (const file of sourceFiles(join(projectRoot, "lib", "domain"))) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /\bfrom\s+["']/, `${file} must be dependency-free`);
  }
  for (const file of sourceFiles(join(projectRoot, "lib", "application"))) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\bfrom\s+["'][^"']*(?:\/adapters\/|\/llm-adapter\/|next\/)/, `${file} imports infrastructure`);
    assert.doesNotMatch(source, /process\.env/, `${file} reads runtime configuration`);
  }
  for (const file of sourceFiles(join(projectRoot, "app", "api"))) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /@\/lib\/(?:engine|project)\//, `${file} bypasses application boundaries`);
  }
  const concreteConstruction = sourceFiles(join(projectRoot, "lib"))
    .filter((file) => /new\s+(?:ClaudeAdapter|OpenAIAdapter|GeminiAdapter|OpenRouterAdapter)\b/.test(readFileSync(file, "utf8")));
  const portablePaths = concreteConstruction.map((file) => relative(projectRoot, file).replaceAll("\\", "/"));
  assert.deepEqual(portablePaths, ["lib/adapters/llm/factory.ts"]);
});

test("rate-limit store enforces windows and concurrent leases", async () => {
  const store = new InMemoryRateLimitStore();
  assert.equal((await store.consume("rate", 2, 60_000)).allowed, true);
  assert.equal((await store.consume("rate", 2, 60_000)).allowed, true);
  assert.equal((await store.consume("rate", 2, 60_000)).allowed, false);
  const first = await store.acquire("slots", 1, 60_000);
  assert.equal(first.acquired, true);
  assert.equal((await store.acquire("slots", 1, 60_000)).acquired, false);
  await store.release("slots", first.slotId);
  assert.equal((await store.acquire("slots", 1, 60_000)).acquired, true);
});

test("Upstash adapter sends an atomic EVAL command through the REST API", async () => {
  const originalFetch = globalThis.fetch;
  let command: unknown[] = [];
  globalThis.fetch = async (_input, init) => {
    command = JSON.parse(String(init?.body)) as unknown[];
    return new Response(JSON.stringify({ result: [1, 4, 0] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const decision = await new UpstashRateLimitStore("https://redis.example", "token").consume("key", 5, 60_000);
    assert.equal(decision.allowed, true);
    assert.equal(command[0], "EVAL");
    assert.equal(command[2], 1);
    assert.equal(command[3], "key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("managed deployment health fails closed without distributed admission control", () => {
  const health = readHealthUseCase({
    snapshot: () => ({
      environment: "production",
      commitSha: "abc123",
      rateLimitConfigured: false,
      isManagedDeployment: true,
    }),
  });
  assert.equal(health.status, "not-ready");
  assert.equal(health.checks.distributedRateLimit, "missing");
});

test("structured progress logs keep metrics and redact untrusted payload fields", () => {
  const originalInfo = console.info;
  let logged = "";
  console.info = (message?: unknown) => { logged = String(message); };
  try {
    new StructuredLogProgressPublisher("request-123").publish({
      event: "stage_done",
      stageId: "03",
      data: {
        id: "03",
        name: "Design Plan",
        reason: "private provider response",
        brief: "confidential launch",
        apiKey: "sk-secret",
        code: "<secret />",
        checkpoint: { private: true },
        extra: { signature: "Confidential Brand", score: 84, readiness: 91 },
      },
    });
  } finally {
    console.info = originalInfo;
  }
  assert.match(logged, /request-123/);
  assert.match(logged, /\"score\":84/);
  assert.match(logged, /\"readiness\":91/);
  assert.doesNotMatch(logged, /confidential|sk-secret|secret|checkpoint|signature/i);
});

test("every public demo is a complete, runnable native project", () => {
  assert.equal(PUBLIC_DEMOS.length, 3);
  for (const demo of PUBLIC_DEMOS) {
    assert.equal(demo.result.project.framework, "html", demo.id);
    assert.equal(demo.result.project.files.length, 4, demo.id);
    const validation = validateGeneratedProject(demo.result.project);
    assert.equal(validation.failed, 0, `${demo.id}: ${JSON.stringify(validation.checks)}`);
    assert.match(buildHtmlPreviewDocument(demo.result.project, `${demo.id}-probe`), new RegExp(`${demo.id}-probe`));
  }
});

test("result sharing publishes bounded evidence without the private brief", () => {
  const input = normalizeResultShareInput({
    projectName: "Cairo restaurant\nprivate direction",
    framework: "html",
    score: 145,
    grade: "a",
    engineeringScore: -4,
  });
  const text = buildResultShareText(input);
  assert.equal(input.score, 100);
  assert.equal(input.engineeringScore, 0);
  assert.doesNotMatch(text, /API key|Design brief/i);
  assert.match(text, /Cairo restaurant private direction/);
  assert.match(text, /verve-dev\.vercel\.app/);
  assert.equal(buildResultCardFilename("Cairo Restaurant"), "cairo-restaurant-verve-score.png");
  assert.match(buildFeedbackUrl(), /github\.com\/Almotasembellahawwad\/Verve\/issues\/new/);
});

test("OpenRouter uses one gateway-managed free fallback chain", () => {
  assert.deepEqual(buildOpenRouterModelChain("openai/gpt-oss-20b:free"), [
    "openai/gpt-oss-20b:free",
    "openrouter/free",
  ]);
  assert.deepEqual(buildOpenRouterModelChain("openrouter/free"), [
    "openrouter/free",
    "openai/gpt-oss-20b:free",
  ]);
  assert.deepEqual(buildOpenRouterModelChain("paid/model"), ["paid/model"]);
  assert.equal(openRouterDeadline(35_000), 35_000);
  assert.equal(openRouterDeadline(5_000), 15_000);
  assert.equal(openRouterDeadline(120_000), 90_000);
});

test("OpenRouter sends modern completion, fallback, reasoning, and structured-output controls", async () => {
  const originalFetch = globalThis.fetch;
  let body: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      model: "openai/gpt-oss-20b:free",
      choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const adapter = createAdapter("openrouter", "test-key", "openai/gpt-oss-20b:free");
    const output = await adapter.complete([{ role: "user", content: "Return JSON" }], {
      maxTokens: 1000,
      reasoningEffort: "low",
      responseFormat: {
        name: "fixture",
        schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
      },
    });
    assert.equal(output, '{"ok":true}');
    assert.deepEqual(body.models, ["openai/gpt-oss-20b:free", "openrouter/free"]);
    assert.equal(body.max_tokens, undefined);
    assert.equal(body.max_completion_tokens, 3000);
    assert.deepEqual(body.reasoning, { effort: "low", exclude: true });
    assert.equal((body.response_format as { type?: string }).type, "json_schema");
    assert.equal((body.provider as { require_parameters?: boolean }).require_parameters, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Fast local analysis preserves an Arabic Cairo restaurant brief", () => {
  const analysis = analyzeBriefLocally("اريد موقع لمطعم في القاهرة");
  assert.equal(analysis.industry, "Food & Hospitality");
  assert.equal(analysis.rawBrief, "اريد موقع لمطعم في القاهرة");
  assert.ok(analysis.constraints.includes("Arabic-first content with correct RTL behavior"));
  assert.ok(analysis.constraints.includes("Cairo context supplied by the brief"));

  const plan = generateDesignPlanLocally(analysis);
  assert.equal(plan.signatureElement.name, "The Table Route");
  assert.ok(plan.layoutConcept.length > 80);
  assert.ok(plan.colorPalette.length >= 3);
  assert.deepEqual(plan.referencesSampled, []);
});

test("Media Gate distinguishes image-dependent briefs from interface-led products", () => {
  const restaurant = assessMediaRequirement(analyzeBriefLocally("اريد موقع لمطعم في القاهرة"));
  assert.equal(restaurant.level, "required");
  assert.equal(restaurant.minimumAssets, 3);
  assert.match(buildMediaReadinessWarnings(restaurant, 0)[0], /^BLOCKING: Media Gate/);

  const analytics = assessMediaRequirement(analyzeBriefLocally("Analytics dashboard for engineering teams"));
  assert.equal(analytics.level, "avoid");
  assert.equal(analytics.minimumAssets, 0);
  assert.deepEqual(buildMediaReadinessWarnings(analytics, 0), []);
});

test("asset sourcing exposes a readiness gate without requiring a Pexels key", async () => {
  const assets = await sourceAssets(analyzeBriefLocally("Architecture portfolio in London"));
  assert.equal(assets.mediaRequirement.level, "required");
  assert.equal(assets.photos.length, 0);
  assert.equal(assets.readinessWarnings.length, 1);
  assert.match(assets.assetSummary, /MEDIA POLICY: REQUIRED/);
});

test("owned media satisfies the deterministic asset contract without sending binary data to the provider", async () => {
  const manifest = [{ path: "assets/dining-room.webp", url: "./assets/dining-room.webp", kind: "image" as const, mediaType: "image/webp" as const, alt: "Dining room at dusk" }];
  const assets = await sourceAssets(analyzeBriefLocally("Restaurant website in Cairo"), undefined, { name: "Maeda", colors: ["#14130F"] }, manifest);
  assert.equal(assets.photos[0]?.url, "./assets/dining-room.webp");
  assert.match(assets.assetSummary, /Brand name: Maeda/);
  assert.match(assets.assetSummary, /\.\/assets\/dining-room\.webp/);
});

test("local binary assets are attached to projects and hydrated only inside previews", () => {
  const project = buildRecoveryProject("Owned media fixture", "html", "test");
  const asset: LocalOwnedAsset = { path: "assets/room.webp", kind: "image", mediaType: "image/webp", alt: "Room", content: "AAAA", encoding: "base64", byteSize: 3 };
  const attached = attachOwnedAssets(project, [asset]);
  assert.equal(attached.files.at(-1)?.encoding, "base64");
  assert.match(replaceOwnedAssetReferences('<img src="./assets/room.webp">', attached.files), /^<img src="data:image\/webp;base64,AAAA">$/);

  const reactProject = { ...project, framework: "react" as const, files: [] };
  const reactAttached = attachOwnedAssets(reactProject, [asset]);
  assert.equal(reactAttached.files[0]?.path, "public/assets/room.webp");
  assert.match(replaceOwnedAssetReferences('<img src="/assets/room.webp">', reactAttached.files), /^<img src="data:image\/webp;base64,AAAA">$/);
});

test("Template Diversity Gate rejects Verve's repeated editorial house recipe", () => {
  const repeated = inspectDesignDiversity(`<style>.hero{min-height:100vh}.hero h1{font-size:clamp(5rem,11vw,12rem)}.hero h1 em{font-family:Georgia,serif;font-style:italic}.one{min-height:90vh}.two{min-height:90vh}.three{min-height:90vh}</style><section class="hero"><h1>One <em>phrase</em></h1></section>`);
  assert.equal(repeated.passed, false);
  assert.equal(repeated.scoreCap, 84);
  assert.ok(repeated.fingerprints.length >= 1);

  const ledger = inspectDesignDiversity(`<main class="ledger"><table><tbody><tr><td>Source</td></tr></tbody></table></main>`);
  assert.equal(ledger.passed, true);
});

test("OpenRouter Fast mode survives a failed plan call and still assembles the project", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { code: 503, message: "Provider unavailable" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      model: "openai/gpt-oss-20b:free",
      choices: [{
        finish_reason: "stop",
        message: {
          content: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مطعم في القاهرة</title><style>body{margin:0;background:#17100d;color:#fff2d8;font:16px Arial,sans-serif}main{padding:clamp(24px,8vw,96px)}a{color:#fff2d8}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></head><body><main><h1>مطعم في القاهرة</h1><p>تفاصيل القائمة والحجز قريباً.</p><a href="#contact">استفسر عن الحجز</a><section id="contact"><h2>الحجز</h2><p>بيانات التواصل قيد التحقق.</p></section></main></body></html>`,
        },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await runPipeline({
      brief: "اريد موقع لمطعم في القاهرة",
      framework: "html",
      mode: "fast",
      provider: "openrouter",
      model: "openai/gpt-oss-20b:free",
      apiKey: "test-key",
    });
    assert.equal(calls, 2, "local brief analysis must not spend an OpenRouter request");
    assert.equal(result.briefAnalysis.industry, "Food & Hospitality");
    assert.match(result.designPlan.rawPlan, /Deterministic local resilience plan/);
    assert.equal(result.project.framework, "html");
    assert.equal(result.project.readiness.status, "blocked");
    assert.ok(result.project.warnings.some((warning) => warning.includes("Media Gate requires")));
    assert.match(result.project.files.find((file) => file.path === "index.html")?.content ?? "", /مطعم في القاهرة/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pipeline checkpoints are bounded and tied to the exact local input", () => {
  const input = {
    brief: "A Cairo restaurant with Arabic-first reservations",
    framework: "html",
    mode: "fast" as const,
  };
  const analysis = analyzeBriefLocally(input.brief);
  const plan = generateDesignPlanLocally(analysis);
  const checkpoint = createPipelineCheckpoint(input, "04", analysis, plan);

  assert.equal(isPipelineCheckpoint(checkpoint), true);
  assert.equal(checkpointMatchesInput(checkpoint, input), true);
  assert.equal(checkpointMatchesInput(checkpoint, { ...input, brief: `${input.brief} changed` }), false);
  assert.equal(isPipelineCheckpoint({ ...checkpoint, completedStage: "04", designPlan: undefined }), false);
  assert.equal(isPipelineCheckpoint({ ...checkpoint, briefAnalysis: { ...analysis, subject: "x".repeat(501) } }), false);
});

test("stage 04 resume retries code generation without another model plan call", async () => {
  const originalFetch = globalThis.fetch;
  const baseInput = {
    brief: "اريد موقع لمطعم في القاهرة مع حجز واضح",
    framework: "html",
    mode: "fast" as const,
    provider: "openrouter" as const,
    model: "openai/gpt-oss-20b:free",
    apiKey: "test-key",
  };
  let calls = 0;
  let savedCheckpoint: PipelineCheckpoint | undefined;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { code: 503, message: "Provider unavailable" } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await assert.rejects(
      () => runPipeline({
        ...baseInput,
        onEvent(event) {
          if (event.event === "checkpoint" && isPipelineCheckpoint(event.data.checkpoint)) {
            savedCheckpoint = event.data.checkpoint;
          }
        },
      }),
      /Provider unavailable/
    );
    assert.equal(calls, 2, "the first run attempted plan and code");
    assert.equal(savedCheckpoint?.completedStage, "04");

    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        choices: [{
          finish_reason: "stop",
          message: {
            content: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مطعم القاهرة</title><style>body{font:16px Arial;background:#17100d;color:#fff2d8}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></head><body><main><h1>مطعم القاهرة</h1></main></body></html>`,
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const resumed = await runPipeline({ ...baseInput, checkpoint: savedCheckpoint });
    assert.equal(calls, 1, "resume must spend only the code-generation call");
    assert.equal(resumed.project.framework, "html");
    assert.match(resumed.generatedCode.code, /مطعم القاهرة/);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("Live Sandbox is limited to HTML and lightweight React", () => {
  assert.equal(supportsLiveSandbox("html"), true);
  assert.equal(supportsLiveSandbox("react"), true);
  assert.equal(supportsLiveSandbox("nextjs"), false);
  assert.equal(liveSandboxTemplate("html"), "static");
  assert.equal(liveSandboxTemplate("react"), "react");
  assert.throws(() => liveSandboxTemplate("nextjs"), /does not run full nextjs/);
});

test("native HTML preview inlines local files without mutating the exported project", () => {
  const base = buildRecoveryProject("Native HTML preview fixture", "html", "test");
  const project = {
    ...base,
    files: [
      {
        ...base.files[0],
        content: '<!doctype html><html><head><link rel="stylesheet" href="./styles.css"></head><body><main>Preview</main><script src="script.js"></script></body></html>',
      },
      { path: "styles.css", content: "main { color: tomato; }", language: "css", role: "source" as const },
      { path: "script.js", content: "window.previewReady = true;", language: "javascript", role: "source" as const },
    ],
  };
  const originalHtml = project.files[0].content;
  const preview = buildHtmlPreviewDocument(project, "native-probe");

  assert.match(preview, /data-verve-source="styles\.css"/);
  assert.match(preview, /main \{ color: tomato; \}/);
  assert.match(preview, /data-verve-source="script\.js"/);
  assert.match(preview, /window\.previewReady = true/);
  assert.match(preview, /data-verve-render-probe/);
  assert.match(preview, /native-probe/);
  assert.doesNotMatch(preview, /href="\.\/styles\.css"/);
  assert.equal(project.files[0].content, originalHtml);
});

test("Render Gate instrumentation stays ephemeral and supports HTML and React previews", () => {
  const htmlProject = buildRecoveryProject("Render probe fixture", "html", "test");
  const originalHtml = htmlProject.files[0].content;
  const htmlFiles = instrumentSandboxFiles(htmlProject, "probe-html");
  assert.match(htmlFiles["/index.html"].code, /__verve_render_probe\.js/);
  assert.match(htmlFiles["/__verve_render_probe.js"].code, /parent\.postMessage/);
  assert.equal(htmlProject.files[0].content, originalHtml);

  const reactProject = {
    ...htmlProject,
    framework: "react" as const,
    entryFile: "src/App.tsx",
    files: [
      { path: "src/main.tsx", content: "import App from './App';", language: "tsx", role: "source" as const },
      { path: "src/App.tsx", content: "export default function App(){ return <main />; }", language: "tsx", role: "source" as const },
    ],
  };
  const reactFiles = instrumentSandboxFiles(reactProject, "probe-react");
  assert.match(reactFiles["/src/main.tsx"].code, /import "\.\/__verve_render_probe"/);
  assert.match(reactFiles["/src/__verve_render_probe.js"].code, /horizontal-overflow/);
});

test("Render Gate accepts only reports for the active probe", () => {
  const report = {
    source: "verve-render-gate",
    probeId: "active",
    sequence: 1,
    viewport: { width: 360, height: 640, documentWidth: 420 },
    checks: [{ id: "horizontal-overflow", title: "Rendered mobile width", status: "fail", message: "Overflow" }],
  };
  assert.equal(isRenderGateReport(report, "active"), true);
  assert.equal(isRenderGateReport(report, "other"), false);
  assert.equal(isRenderGateReport({ ...report, checks: [{ ...report.checks[0], status: "unknown" }] }, "active"), false);
});

test("skincare subject evidence overrides a broad Personal Brand classification", () => {
  const result = analyzeCompetitiveField({
    subject: "UK skincare brand launch identity",
    audience: "UK skincare customers",
    primaryJob: "Explain product evidence",
    tone: "Warm and science-informed",
    industry: "Personal Brand",
    constraints: [],
    rawBrief: "A skincare website featuring Norwegian ingredients.",
  });
  assert.equal(result.industry, "Beauty / Skincare");
  assert.equal(result.matched, true);
  assert.ok(result.patterns.some((pattern) => pattern.pattern.includes("percentage result")));
});

test("unsupported quantified claims are blocked without treating CSS percentages as claims", async () => {
  const code = `export default function Page() { return <main><p>87% improvement in 28 days</p><style>{\`.meter { width: 92%; }\`}</style></main>; }`;
  assert.deepEqual(findUnsupportedQuantifiedClaims(code, "A clinically demonstrated skincare launch"), ["87%", "28 days"]);
  assert.deepEqual(findUnsupportedQuantifiedClaims(code, "87% improvement measured in 28 days"), []);

  const fakeAdapter: LLMAdapter = { async complete() { throw new Error("repair disabled"); } };
  const quality = await runCodeQualityLoop(fakeAdapter, code, "", "nextjs", false, "A clinically demonstrated skincare launch");
  assert.ok(quality.issues.some((issue) => issue.includes('Unsupported quantified claim "87%"')));
  assert.equal(quality.issues.some((issue) => issue.includes("92%")), false);

  const warnings = inspectProductionRisks(code, "A clinically demonstrated skincare launch");
  assert.ok(warnings.some((warning) => warning.startsWith("BLOCKING:") && warning.includes("28 days")));

  const project = buildGeneratedProject(
    { framework: "nextjs", componentName: "Page", imports: [], setupNotes: "", code },
    {
      subject: "Skincare launch",
      audience: "Customers",
      primaryJob: "Explain verified evidence",
      tone: "Warm and precise",
      industry: "Beauty / Skincare",
      constraints: [],
      rawBrief: "A clinically demonstrated skincare launch",
    },
    {
      colorPalette: [{ name: "Ink", hex: "#111111", role: "text" }],
      typePairing: { display: "ui-serif, Georgia, serif", body: "ui-sans-serif, sans-serif", rationale: "Local system stacks" },
      layoutConcept: "An evidence-led page using only verified material.",
      signatureElement: { name: "Evidence line", description: "A verified evidence line.", implementation: "CSS rule", justification: "Keeps proof explicit." },
      referencesSampled: [],
    } as unknown as DesignPlan
  );
  assert.equal(project.readiness.status, "blocked");
  assert.ok(project.readiness.score <= 45);
});

test("project validation detects clipping, weak React keys, tiny text and missing font assets", () => {
  const recovery = buildRecoveryProject("Inspection fixture", "html", "test");
  const project = {
    ...recovery,
    framework: "react" as const,
    entryFile: "src/App.tsx",
    files: [{
      path: "src/App.tsx",
      content: `export default function App(){ const rows=[{label:"Same"},{label:"Same"}]; return <main className="app-shell">{rows.map((row)=><span key={row.label}>{row.label}</span>)}<style>{\`.app-shell{overflow:hidden;font-family:"Satoshi"}.note{font-size:9px}\`}</style></main> }`,
      language: "tsx",
      role: "source" as const,
    }],
  };
  const validation = validateGeneratedProject(project);
  for (const id of ["mobile-clipping", "react-keys", "tiny-text", "font-assets"]) {
    assert.ok(validation.checks.some((item) => item.id === id && item.status === "warning"), id);
  }
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
