import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDesignPlanLocally } from "../lib/engine/fast-path";
import { applySelectedDirection } from "../lib/engine/direction-portfolio";
import { createPipelineCheckpoint, checkpointMatchesInput, isPipelineCheckpoint, PipelineCheckpointSchema, resolveResumedDesignPlan } from "../lib/engine/pipeline-checkpoint";
import { GenerationRequestSchema } from "../lib/api/generation-request";
import { runGenerationFoundationStages } from "../lib/application/generation-foundation-stages";
import type { DesignPlan } from "../lib/engine/plan-generator";
import type { AssetBundle } from "../lib/engine/asset-sourcer";
import { runGenerationUseCase, type GenerationDependencies, type PipelineInput } from "../lib/application/run-generation-use-case";
import { staticBlocklistRepository, staticReferenceLibraryRepository } from "../lib/adapters/storage/static-content-repositories";
import { buildPlanFromDirectionBoard, createDirectionCheckpoint, generateDirectionBoard } from "../lib/engine/direction-board";
import { InvalidGenerationInputError } from "../lib/errors/invalid-generation-input-error";
import { classifyError } from "../lib/middleware/error-handler";

const brief = "An illustrator shares original work and invites contact.";
const input = { brief, framework: "html", mode: "fast" as const };

function fixture() {
  const analysis = analyzeBriefLocally(brief);
  const plan = generateDesignPlanLocally(analysis);
  return { analysis, plan };
}

test("stage-04 checkpoint and request parsing preserve every selected direction completely", () => {
  const { analysis, plan } = fixture();
  for (const candidate of plan.directionPortfolio!.candidates) {
    const chosen = applySelectedDirection(plan, candidate.id, "User selected this exact direction.");
    const checkpoint = createPipelineCheckpoint(input, "04", analysis, chosen);
    assert.deepEqual(checkpoint.designPlan?.directionPortfolio, chosen.directionPortfolio);
    assert.equal(checkpoint.designPlan?.directionPortfolio?.selectedDirectionId, candidate.id);
    assert.equal(checkpoint.designPlan?.layoutConcept, chosen.layoutConcept);
    assert.deepEqual(checkpoint.designPlan?.colorPalette, chosen.colorPalette);
    const parsed = GenerationRequestSchema.parse({ ...input, apiKey: "synthetic-test-key", checkpoint: JSON.parse(JSON.stringify(checkpoint)) });
    assert.deepEqual(parsed.checkpoint?.designPlan?.directionPortfolio, chosen.directionPortfolio);
    assert.equal(checkpointMatchesInput(parsed.checkpoint, input), true);
  }
});

test("checkpoint identity validates bounded candidates, IDs, descriptors, colors and quality values", () => {
  const { analysis, plan } = fixture();
  const checkpoint = createPipelineCheckpoint(input, "04", analysis, plan);
  const mutations: Array<(value: typeof checkpoint) => void> = [
    (value) => { value.designPlan!.directionPortfolio!.selectedDirectionId = "not-a-candidate"; },
    (value) => { value.designPlan!.directionPortfolio!.candidates.push(value.designPlan!.directionPortfolio!.candidates[0]); },
    (value) => { value.designPlan!.directionPortfolio!.candidates[1].id = value.designPlan!.directionPortfolio!.candidates[0].id; },
    (value) => { value.designPlan!.directionPortfolio!.candidates[0].concept = "x".repeat(501); },
    (value) => { value.designPlan!.directionPortfolio!.candidates[0].identity.palette[0].hex = "red;display:none"; },
    (value) => { value.designPlan!.directionPortfolio!.candidates[0].quality.briefCoverage = 101; },
    (value) => { value.designPlan!.directionPortfolio!.candidates[0].descriptors.experienceModel = "unknown" as never; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(checkpoint);
    mutate(invalid);
    assert.equal(isPipelineCheckpoint(invalid), false);
    assert.equal(checkpointMatchesInput(invalid, input), false);
    assert.equal(GenerationRequestSchema.safeParse({ ...input, apiKey: "synthetic-test-key", checkpoint: invalid }).success, false);
  }
});

test("checkpoint contracts strip opaque binary and private asset metadata rather than transporting it", () => {
  const { analysis, plan } = fixture();
  const untrusted = structuredClone(plan) as DesignPlan & { ownedAssets?: unknown; privateContext?: unknown };
  untrusted.ownedAssets = [{ content: "SYNTHETIC_PRIVATE_BINARY_SENTINEL", encoding: "base64" }];
  untrusted.privateContext = "SYNTHETIC_PRIVATE_CONTEXT_SENTINEL";
  Object.assign(untrusted.directionPortfolio!, { assetBytes: "SYNTHETIC_PORTFOLIO_BINARY_SENTINEL" });
  Object.assign(untrusted.directionPortfolio!.candidates[0], { assetManifest: { content: "SYNTHETIC_CANDIDATE_BINARY_SENTINEL" } });
  const checkpoint = createPipelineCheckpoint(input, "04", analysis, untrusted);
  assert.doesNotMatch(JSON.stringify(checkpoint), /SYNTHETIC_(?:PRIVATE|PORTFOLIO|CANDIDATE)/);
  assert.deepEqual(checkpoint.designPlan?.directionPortfolio, plan.directionPortfolio);
});

test("legacy v1 checkpoints remain readable without pretending they retain a selected direction", () => {
  const { analysis, plan } = fixture();
  const legacy = { ...plan };
  delete legacy.directionPortfolio;
  const checkpoint = createPipelineCheckpoint(input, "04", analysis, legacy);
  assert.equal(checkpoint.schemaVersion, 1);
  assert.equal(isPipelineCheckpoint(checkpoint), true);
  assert.equal(checkpointMatchesInput(checkpoint, input), true);
  assert.equal(checkpoint.designPlan?.directionPortfolio, undefined);
  const wrongVersion = { ...checkpoint, schemaVersion: 2 };
  assert.equal(checkpointMatchesInput(wrongVersion as never, input), false);
  const stageOne = createPipelineCheckpoint(input, "01", analysis);
  assert.equal(PipelineCheckpointSchema.safeParse(stageOne).success, true);
});

test("a restored locked plan compiles its chosen experience instead of a fresh recommended identity", async () => {
  const { analysis, plan } = fixture();
  const candidate = plan.directionPortfolio!.candidates.at(-1)!;
  const chosen = applySelectedDirection(plan, candidate.id, "User selected this exact direction.");
  const checkpoint = createPipelineCheckpoint(input, "04", analysis, chosen);
  const assets: AssetBundle = {
    photos: [], icons: [], extractedPalette: [], warnings: [], readinessWarnings: [], assetSummary: "No external media.",
    mediaRequirement: { level: "avoid", minimumAssets: 0, reason: "Checkpoint test.", suggestedSubjects: [] },
    font: { family: "Manrope", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
  };
  const foundation = await runGenerationFoundationStages({
    analysis, designPlan: checkpoint.designPlan!, framework: "html", mode: "fast", assetBundle: assets,
    ownedAssets: [], recentDirectionFingerprints: [], selectedDirectionLocked: true,
  });
  assert.equal(foundation.designPlan.directionPortfolio?.selectedDirectionId, candidate.id);
  assert.equal(foundation.projectSpec.experience.model, candidate.descriptors.experienceModel);
  assert.equal(foundation.projectSpec.designContract?.identity.directionId, candidate.id);
  assert.equal(foundation.projectSpec.visualSystem.signature.mechanism, candidate.dimensions.signatureMechanism);
  assert.deepEqual(foundation.projectSpec.visualSystem.colors, candidate.identity.palette);
});

test("a new selection replaces the saved direction atomically, including its full identity", () => {
  const { plan } = fixture();
  const previous = plan.directionPortfolio!.candidates[0];
  const next = plan.directionPortfolio!.candidates[1];
  const saved = applySelectedDirection(plan, previous.id);
  const resolved = resolveResumedDesignPlan(saved, next.id)!;
  assert.equal(resolved.directionPortfolio?.selectedDirectionId, next.id);
  assert.deepEqual(resolved.colorPalette, next.identity.palette);
  assert.equal(resolved.typePairing.display, next.identity.displayTypeface);
  assert.equal(resolved.typePairing.body, next.identity.bodyTypeface);
  assert.equal(resolved.signatureElement.implementation, next.dimensions.signatureMechanism);
  assert.match(resolved.layoutConcept, new RegExp(next.descriptors.experienceModel));
  assert.equal(saved.directionPortfolio?.selectedDirectionId, previous.id, "Resume resolution must not mutate the saved checkpoint");
});

test("a changed selection prefers its fresh authoritative board identity", () => {
  const { plan } = fixture();
  const previous = plan.directionPortfolio!.candidates[0];
  const next = plan.directionPortfolio!.candidates[1];
  const saved = applySelectedDirection(plan, previous.id);
  const refreshed = structuredClone(plan);
  refreshed.directionPortfolio!.candidates[1].identity.palette[0].hex = "#2468ac";
  refreshed.directionPortfolio!.candidates[1].dimensions.signatureMechanism = "A newly defined, source-bound inspection mechanism.";
  const boardPlan = applySelectedDirection(refreshed, next.id);
  const resolved = resolveResumedDesignPlan(saved, next.id, boardPlan)!;
  assert.equal(resolved, boardPlan);
  assert.equal(resolved.colorPalette[0].hex, "#2468ac");
  assert.equal(resolved.signatureElement.implementation, "A newly defined, source-bound inspection mechanism.");
  assert.equal(resolveResumedDesignPlan(saved, previous.id, boardPlan), saved, "An unchanged selection intentionally retains its saved plan");
  assert.equal(resolveResumedDesignPlan(saved), saved);
});

test("unknown and legacy changed selections never silently resume the old identity", () => {
  const { plan } = fixture();
  assert.equal(resolveResumedDesignPlan(plan, "missing-direction"), undefined);
  assert.equal(resolveResumedDesignPlan(undefined, plan.directionPortfolio!.selectedDirectionId), undefined);
  const legacy = { ...plan };
  delete legacy.directionPortfolio;
  const requested = plan.directionPortfolio!.candidates.at(-1)!;
  assert.equal(resolveResumedDesignPlan(legacy), legacy);
  assert.equal(resolveResumedDesignPlan(legacy, requested.id), undefined);
  const boardPlan = applySelectedDirection(plan, requested.id);
  assert.equal(resolveResumedDesignPlan(legacy, requested.id, boardPlan), boardPlan);
});

function mockedCodeDependencies() {
  const calls: string[] = [];
  const assets: AssetBundle = {
    photos: [], icons: [], extractedPalette: [], warnings: [], readinessWarnings: [], assetSummary: "No external media.",
    mediaRequirement: { level: "avoid", minimumAssets: 0, reason: "Resume integration test.", suggestedSubjects: [] },
    font: { family: "Manrope", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
  };
  const dependencies: GenerationDependencies = {
    defaultModel: "synthetic-model", blocklistRepository: staticBlocklistRepository, referenceLibraryRepository: staticReferenceLibraryRepository,
    assetSource: { async source() { return assets; } },
    llm: {
      async complete(_messages, options) {
        const schema = options?.responseFormat?.name ?? "unknown";
        calls.push(schema);
        assert.equal(schema, "generated_project_sources", "A resolved Fast checkpoint spends only its code call");
        return JSON.stringify({ files: [
          { path: "index.html", language: "html", content: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Illustrator</title><script src="app.js" defer></script></head><body><main><h1 data-verve-task="primary-object">Original work</h1><p data-verve-task="decision-evidence">Contact the illustrator about the supplied work.</p><button type="button" data-inspect data-verve-primary-action aria-pressed="false">Inspect</button><p id="inspection">Overview</p></main></body></html>' },
          { path: "app.js", language: "javascript", content: 'document.querySelector("[data-inspect]").addEventListener("click",function(){this.setAttribute("aria-pressed","true");document.getElementById("inspection").textContent="Selected work"})' },
        ] });
      },
    },
  };
  return { dependencies, calls };
}

test("real Fast stage-04 resume preserves or switches the exact candidate with one mocked code call", async () => {
  const { analysis, plan } = fixture();
  const previous = plan.directionPortfolio!.candidates[0];
  const next = plan.directionPortfolio!.candidates[1];
  const checkpoint = createPipelineCheckpoint({ ...input, brandContext: JSON.stringify({ ownedAssets: [] }) }, "04", analysis, applySelectedDirection(plan, previous.id));
  for (const selectedDirectionId of [undefined, previous.id, next.id]) {
    const { dependencies, calls } = mockedCodeDependencies();
    const result = await runGenerationUseCase({ ...input, checkpoint, selectedDirectionId }, dependencies);
    const expected = selectedDirectionId === next.id ? next : previous;
    assert.deepEqual(calls, ["generated_project_sources"]);
    assert.equal(result.designPlan.directionPortfolio?.selectedDirectionId, expected.id);
    assert.equal(result.projectSpec.experience.model, expected.descriptors.experienceModel);
    assert.equal(result.projectSpec.designContract?.identity.directionId, expected.id);
    assert.equal(result.projectSpec.visualSystem.signature.mechanism, expected.dimensions.signatureMechanism);
    assert.deepEqual(result.projectSpec.experience.routes.map((route) => route.path), ["/"]);
    assert.ok(result.project.files.some((file) => file.path === "app.js"));
    assert.equal(result.project.files.some((file) => /^compare\//.test(file.path)), false);
  }
});

test("real Fast resume gives a new authoritative board selection precedence over the saved plan", async () => {
  const { analysis, plan } = fixture();
  const previous = plan.directionPortfolio!.candidates[0];
  const checkpoint = createPipelineCheckpoint({ ...input, brandContext: JSON.stringify({ ownedAssets: [] }) }, "04", analysis, applySelectedDirection(plan, previous.id));
  const board = await generateDirectionBoard({
    analysis, mode: "fast", framework: "html", referenceRepository: staticReferenceLibraryRepository,
    llm: { async complete() { throw new Error("Deterministic offline board fixture"); } },
  });
  const next = board.portfolio.candidates.find((candidate) => candidate.id !== previous.id)!;
  next.dimensions.signatureMechanism = "A refreshed source-bound selection object with an inspectable consequence.";
  const boardPlan = buildPlanFromDirectionBoard(analysis, board, next.id);
  const request: PipelineInput = { ...input, checkpoint, directionCheckpoint: createDirectionCheckpoint(board), selectedDirectionId: next.id };
  const { dependencies, calls } = mockedCodeDependencies();
  const result = await runGenerationUseCase(request, dependencies);
  assert.deepEqual(calls, ["generated_project_sources"]);
  assert.equal(result.designPlan.directionPortfolio?.selectedDirectionId, next.id);
  assert.equal(result.projectSpec.experience.model, next.descriptors.experienceModel);
  assert.equal(result.projectSpec.visualSystem.signature.mechanism, boardPlan.signatureElement.implementation);
});

test("unknown, missing and stale checkpoint selections are rejected before any model call", async () => {
  const { analysis, plan } = fixture();
  const checkpoint = createPipelineCheckpoint({ ...input, brandContext: JSON.stringify({ ownedAssets: [] }) }, "04", analysis, plan);
  const selectedDirectionId = plan.directionPortfolio!.selectedDirectionId;
  for (const request of [
    { ...input, checkpoint, selectedDirectionId: "missing-direction" },
    { ...input, selectedDirectionId },
    { ...input, brief: `${brief} Another changed requirement.`, checkpoint, selectedDirectionId },
  ]) {
    const { dependencies, calls } = mockedCodeDependencies();
    await assert.rejects(runGenerationUseCase(request, dependencies), InvalidGenerationInputError);
    assert.deepEqual(calls, []);
  }
  assert.equal(GenerationRequestSchema.safeParse({ ...input, checkpoint, selectedDirectionId: "missing-direction", apiKey: "synthetic-test-key" }).success, false);
  assert.deepEqual(classifyError(new InvalidGenerationInputError("Unknown selection")), { code: "INVALID_REQUEST", status: 400 });
});
