import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { NextRequest } from "next/server";
import { getAllCliches, runBlocklistFilter } from "../lib/engine/blocklist-filter";
import { fixPaletteContrast } from "../lib/engine/contrast-fixer";
import { extractJSON } from "../lib/engine/llm-utils";
import { inspectSupportingSource, runCodeQualityLoop } from "../lib/engine/code-quality-loop";
import { generatedSourceText } from "../lib/engine/code-generator";
import { PROVIDER_MODELS } from "../lib/llm-adapter/types";
import { fetchPublicDesignSource, normalizeFetchedDesignSource } from "../lib/security/safe-url";
import type { LLMAdapter } from "../lib/llm-adapter/types";
import { buildGeneratedProject, buildRecoveryProject, inspectProductionRisks, splitHtmlEntry } from "../lib/project/project-builder";
import { analyzeBriefLocally, type BriefAnalysis } from "../lib/engine/brief-analyzer";
import { generateDesignPlan, type DesignPlan } from "../lib/engine/plan-generator";
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
import {
  createRenderEvidenceMatrix,
  instrumentSandboxFiles,
  isRenderGateReport,
  recordRenderEvidence,
  visualFingerprintDistance,
  type RenderGateReport,
} from "../lib/project/render-gate";
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
import { checkRateLimit } from "../lib/middleware/rate-limit";
import { createEditorProjectRecord } from "../lib/client/editor-workspace";
import { DEFAULT_GENERATION_MODE } from "../lib/domain/generation-mode";
import { GenerationRequestSchema } from "../lib/api/generation-request";
import JSZip from "jszip";
import { createProjectArchive, referencedLocalAssetPaths } from "../lib/client/project-archive";
import { runProjectPatchUseCase } from "../lib/application/run-project-patch-use-case";
import { applyProjectPatchProposal, projectPatchContext } from "../lib/project/ai-patch";
import { buildVerveProjectSpec } from "../lib/engine/project-spec-builder";
import { validateVerveProjectSpec } from "../lib/domain/project-spec";
import {
  assessDirectionPortfolio,
  createFallbackDirectionPortfolio,
  enforceRecommendedDirection,
  fingerprintDirection,
} from "../lib/engine/direction-portfolio";
import { recentDesignFingerprints, rememberDesignDirection } from "../lib/domain/design-memory";
import { runGenerationFoundationStages } from "../lib/application/generation-foundation-stages";
import {
  buildOpenAIChatResponseFormat,
  buildOpenAIResponseParams,
  completedOpenAIResponseText,
} from "../lib/adapters/llm/openai";
import { ProviderResponseError } from "../lib/errors/provider-response-error";
import { classifyError } from "../lib/middleware/error-handler";
import { inferDesignStructure } from "../lib/engine/structural-fingerprint";
import type { DirectionPortfolio } from "../lib/domain/design-direction";
import { StaticReferenceLibraryRepository } from "../lib/adapters/storage/static-content-repositories";
import { classifyReferenceDomain, selectReferencePatterns } from "../lib/engine/reference-retrieval";
import { createDirectionCheckpoint, directionCheckpointMatches, generateDirectionBoard } from "../lib/engine/direction-board";

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

test("JSON extraction preserves authored code comments inside string values", () => {
  const content = "const endpoint = 'https://example.com'; // keep this\n/* keep CSS/JS comments too */";
  const fenced = `\`\`\`json\n${JSON.stringify({ content })}\n\`\`\``;
  assert.equal(extractJSON<{ content: string }>(fenced).content, content);
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

test("VerveProjectSpec creates a bounded, executable experience contract before code generation", () => {
  const analysis = analyzeBriefLocally("A Cairo architecture practice needs consultation bookings for adaptive reuse projects.");
  const plan = generateDesignPlanLocally(analysis);
  const spec = buildVerveProjectSpec({
    analysis,
    plan,
    framework: "nextjs",
    assetBundle: {
      photos: [],
      icons: [],
      font: { family: "Arial", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
      extractedPalette: [],
      mediaRequirement: { level: "recommended", minimumAssets: 0, reason: "Optional evidence", suggestedSubjects: [] },
      assetSummary: "No approved media.",
      warnings: [],
      readinessWarnings: [],
    },
  });

  assert.equal(validateVerveProjectSpec(spec).valid, true);
  assert.deepEqual(spec.responsive.viewports.map((viewport) => viewport.width), [360, 768, 1440]);
  assert.ok(spec.experience.sections.length >= 3);
  assert.ok(spec.interactions.some((interaction) => interaction.requiresExternalAdapter));
  assert.doesNotMatch(JSON.stringify(spec), /rawBrief|apiKey/);
});

test("Direction Portfolio balances quality and structural diversity without extra project generations", () => {
  const analysis = analyzeBriefLocally("An Arabic analytics product for operations teams that need a clear daily decision surface.");
  const plan = generateDesignPlanLocally(analysis);
  const portfolio = createFallbackDirectionPortfolio(plan, analysis);
  const assessment = assessDirectionPortfolio(portfolio);

  assert.equal(portfolio.candidates.length, 6);
  assert.ok(portfolio.candidates.every((candidate) => candidate.quality.passed));
  assert.equal(assessment.passed, true);
  assert.ok(assessment.diversityScore >= 52);

  const repeated = { ...portfolio, candidates: portfolio.candidates.map((candidate, index) => ({
    ...portfolio.candidates[0],
    id: `repeat-${index}`,
  })), selectedDirectionId: "repeat-0" };
  const collapsed = assessDirectionPortfolio(repeated);
  assert.equal(collapsed.passed, false);
  assert.ok(collapsed.warnings.some((warning) => /near-duplicates|distinct experience structures/i.test(warning)));
});

test("reference library v2 expands to 72 abstract patterns without first-row fallback", () => {
  const repository = new StaticReferenceLibraryRepository();
  const entries = repository.list();
  assert.equal(entries.length, 72);
  assert.equal(new Set(entries.map((entry) => entry.industry)).size, 12);
  assert.equal(new Set(entries.flatMap((entry) => entry.experienceModels ?? [])).size, 6);
  assert.ok(entries.every((entry) => entry.color_palette.length === 0));
  assert.ok(entries.every((entry) => entry.source?.license === "reference-only"));

  const architecture = analyzeBriefLocally("An architecture practice needs a spatial map of retained structures.");
  const legal = analyzeBriefLocally("A legal service needs a guided employment-rights triage.");
  const first = selectReferencePatterns(architecture, repository);
  const second = selectReferencePatterns(legal, repository);
  assert.equal(classifyReferenceDomain(architecture), "architecture");
  assert.equal(classifyReferenceDomain(legal), "legal");
  assert.notEqual(first.near.id, second.near.id);
  assert.equal(new Set([first.near.id, ...first.far.map((entry) => entry.id)]).size, 3);
  assert.notEqual(first.far[0].industry, first.far[1].industry);
});

test("estimated likelihood cannot influence quality-diversity selection", () => {
  const analysis = analyzeBriefLocally("A civic eligibility service with a guided decision route.");
  const portfolio = createFallbackDirectionPortfolio(generateDesignPlanLocally(analysis), analysis);
  const highFirst = { ...portfolio, candidates: portfolio.candidates.map((candidate, index) => ({ ...candidate, estimatedLikelihood: index === 0 ? 1 : 0 })) };
  const highLast = { ...portfolio, candidates: portfolio.candidates.map((candidate, index) => ({ ...candidate, estimatedLikelihood: index === portfolio.candidates.length - 1 ? 1 : 0 })) };
  assert.equal(assessDirectionPortfolio(highFirst).recommendedDirectionId, assessDirectionPortfolio(highLast).recommendedDirectionId);
});

test("Direction Board always exposes six fixed creative cells and binds its checkpoint to the exact input", async () => {
  const analysis = analyzeBriefLocally("A playful learning lab where students manipulate a visible physics model.");
  const repository = new StaticReferenceLibraryRepository();
  let directionCalls = 0;
  const failingAdapter: LLMAdapter = { async complete() { directionCalls++; throw new Error("offline fixture"); } };
  const board = await generateDirectionBoard({ llm: failingAdapter, analysis, mode: "creative", framework: "html", referenceRepository: repository });
  const checkpoint = createDirectionCheckpoint(board);
  assert.equal(directionCalls, 2, "Creative exploration must use exactly two independent direction batches");
  assert.equal(board.portfolio.candidates.length, 6);
  assert.equal(board.diversity.distinctStructureCount, 6);
  assert.equal(board.portfolio.candidates.filter((candidate) => candidate.descriptors.creativityClass === "combinational").length, 2);
  assert.equal(board.portfolio.candidates.filter((candidate) => candidate.descriptors.creativityClass === "exploratory").length, 2);
  assert.equal(board.portfolio.candidates.filter((candidate) => candidate.descriptors.creativityClass === "transformational").length, 2);
  assert.equal(directionCheckpointMatches(checkpoint, { brief: analysis.rawBrief, framework: "html", mode: "creative" }), true);
  assert.equal(directionCheckpointMatches(checkpoint, { brief: `${analysis.rawBrief} changed`, framework: "html", mode: "creative" }), false);

  const legacyCheckpoint = structuredClone(checkpoint) as typeof checkpoint & {
    board: typeof checkpoint.board & { portfolio: typeof checkpoint.board.portfolio & { candidates: Array<Record<string, unknown>> } };
  };
  legacyCheckpoint.board.portfolio.candidates[0].estimatedLikelihood = 1;
  const parsedRequest = GenerationRequestSchema.parse({
    brief: analysis.rawBrief,
    framework: "html",
    mode: "creative",
    apiKey: "test-key",
    selectedDirectionId: board.portfolio.candidates[0].id,
    directionCheckpoint: legacyCheckpoint,
  });
  assert.equal(Object.hasOwn(parsedRequest.directionCheckpoint!.board.portfolio.candidates[0], "estimatedLikelihood"), false);
  assert.equal(GenerationRequestSchema.safeParse({
    brief: analysis.rawBrief,
    framework: "html",
    mode: "creative",
    apiKey: "test-key",
    selectedDirectionId: "direction-not-on-board",
    directionCheckpoint: checkpoint,
  }).success, false);
});

test("a selected Direction Board is expanded once without regenerating the portfolio", async () => {
  const analysis = analyzeBriefLocally("A carbon operations workbench for factory teams to resolve weekly exceptions.");
  const seed = generateDesignPlanLocally(analysis);
  const portfolio = createFallbackDirectionPortfolio(seed, analysis);
  const board = {
    schemaVersion: 1 as const,
    engineVersion: "creative-engine-v3" as const,
    inputHash: "a1b2c3d4",
    requestedMode: "creative" as const,
    effectiveMode: "creative" as const,
    portfolio,
    diversity: assessDirectionPortfolio(portfolio),
    referencePatternIds: ["near", "far-a", "far-b"],
    createdAt: new Date(0).toISOString(),
  };
  let calls = 0;
  let systemPrompt = "";
  let responseSchema: Record<string, unknown> = {};
  const fakeAdapter: LLMAdapter = {
    async complete(_messages, options) {
      calls++;
      systemPrompt = options?.systemPrompt ?? "";
      responseSchema = options?.responseFormat?.schema ?? {};
      return JSON.stringify({
        colorPalette: [
          { name: "Machine", hex: "#11181A", role: "work surface" },
          { name: "Paper", hex: "#E9F0EE", role: "text" },
          { name: "Signal", hex: "#D7FF3F", role: "active exception" },
        ],
        typePairing: { display: "Arial, sans-serif", body: "Arial, sans-serif", rationale: "Compact system typography keeps operational evidence readable." },
        layoutConcept: "A task-first workbench keeps the exception queue, evidence drawer, and resolution state in one persistent operating surface.",
        signatureElement: { name: "Exception lens", description: "The active exception opens its evidence in place.", implementation: "Use a persistent table and adjacent evidence drawer.", justification: "It turns traceability into the main interaction." },
        referencesSampled: ["abstract near principle", "remote operational analogy"],
        cognitiveGrounding: { vonRestorffCompliance: "One active state.", gutenbergCompliance: "Queue to evidence drawer.", signalNoiseRatio: 0.82, peakEndDesign: "End at a resolved exception state.", usabilityBaseline: "AA contrast and 44px controls." },
      });
    },
  };

  const plan = await generateDesignPlan(fakeAdapter, analysis, "", undefined, undefined, undefined, {
    directionBoard: board,
    selectedDirectionId: portfolio.selectedDirectionId,
    referenceRepository: new StaticReferenceLibraryRepository(),
    allowSchemaRetry: false,
  });
  assert.equal(calls, 1);
  assert.match(systemPrompt, /Expand ONLY the authoritative selected direction/);
  assert.doesNotMatch(systemPrompt, /First explore EXACTLY SIX/);
  assert.match(systemPrompt, /remoteAnalogies/);
  assert.equal((responseSchema.required as string[]).includes("directionPortfolio"), false);
  assert.equal(plan.directionPortfolio?.candidates.length, 6);
  assert.equal(plan.directionPortfolio?.selectedDirectionId, portfolio.selectedDirectionId);
});

test("the fixed creative benchmark covers 24 bilingual briefs and every local board clears the structural floors", async () => {
  const corpus = JSON.parse(readFileSync(join(process.cwd(), "data", "creative-benchmark.json"), "utf8")) as { briefs: Array<{ brief: string; industry: string; language: string; expectedDepth: string; media: string }> };
  assert.equal(corpus.briefs.length, 24);
  assert.equal(new Set(corpus.briefs.map((brief) => brief.industry)).size, 12);
  assert.equal(corpus.briefs.filter((brief) => brief.language === "ar").length, 12);
  assert.equal(corpus.briefs.filter((brief) => brief.language === "en").length, 12);
  assert.deepEqual(new Set(corpus.briefs.map((brief) => brief.expectedDepth)), new Set(["focused", "balanced", "systemic"]));
  assert.deepEqual(new Set(corpus.briefs.map((brief) => brief.media)), new Set(["required", "optional", "avoid"]));

  const repository = new StaticReferenceLibraryRepository();
  const offlineAdapter: LLMAdapter = { async complete() { throw new Error("offline benchmark"); } };
  const boards = await Promise.all(corpus.briefs.map((fixture) => generateDirectionBoard({
    llm: offlineAdapter,
    analysis: analyzeBriefLocally(fixture.brief),
    mode: "creative",
    framework: "html",
    referenceRepository: repository,
  })));
  assert.ok(boards.every((board) => board.portfolio.candidates.length === 6));
  assert.ok(boards.every((board) => board.diversity.distinctStructureCount >= 5));
  assert.ok(boards.every((board) => board.diversity.medianPairDistance >= 0.55));
  assert.ok(boards.every((board) => board.diversity.minimumPairDistance >= 0.3));
});

test("quality-diversity selection overrides a renamed editorial-register house direction", () => {
  const basePlan = generateDesignPlanLocally(analyzeBriefLocally("An employment law firm for individuals seeking a confidential consultation."));
  const defaults = createFallbackDirectionPortfolio(basePlan, analyzeBriefLocally("An employment law firm for individuals seeking a confidential consultation."));
  const dimensions = (topology: string, interaction: string, signature: string) => ({
    topology,
    hierarchy: `${topology} hierarchy`,
    spatialRhythm: `${topology} rhythm`,
    typographyRole: `${topology} typography`,
    mediaStrategy: `${topology} media`,
    interactionMetaphor: interaction,
    signatureMechanism: signature,
  });
  const portfolio: DirectionPortfolio = {
    source: "provider",
    selectedDirectionId: "case-file",
    selectionRationale: "Provider choice",
    candidates: [
      {
        ...defaults.candidates[0],
        id: "case-file",
        concept: "A confidential case path",
        justification: "Fits the legal brief.",
        distinction: "A case margin labels the path.",
        briefFit: 90,
        feasibility: 90,
        estimatedLikelihood: 0.4,
        dimensions: dimensions(
          "Split opening with a vertical case margin, numbered evidence register, and dark closing folio",
          "inspect a numbered dossier",
          "vertical datum beside a twelve-column opening"
        ),
      },
      {
        ...defaults.candidates[1],
        id: "guided-intake",
        concept: "A calm guided intake",
        justification: "Lets an individual disclose only what is necessary.",
        distinction: "Progressive questions replace the document-like page.",
        briefFit: 88,
        feasibility: 88,
        estimatedLikelihood: 0.35,
        dimensions: dimensions(
          "Compact task-led consultation flow with progressive disclosure",
          "answer and reveal",
          "one privacy control that changes the visible guidance"
        ),
      },
      {
        ...defaults.candidates[2],
        id: "plain-language-map",
        concept: "A plain-language issue map",
        justification: "Supports orientation before contact.",
        distinction: "A comparison surface replaces a linear path.",
        briefFit: 80,
        feasibility: 86,
        estimatedLikelihood: 0.25,
        dimensions: dimensions(
          "Comparison field connecting situations to possible next steps",
          "compare and choose",
          "one responsive issue map"
        ),
      },
    ],
  };
  const assessment = assessDirectionPortfolio(portfolio);
  assert.notEqual(assessment.recommendedDirectionId, "case-file");

  const enforced = enforceRecommendedDirection({ ...basePlan, directionPortfolio: portfolio }, assessment);
  assert.equal(enforced.directionPortfolio?.selectedDirectionId, assessment.recommendedDirectionId);
  assert.match(enforced.layoutConcept, /ENFORCED DIRECTION/);
});

test("delivered design fingerprints capture structure without retaining project copy", () => {
  const analysis = analyzeBriefLocally("A product workspace for a daily operational decision.");
  const portfolio = createFallbackDirectionPortfolio(generateDesignPlanLocally(analysis), analysis);
  const selected = portfolio.candidates[0];
  const code = `.hero-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr))}.case-margin{writing-mode:vertical-rl}.path-row{border-top:1px solid} .private-folio{background:#101010}<span>01</span><span>02</span>`;
  const fingerprint = fingerprintDirection(selected, code);
  assert.equal(fingerprint.structure?.topologyFamily, "editorial-register");
  assert.ok(fingerprint.structure?.traits.includes("vertical-rail"));
  assert.doesNotMatch(JSON.stringify(fingerprint.structure), /daily operational decision/i);
});

test("local design memory stores fingerprints without private briefs and penalizes recent repetition", () => {
  const analysis = analyzeBriefLocally("A decision workspace for a logistics operations team.");
  const plan = generateDesignPlanLocally(analysis);
  const portfolio = createFallbackDirectionPortfolio(plan, analysis);
  const selected = portfolio.candidates.find((candidate) => candidate.id === portfolio.selectedDirectionId)!;
  const fingerprint = fingerprintDirection(selected);
  const generated = rememberDesignDirection([], fingerprint, "generated", 100);
  const accepted = rememberDesignDirection(generated, fingerprint, "accepted", 200);

  assert.equal(accepted.length, 1);
  assert.equal(accepted[0]?.outcome, "accepted");
  assert.equal(accepted[0]?.uses, 2);
  assert.doesNotMatch(JSON.stringify(accepted), /brief|apiKey|logistics/i);
  assert.deepEqual(recentDesignFingerprints(accepted), [fingerprint]);

  const repeated = assessDirectionPortfolio(portfolio, [fingerprint]);
  assert.equal(repeated.historicalNoveltyScore, 0);
  assert.ok(repeated.warnings.some((warning) => /recent local result/i.test(warning)));
});

test("generation foundation runs as ordered, deterministic stages", async () => {
  const analysis = analyzeBriefLocally("A public evidence catalog for an adaptive reuse architecture practice.");
  const designPlan = generateDesignPlanLocally(analysis);
  const result = await runGenerationFoundationStages({
    analysis,
    designPlan,
    framework: "html",
    assetBundle: {
      photos: [],
      icons: [],
      font: { family: "Arial", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
      extractedPalette: [],
      mediaRequirement: { level: "recommended", minimumAssets: 0, reason: "Optional evidence", suggestedSubjects: [] },
      assetSummary: "No approved media.",
      warnings: [],
      readinessWarnings: [],
    },
    ownedAssets: [],
    recentDirectionFingerprints: [],
  });

  assert.equal(result.projectSpec.framework, "html");
  assert.equal(result.designPlan.directionPortfolio?.candidates.length, 6);
  assert.equal(result.directionDiversity.passed, true);
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

test("URL critic structurally removes active HTML without creating new tags", () => {
  const normalized = normalizeFetchedDesignSource(`<!doctype html>
    <html><head><title> Verve &amp; Co </title><style>.secret { display: none }</style></head>
    <body>
      <!-- <script>commented()</script> -->
      <<script data-note=">">blocked()</script\t\n ignored>script>
      <iframe src="https://example.com"><p>Hidden frame copy</p></iframe >
      <p>Visible&nbsp;text &#38; detail</p>
    </body></html>`);

  assert.equal(normalized.title, "Verve & Co");
  assert.doesNotMatch(normalized.source, /<!--/);
  assert.doesNotMatch(normalized.source, /<script/i);
  assert.doesNotMatch(normalized.source, /blocked\(\)|Hidden frame copy/);
  assert.doesNotMatch(normalized.visibleText, /blocked\(\)|Hidden frame copy/);
  assert.match(normalized.visibleText, /Visible text & detail$/);

  const unterminated = normalizeFetchedDesignSource("<p>Before</p><script>blocked forever");
  assert.equal(unterminated.visibleText, "Before");
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

test("Fast and Creative behavior is selected by one strategy factory", () => {
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
    .filter((file) => /new\s+(?:AnthropicAdapter|OpenAIAdapter|GeminiAdapter|OpenRouterAdapter)\b/.test(readFileSync(file, "utf8")));
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
      rateLimitFailClosed: true,
      isManagedDeployment: true,
    }),
  });
  assert.equal(health.status, "not-ready");
  assert.equal(health.checks.distributedRateLimit, "missing");
});

test("managed deployment remains available in explicit memory fallback mode", () => {
  const health = readHealthUseCase({
    snapshot: () => ({
      environment: "production",
      commitSha: "abc123",
      rateLimitConfigured: false,
      rateLimitFailClosed: false,
      isManagedDeployment: true,
    }),
  });
  assert.equal(health.status, "degraded");
  assert.equal(health.checks.distributedRateLimit, "memory-fallback");
});

test("managed route admission remains usable with memory fallback", async () => {
  const previous = {
    vercelEnvironment: process.env.VERCEL_ENV,
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    failClosed: process.env.RATE_LIMIT_FAIL_CLOSED,
  };
  try {
    process.env.VERCEL_ENV = "production";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.RATE_LIMIT_FAIL_CLOSED = "false";

    const request = new NextRequest("https://verve.example/api/test", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const config = { routeKey: "fallback-test", maxRequests: 5, windowMs: 60_000, maxConcurrent: 1 };
    assert.equal(await checkRateLimit(request, config), null);

    process.env.RATE_LIMIT_FAIL_CLOSED = "true";
    assert.equal(await checkRateLimit(request, config), null);
  } finally {
    for (const [name, value] of Object.entries({
      VERCEL_ENV: previous.vercelEnvironment,
      UPSTASH_REDIS_REST_URL: previous.upstashUrl,
      UPSTASH_REDIS_REST_TOKEN: previous.upstashToken,
      RATE_LIMIT_FAIL_CLOSED: previous.failClosed,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
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
  assert.equal(PUBLIC_DEMOS.length, 6);
  const structuralCells = new Set<string>();
  for (const demo of PUBLIC_DEMOS) {
    assert.equal(demo.result.project.framework, "html", demo.id);
    assert.ok(demo.result.project.files.length >= 5, demo.id);
    assert.ok(demo.result.project.files.some((file) => file.path === "ASSETS.md"), demo.id);
    assert.equal(demo.receipt.tests.criticalAccessibility, 0, demo.id);
    assert.equal(demo.receipt.tests.horizontalOverflow, 0, demo.id);
    structuralCells.add(`${demo.receipt.direction.topology}/${demo.receipt.direction.opening}/${demo.receipt.direction.navigation}`);
    const validation = validateGeneratedProject(demo.result.project);
    assert.equal(validation.failed, 0, `${demo.id}: ${JSON.stringify(validation.checks)}`);
    assert.match(buildHtmlPreviewDocument(demo.result.project, `${demo.id}-probe`), new RegExp(`${demo.id}-probe`));
  }
  assert.equal(structuralCells.size, 6);
  assert.ok(Math.min(...PUBLIC_DEMOS.map((demo) => demo.receipt.nearestExampleDistance)) >= 0.5);
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

test("OpenAI Responses requests activate strict structured outputs", () => {
  const params = buildOpenAIResponseParams("gpt-5.6-terra", [{ role: "user", content: "Return JSON" }], {
    maxTokens: 14_000,
    reasoningEffort: "low",
    responseFormat: {
      name: "fixture",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      },
    },
  });

  assert.equal(params.max_output_tokens, 21_000);
  assert.deepEqual(params.reasoning, { effort: "low" });
  assert.deepEqual(params.text, {
    verbosity: "low",
    format: {
      type: "json_schema",
      name: "fixture",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      },
      strict: true,
    },
  });
});

test("OpenAI Responses never accepts partial output as a completed artifact", () => {
  assert.throws(() => completedOpenAIResponseText({
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
    error: null,
    output: [],
    output_text: '{"partial":',
  }, "gpt-5.6-terra"), /incomplete response/i);

  const classified = classifyError(new ProviderResponseError("partial", "incomplete"));
  assert.deepEqual(classified, { code: "PROVIDER_ERROR", status: 502 });
});

test("OpenAI Chat Completions requests use the same strict JSON contract", () => {
  assert.deepEqual(buildOpenAIChatResponseFormat({
    name: "fixture",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
    },
  }), {
    type: "json_schema",
    json_schema: {
      name: "fixture",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      },
      strict: true,
    },
  });
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

  const renamedRegister = `<style>
    .hero-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr))}
    .hero h1{font-size:clamp(3rem,6vw,5rem)}
    .case-margin{writing-mode:vertical-rl}
    .path-row{border-top:1px solid #777}
    .process-image{width:100vw}
    .private-folio{background:#101214}
  </style><main><section class="hero"><div class="hero-grid"><h1>Clear next step</h1><aside class="case-margin">Case path</aside></div></section><ol><li class="path-row"><span>01</span></li><li class="path-row"><span>02</span></li></ol><figure class="process-image"></figure><section class="private-folio">Close</section></main>`;
  const structure = inferDesignStructure(renamedRegister);
  assert.equal(structure.topologyFamily, "editorial-register");
  const detectedRegister = inspectDesignDiversity(renamedRegister);
  assert.equal(detectedRegister.passed, false);
  assert.equal(detectedRegister.scoreCap, 78);
  assert.ok(detectedRegister.fingerprints.some((item) => /editorial register/i.test(item)));
});

test("Creative quality repair can replace a repeated structural recipe", async () => {
  let repairPrompt = "";
  const fakeAdapter: LLMAdapter = {
    async complete(messages) {
      repairPrompt = messages[0]?.content ?? "";
      return `<!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;font:16px Arial,sans-serif;color:#171717;background:#f4f1e9}
        main{max-width:72rem;margin:auto;padding:3rem}.catalog{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2rem}
        @media(max-width:700px){.catalog{grid-template-columns:1fr}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
      </style></head><body><main><h1>Employment guidance</h1><div class="catalog"><article><h2>Understand the issue</h2></article><article><h2>Choose a next step</h2></article></div></main></body></html>`;
    },
  };
  const repeated = `<!doctype html><html><head><style>
    .hero-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr))}
    .hero h1{font-size:clamp(3rem,6vw,5rem)}.case-margin{writing-mode:vertical-rl}
    .path-row{border-top:1px solid #777}.process-image{width:100vw}.private-folio{background:#101214}
  </style></head><body><main><section class="hero"><div class="hero-grid"><h1>Clear next step</h1><aside class="case-margin">Case path</aside></div></section><ol><li class="path-row"><span>01</span></li><li class="path-row"><span>02</span></li></ol><figure class="process-image"></figure><section class="private-folio">Close</section></main></body></html>`;

  const quality = await runCodeQualityLoop(fakeAdapter, repeated, "", "html", true);
  assert.equal(quality.wasRepaired, true);
  assert.match(repairPrompt, /Template Diversity Gate/i);
  assert.match(quality.code, /class="catalog"/);
});

test("Fast archetype scoring treats an individual employment law firm as authority with care", () => {
  const analysis = analyzeBriefLocally("Employment law firm for individual clients facing discrimination or unfair dismissal. Must feel trustworthy, confidential, and on their side.");
  const archetype = resolveArchetypeLocally(analysis);
  assert.equal(archetype.primaryArchetype, "ruler");
  assert.equal(archetype.secondaryArchetype, "caregiver");
  assert.match(archetype.designConstraints, /SECONDARY TENSION: (?:The )?Caregiver/);
});

test("OpenRouter Fast mode survives a failed Direction Board call and still assembles the project", async () => {
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
    assert.match(result.designPlan.rawPlan, /Creative Engine v3 plan derived from direction board/);
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

test("multi-file delivery is assembled once and evaluated as one source surface", () => {
  const analysis = {
    subject: "Multi-route tool",
    audience: "Operators",
    primaryJob: "Inspect a work queue",
    tone: "direct",
    industry: "Operations",
    constraints: [],
    rawBrief: "A multi-route operations tool",
  } as BriefAnalysis;
  const plan = {
    colorPalette: [{ name: "Ink", hex: "#111111", role: "text" }],
    typePairing: { display: "Arial", body: "Arial", rationale: "Local system typography." },
    layoutConcept: "A compact task surface with one inspection route.",
    signatureElement: { name: "Task lens", description: "A focused task lens.", implementation: "Semantic region", justification: "Keeps the operation visible." },
    referencesSampled: [],
  } as unknown as DesignPlan;
  const generated = {
    framework: "react",
    componentName: "App",
    imports: [],
    setupNotes: "",
    entryPath: "src/App.tsx",
    code: "export default function App(){return <main><h1>Task lens</h1></main>}",
    files: [
      { path: "src/App.tsx", language: "tsx", content: "export default function App(){return <main><h1>Task lens</h1></main>}" },
      { path: "src/index.css", language: "css", content: "main{display:grid}@media(prefers-reduced-motion:reduce){*{animation:none}}" },
      { path: "index.html", language: "html", content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
    ],
  };

  const delivered = generatedSourceText(generated);
  assert.match(delivered, /src\/index\.css/);
  assert.match(delivered, /prefers-reduced-motion/);
  const project = buildGeneratedProject(generated, analysis, plan);
  assert.equal(project.files.filter((entry) => entry.path === "index.html").length, 1);
  assert.equal(project.files.filter((entry) => entry.path === "src/index.css").length, 1);
  assert.ok(project.files.some((entry) => entry.path === "ASSETS.md"));
});

test("supporting source validation cannot hide unsafe policy violations", () => {
  const issues = inspectSupportingSource(
    'export function Widget(){return <section dangerouslySetInnerHTML={{__html:"<b>unsafe</b>"}} />}',
    "src/components/Widget.tsx",
    "react",
    "A safe component"
  );
  assert.ok(issues.some((issue) => issue.includes("src/components/Widget.tsx")));
  assert.ok(issues.some((issue) => issue.includes("Unsafe HTML injection")));
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

test("HTML project splitting accepts irregular end tags without regex filtering", () => {
  const split = splitHtmlEntry(`<!doctype html><html><head>
    <style data-note="a>b">main { color: tomato; }</style\t\n ignored>
    <script type="application/ld+json">{"name":"Verve"}</script>
  </head><body><main>Safe structure</main>
    <script data-note="a>b">window.ready = true;</script \t\n ignored>
    <script src="./vendor.js"></script>
  </body></html>`);

  assert.match(split.css, /main \{ color: tomato; \}/);
  assert.match(split.javascript, /window\.ready = true/);
  assert.match(split.html, /href="\.\/styles\.css"/);
  assert.match(split.html, /src="\.\/script\.js"/);
  assert.match(split.html, /type="application\/ld\+json"/);
  assert.match(split.html, /src="\.\/vendor\.js"/);
  assert.doesNotMatch(split.html, /data-note="a>b">window\.ready/);

  const joinedBoundary = splitHtmlEntry("<scr<style>.x{color:red}</style>ipt>not a script</scr" + "ipt>");
  assert.doesNotMatch(joinedBoundary.html, /<script>not a script/i);
});

test("native HTML preview handles quoted brackets and escapes raw-text end tags", () => {
  const base = buildRecoveryProject("Structural preview fixture", "html", "test");
  const project = {
    ...base,
    files: [
      {
        ...base.files[0],
        content: '<!doctype html><html><head><link data-note="a>b" href="./styles.css" rel="preload stylesheet"></head><body><main>Preview</main><script data-note="a>b" type="module" src="script.js"></script\t\n ignored></body></html>',
      },
      { path: "styles.css", content: 'main::after { content: "</STYLE >"; }', language: "css", role: "source" as const },
      { path: "script.js", content: 'window.closingTag = "</ScRiPt >";', language: "javascript", role: "source" as const },
    ],
  };

  const preview = buildHtmlPreviewDocument(project, "structural-probe");
  assert.match(preview, /data-verve-source="styles\.css"/);
  assert.match(preview, /data-verve-source="script\.js"/);
  assert.match(preview, /<\\\/STYLE >/);
  assert.match(preview, /<\\\/ScRiPt >/);
  assert.doesNotMatch(preview, /href="\.\/styles\.css"/);
  assert.doesNotMatch(preview, /src="script\.js"/);
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
  const fingerprint = { occupancyGrid: Array(144).fill(0), typographyScale: [0, 0, 1, 0, 0, 0], colorHistogram: [], mediaCoverage: 0, interactionDensity: 0, roundedness: 0, sectionRhythm: [], routeCount: 1 };
  const report = {
    source: "verve-render-gate",
    probeId: "active",
    sequence: 1,
    viewport: { width: 360, height: 640, documentWidth: 420 },
    checks: [{ id: "horizontal-overflow", title: "Rendered mobile width", status: "fail", message: "Overflow" }],
    fingerprint,
  };
  assert.equal(isRenderGateReport(report, "active"), true);
  assert.equal(isRenderGateReport(report, "other"), false);
  assert.equal(isRenderGateReport({ ...report, checks: [{ ...report.checks[0], status: "unknown" }] }, "active"), false);
});

test("Render Gate requires evidence at 360, 768, and 1440 before passing", () => {
  const fingerprint = { occupancyGrid: Array(144).fill(0), typographyScale: [0, 0, 1, 0, 0, 0], colorHistogram: [], mediaCoverage: 0, interactionDensity: 0, roundedness: 0, sectionRhythm: [], routeCount: 1 };
  const report = (width: number, status: "pass" | "warning" | "fail" = "pass"): RenderGateReport => ({
    source: "verve-render-gate",
    probeId: "matrix",
    sequence: width,
    viewport: { width, height: 900, documentWidth: width },
    checks: [{ id: "horizontal-overflow", title: "Responsive width", status, message: "Measured" }],
    fingerprint,
  });
  let matrix = createRenderEvidenceMatrix();
  matrix = recordRenderEvidence(matrix, report(360));
  matrix = recordRenderEvidence(matrix, report(768));
  assert.equal(matrix.complete, false);
  assert.equal(matrix.status, "collecting");
  matrix = recordRenderEvidence(matrix, report(1440));
  assert.equal(matrix.complete, true);
  assert.equal(matrix.status, "pass");
  matrix = recordRenderEvidence(matrix, report(768, "fail"));
  assert.equal(matrix.status, "fail");
  assert.equal(matrix.failures, 1);
});

test("visual fingerprint distance includes project route topology", () => {
  const base = { occupancyGrid: Array(144).fill(0), typographyScale: [0, 0, 1, 0, 0, 0], colorHistogram: [], mediaCoverage: 0, interactionDensity: 0, roundedness: 0, sectionRhythm: [1], routeCount: 1 };
  assert.equal(visualFingerprintDistance(base, base), 0);
  assert.ok(visualFingerprintDistance(base, { ...base, routeCount: 5 }) > 0);
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
  assert.match(restraint.reasoning, /functional role|visually described/);
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

test("project validator blocks motion without opt-out and placeholder form behavior", () => {
  const recovery = buildRecoveryProject("Interactive contract project", "html", "test");
  const project = {
    ...recovery,
    files: [{
      ...recovery.files[0],
      content: `<!doctype html><html><head><style>button { transition: transform .3s ease; }</style></head><body><form action="#"><button type="submit">Send</button></form></body></html>`,
    }],
  };
  const validation = validateGeneratedProject(project);
  assert.ok(validation.checks.some((item) => item.id === "reduced-motion" && item.status === "fail"));
  assert.ok(validation.checks.some((item) => item.id === "forms" && item.status === "fail"));
});

test("ZIP project source follows the live editor state", () => {
  const project = buildRecoveryProject("Editable recovery project", "html", "test");
  const edited = mergeEditorFiles(project, {
    "/index.html": { code: "<!doctype html><html><body>Edited and exported</body></html>" },
  });
  assert.match(edited.files.find((file) => file.path === "index.html")?.content ?? "", /Edited and exported/);
  assert.notEqual(edited.files[0].content, project.files[0].content);
});

test("project ZIPs copy referenced local public assets instead of exporting broken links", async () => {
  const project = buildRecoveryProject("Local asset package", "html", "test");
  project.files[0] = {
    ...project.files[0],
    content: '<!doctype html><html><body><img src="/demo-assets/retention-study.webp" alt="Retained structure"></body></html>',
  };
  assert.deepEqual(referencedLocalAssetPaths(project.files), ["/demo-assets/retention-study.webp"]);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "/demo-assets/retention-study.webp");
    return new Response(new Uint8Array([82, 73, 70, 70]), { status: 200 });
  };
  try {
    const blob = await createProjectArchive(project);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    assert.ok(archive.file("demo-assets/retention-study.webp"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("editor persistence strips preview probes and restores owned-asset paths", () => {
  const project = {
    ...buildRecoveryProject("React editor fixture", "react", "test"),
    entryFile: "src/App.tsx",
    files: [
      { path: "src/main.tsx", content: "import App from './App';", language: "tsx", role: "source" as const },
      { path: "src/App.tsx", content: 'export default function App(){ return <img src="/assets/mark.svg" alt="Mark" />; }', language: "tsx", role: "source" as const },
      { path: "public/assets/mark.svg", content: "PHN2Zy8+", encoding: "base64" as const, mediaType: "image/svg+xml", language: "binary", role: "asset" as const },
    ],
  };
  const instrumented = instrumentSandboxFiles(project, "editor-probe");
  const merged = mergeEditorFiles(project, instrumented);
  assert.doesNotMatch(merged.files[0].content, /__verve_render_probe/);
  assert.match(merged.files[1].content, /src="\/assets\/mark\.svg"/);
  assert.doesNotMatch(merged.files[1].content, /data:image/);
});

test("editor records preserve the runnable project contract without account state", () => {
  const project = buildRecoveryProject("Local editor project", "html", "test");
  const record = createEditorProjectRecord(project, "generation", 1_000, "editor-record");
  assert.equal(record.id, "editor-record");
  assert.equal(record.origin, "generation");
  assert.equal(record.project.files.length, project.files.length);
  assert.equal(record.project.validation.status, validateGeneratedProject(project).status);
  assert.deepEqual(record.snapshots, []);
  assert.deepEqual(record.iterations, []);
});

test("AI Studio stages a multi-file proposal without mutating the accepted project", async () => {
  const accepted = PUBLIC_DEMOS[0].result.project;
  const originalHtml = accepted.files.find((file) => file.path === "index.html")!.content;
  const fakeAdapter: LLMAdapter = {
    async complete() {
      return JSON.stringify({
        summary: "Clarify the opening position",
        rationale: "The requested copy change is isolated to the document entry.",
        changes: [{
          path: "index.html",
          content: originalHtml.replace("The building", "This building"),
          reason: "Makes the thesis point to the building already in view.",
        }],
      });
    },
  };
  const result = await runProjectPatchUseCase(fakeAdapter, {
    project: projectPatchContext(accepted),
    instruction: "Make the opening more immediate.",
    mode: "fast",
  });
  assert.equal(result.callCount, 1);
  assert.equal(result.proposal.changes.length, 1);
  const staged = applyProjectPatchProposal(accepted, result.proposal);
  assert.match(staged.project.files.find((file) => file.path === "index.html")!.content, /This building/);
  assert.deepEqual(
    staged.project.files.filter((file) => file.role === "asset"),
    accepted.files.filter((file) => file.role === "asset")
  );
  assert.equal(accepted.files.find((file) => file.path === "index.html")!.content, originalHtml);
});

test("AI Studio applies a bounded exact replacement without returning a whole file", () => {
  const accepted = PUBLIC_DEMOS[0].result.project;
  const originalHtml = accepted.files.find((file) => file.path === "index.html")!.content;
  const staged = applyProjectPatchProposal(accepted, {
    summary: "Clarify the opening position",
    rationale: "A bounded replacement is sufficient for this copy edit.",
    changes: [{
      path: "index.html",
      operation: "replace_text",
      content: "",
      search: "The building",
      replacement: "This building",
      reason: "Makes the opening point to the building in view.",
    }],
  });

  assert.match(staged.project.files.find((file) => file.path === "index.html")!.content, /This building/);
  assert.ok(staged.files[0].addedLines <= 1);
  assert.equal(accepted.files.find((file) => file.path === "index.html")!.content, originalHtml);
  assert.throws(() => applyProjectPatchProposal(accepted, {
    summary: "Ambiguous replacement",
    rationale: "The engine must reject non-unique search values.",
    changes: [{
      path: "index.html",
      operation: "replace_text",
      content: "",
      search: "section",
      replacement: "article",
      reason: "This search is intentionally ambiguous.",
    }],
  }), /match exactly once/i);
});

test("AI Studio retries one malformed provider artifact and reports the real call count", async () => {
  const accepted = PUBLIC_DEMOS[0].result.project;
  const originalHtml = accepted.files.find((file) => file.path === "index.html")!.content;
  let calls = 0;
  const fakeAdapter: LLMAdapter = {
    async complete() {
      calls++;
      if (calls === 1) return '{"summary":"truncated"';
      return JSON.stringify({
        summary: "Repair the document entry",
        rationale: "The retry returns a complete, bounded proposal.",
        changes: [{
          path: "index.html",
          content: originalHtml.replace("The building", "This building"),
          reason: "Makes the opening immediate.",
        }],
      });
    },
  };

  const result = await runProjectPatchUseCase(fakeAdapter, {
    project: projectPatchContext(accepted),
    instruction: "Make the opening more immediate.",
    mode: "fast",
  });
  assert.equal(calls, 2);
  assert.equal(result.callCount, 2);
  assert.equal(result.proposal.changes[0].path, "index.html");
});

test("AI Studio rejects unsafe patch paths before a proposal can be previewed", () => {
  const project = PUBLIC_DEMOS[0].result.project;
  assert.throws(() => applyProjectPatchProposal(project, {
    summary: "Unsafe file",
    rationale: "This must never leave the project boundary.",
    changes: [{ path: "../outside.ts", content: "export {};", reason: "Invalid path" }],
  }), /unsupported new file|unsafe/i);
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

test("Creative critique uses one bounded provider call", async () => {
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
