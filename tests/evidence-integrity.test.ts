import test from "node:test";
import assert from "node:assert/strict";
import { applyRenderedEvaluationEvidence as applyToRevision, prepareRestoredEvaluation, type EvaluationCoherenceReport, type RenderedEvaluationEvidence } from "../lib/engine/evaluation-coherence";
import { RENDER_RECEIPT_PROBE_VERSION, type ProjectRevision } from "../lib/domain/render-receipt";
import { BrowserHistoryRepository } from "../lib/adapters/storage/browser-history-repository";
import { assessMediaRequirement } from "../lib/engine/media-requirement";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { buildPlanFromDirectionBoard, generateDirectionBoard, selectDirectionCells } from "../lib/engine/direction-board";
import { StaticReferenceLibraryRepository } from "../lib/adapters/storage/static-content-repositories";
import { buildTypographyContract } from "../lib/engine/typography-contract";
import { selectVisualArchive, updateVisualArchive } from "../lib/client/design-memory";
import type { VisualFingerprint } from "../lib/project/render-gate";

const revision: ProjectRevision = { version: 1, algorithm: "sha256", sourceDigest: "a".repeat(64), assetDigest: "b".repeat(64), designDigest: "c".repeat(64) };
function applyRenderedEvaluationEvidence(report: EvaluationCoherenceReport, evidence: RenderedEvaluationEvidence, threshold: number) {
  return applyToRevision(report, evidence, threshold, revision);
}

function report(): EvaluationCoherenceReport {
  return {
    version: 1, status: "coherent", releaseDecision: "ready", creativeClaim: "provisional",
    signals: [
      { id: "release-readiness", authority: "release-gate", stage: "release", status: "pass", score: 100, label: "Release", summary: "Source release" },
      { id: "quality-report", authority: "release-gate", stage: "release", status: "pass", score: null, label: "Quality", summary: "Source quality" },
      { id: "render-evidence", authority: "render-evidence", stage: "render", status: "unavailable", score: null, label: "Render", summary: "Waiting" },
    ], findings: [], policy: [],
  };
}

test("fallback board keeps each mechanism, identity and description with its experience model", async () => {
  const names = {
    "guided-conversation": "guided decision room", "spatial-map": "evidence atlas",
    "task-workbench": "working instrument", "collection-browser": "living collection",
    "live-canvas": "manipulable canvas", "narrative-scroll": "changing documentary",
  };
  for (const mode of ["fast", "creative"] as const) {
    const board = await generateDirectionBoard({
      llm: { async complete() { throw new Error("offline"); } },
      analysis: analyzeBriefLocally("A Cairo print studio comparing notebook product specifications."),
      mode, framework: "html", referenceRepository: new StaticReferenceLibraryRepository(),
    });
    for (const candidate of board.portfolio.candidates) {
      assert.ok(candidate.concept.endsWith(names[candidate.descriptors.experienceModel]));
      assert.ok(candidate.dimensions.hierarchy.includes(candidate.descriptors.openingMode));
      assert.ok(candidate.dimensions.interactionMetaphor.includes(candidate.descriptors.navigationModel));
    }
  }
});

test("provider cells are reordered atomically and mismatches use a coherent fallback", async () => {
  const analysis = analyzeBriefLocally("A Cairo print studio comparing notebook product specifications.");
  const referenceRepository = new StaticReferenceLibraryRepository();
  const input = { analysis, referenceRepository, mode: "fast" as const, framework: "html" };
  const seed = await generateDirectionBoard({ ...input, llm: { async complete() { throw new Error("offline"); } } });
  const providerCandidates = seed.portfolio.candidates.map((candidate) => ({ ...candidate, concept: `Provider authored: ${candidate.concept}` }));
  const valid = await generateDirectionBoard({ ...input, llm: { async complete() { return JSON.stringify({ candidates: [...providerCandidates].reverse() }); } } });
  assert.equal(valid.portfolio.source, "provider");
  assert.deepEqual(valid.portfolio.candidates.map((candidate) => candidate.descriptors.experienceModel), selectDirectionCells(analysis).map((cell) => cell.experienceModel));
  assert.ok(valid.portfolio.candidates.every((candidate) => candidate.concept.startsWith("Provider authored:")));
  providerCandidates[0].descriptors = { ...providerCandidates[0].descriptors, experienceModel: providerCandidates[1].descriptors.experienceModel };
  const invalid = await generateDirectionBoard({ ...input, llm: { async complete() { return JSON.stringify({ candidates: providerCandidates }); } } });
  assert.equal(invalid.portfolio.source, "local-fallback");
  assert.ok(invalid.portfolio.candidates.every((candidate) => !candidate.concept.startsWith("Provider authored:")));
});

test("visual memory excludes this project's revisions but retains identical work from other projects", () => {
  const fingerprint: VisualFingerprint = {
    occupancyGrid: Array(144).fill(0), typographyScale: [0, 0, 1, 0, 0, 0],
    colorHistogram: [], mediaCoverage: 0, interactionDensity: 0,
    roundedness: 0, sectionRhythm: [], routeCount: 1,
  };
  const first = updateVisualArchive([], fingerprint, "history-project-a", 100);
  const revised = updateVisualArchive(first, { ...fingerprint, routeCount: 2 }, "history-project-a", 200);
  assert.equal(revised.length, 1);
  assert.deepEqual(selectVisualArchive(revised, 24, "history-project-a"), []);
  const duplicated = updateVisualArchive(revised, fingerprint, "history-project-b", 300);
  assert.equal(selectVisualArchive(duplicated, 24, "history-project-a").length, 1);
  assert.equal(selectVisualArchive(duplicated, 24, "history-project-b").length, 1);
  const legacy = updateVisualArchive(duplicated, fingerprint, undefined, 400);
  assert.equal(selectVisualArchive(legacy, 24, "history-project-a").length, 1);
  assert.doesNotMatch(JSON.stringify(legacy), /history-project-[ab]/);
});
function evidence(overrides: Partial<RenderedEvaluationEvidence> = {}): RenderedEvaluationEvidence {
  return {
    version: 1, capturedAt: 1, status: "pass", covered: 3, complete: true, score: 100, failures: 0, warnings: 0,
    firstViewportScore: .9, functionalVisualScore: .9, renderedEvidenceScore: .9, renderedCompositionScore: .9,
    directionFidelity: .9, directionStatus: "pass", visualArchiveDistance: .6,
    binding: { version: 1, revision, probeVersion: RENDER_RECEIPT_PROBE_VERSION,
      testedSurfaces: ([360, 768, 1440] as const).slice(0, overrides.covered ?? 3).map((width) => ({ width, routeKey: "surface-root", stateKey: "surface-default" })) },
    privacy: "numeric-and-hashed-render-summary-only", ...overrides,
  };
}

test("eligibility requires observed evidence and respects every release veto", () => {
  assert.equal(applyRenderedEvaluationEvidence(report(), evidence(), .45).creativeClaim, "eligible");
  for (const missing of [
    { visualArchiveDistance: null }, { directionStatus: null }, { directionFidelity: null },
    { covered: 2 }, { complete: false }, { warnings: 1 }, { directionStatus: "review" as const },
    { visualArchiveDistance: NaN }, { directionFidelity: Infinity },
  ]) assert.notEqual(applyRenderedEvaluationEvidence(report(), evidence(missing), .45).creativeClaim, "eligible", JSON.stringify(missing));
  const blocked = report();
  blocked.signals[1].status = "fail";
  const result = applyRenderedEvaluationEvidence(blocked, evidence(), .45);
  assert.equal(result.creativeClaim, "withheld");
  assert.equal(result.releaseDecision, "blocked");
  const review = report();
  review.signals[0].status = "review";
  assert.equal(applyRenderedEvaluationEvidence(review, evidence(), .45).creativeClaim, "provisional");
});

test("one failed surface blocks immediately and a later successful recheck can recover", () => {
  const partial = applyRenderedEvaluationEvidence(report(), evidence({ covered: 1, complete: false, status: "fail", failures: 1 }), .45);
  assert.equal(partial.releaseDecision, "blocked");
  assert.equal(partial.creativeClaim, "withheld");
  assert.equal(partial.signals.find((signal) => signal.id === "render-evidence")?.status, "fail");
  const recovered = applyRenderedEvaluationEvidence(partial, evidence(), .45);
  assert.equal(recovered.releaseDecision, "ready");
  assert.equal(recovered.creativeClaim, "eligible");
  assert.equal(recovered.findings.some((finding) => finding.id === "render-gate-review"), false);
});

test("each offered direction shows the exact licensed display and body families it will deliver", async () => {
  for (const brief of [
    "A Cairo print studio comparing notebook paper and binding specifications.",
    "مختبر تعليمي عربي يشرح التجارب التفاعلية للطلاب.",
  ]) {
    const analysis = analyzeBriefLocally(brief);
    const board = await generateDirectionBoard({
      llm: { async complete() { throw new Error("offline"); } }, analysis,
      mode: "fast", framework: "html", referenceRepository: new StaticReferenceLibraryRepository(),
    });
    for (const candidate of board.portfolio.candidates) {
      const plan = buildPlanFromDirectionBoard(analysis, board, candidate.id);
      const contract = buildTypographyContract(analysis, plan);
      assert.equal(candidate.identity.displayTypeface, contract.display.stack);
      assert.equal(candidate.identity.bodyTypeface, contract.body.stack);
    }
    if (!/[\u0600-\u06ff]/.test(brief)) {
      assert.ok(new Set(board.portfolio.candidates.map((candidate) => candidate.identity.displayTypeface)).size >= 4);
    }
  }
});

test("restored history cannot inherit a past browser verdict or omitted binary assets", () => {
  const previous = applyRenderedEvaluationEvidence(report(), evidence(), .45);
  assert.equal(previous.creativeClaim, "eligible");
  const restored = prepareRestoredEvaluation(previous, false);
  assert.equal(restored.releaseDecision, "review-required");
  assert.equal(restored.creativeClaim, "provisional");
  assert.equal(restored.signals.find((signal) => signal.id === "render-evidence")?.status, "unavailable");
  assert.equal(applyRenderedEvaluationEvidence(restored, evidence(), .45).creativeClaim, "eligible");

  const missingAssets = prepareRestoredEvaluation(previous, true);
  assert.equal(missingAssets.releaseDecision, "review-required");
  assert.ok(missingAssets.findings.some((finding) => finding.id === "restored-assets-missing"));
  assert.equal(applyRenderedEvaluationEvidence(missingAssets, evidence(), .45).creativeClaim, "provisional");
});

test("empty archive permits a technical release but cannot prove visual distinctiveness", () => {
  const result = applyRenderedEvaluationEvidence(report(), evidence({ visualArchiveDistance: null }), .45);
  assert.equal(result.releaseDecision, "ready");
  assert.equal(result.creativeClaim, "provisional");
  assert.ok(result.findings.some((finding) => finding.id === "render-archive-review"));
});

test("history replacement preserves the previous value on quota failure", () => {
  let value = JSON.stringify([{ id: "old", timestamp: 1 }]);
  let removes = 0;
  const storage = {
    getItem: () => value,
    setItem: () => { throw new Error("QuotaExceededError"); },
    removeItem: () => { removes++; value = "[]"; },
  } as unknown as Storage;
  const repository = new BrowserHistoryRepository("history", 20, storage);
  repository.replace([{ id: "new", timestamp: 2 }]);
  assert.deepEqual(repository.list(), [{ id: "old", timestamp: 1 }]);
  assert.equal(removes, 0);
});

test("history rejects corrupt containers and keeps newest records under reduced quota", () => {
  let value = '{"bad":true}';
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => { if (JSON.parse(next).length > 10) throw new Error("Quota"); value = next; },
  } as unknown as Storage;
  const repository = new BrowserHistoryRepository("history", 20, storage);
  assert.deepEqual(repository.list(), []);
  repository.replace(Array.from({ length: 15 }, (_, timestamp) => ({ id: String(timestamp), timestamp })));
  assert.deepEqual(repository.list().map((entry) => entry.timestamp), [14, 13, 12, 11, 10, 9, 8, 7, 6, 5]);
  value = '[null,{"id":"ok","timestamp":1},{"id":"bad"}]';
  assert.deepEqual(repository.list(), [{ id: "ok", timestamp: 1 }]);
});

test("explicit photography exclusions override industry defaults in Arabic and English", () => {
  for (const brief of [
    "Restaurant booking service. No photography; the menu and available dates lead the experience.",
    "Architecture practice portfolio without photos. Original diagrams explain each project.",
    "مطعم في القاهرة بدون صور فوتوغرافية. القائمة والحجز أساس التجربة.",
  ]) {
    const requirement = assessMediaRequirement(analyzeBriefLocally(brief));
    assert.equal(requirement.level, "avoid", brief);
    assert.equal(requirement.minimumAssets, 0);
  }
  assert.equal(assessMediaRequirement(analyzeBriefLocally("Architecture portfolio with approved photography.")).level, "required");
  for (const brief of ["Architecture portfolio. No photos of people; show buildings.", "مطعم في القاهرة بدون صور للأشخاص. استخدم صور الطعام."]) {
    assert.equal(assessMediaRequirement(analyzeBriefLocally(brief)).level, "required", brief);
  }
});
