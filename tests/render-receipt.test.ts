import test from "node:test";
import assert from "node:assert/strict";
import { projectRevision, projectPreviewKey } from "../lib/project/project-revision";
import { isProjectRevision, receiptMatchesRevision, RENDER_RECEIPT_PROBE_VERSION } from "../lib/domain/render-receipt";
import { summarizeRenderAudit } from "../lib/client/render-audit";
import { createRenderEvidenceMatrix, recordRenderEvidence, createRenderProbeSource, type RenderGateReport } from "../lib/project/render-gate";
import { applyRenderedEvaluationEvidence, type EvaluationCoherenceReport } from "../lib/engine/evaluation-coherence";
import type { GeneratedProject } from "../lib/project/types";

function project(): GeneratedProject {
  return {
    schemaVersion: 1, name: "Private client name", framework: "html", entryFile: "index.html", dependencies: {}, scripts: {}, warnings: [],
    readiness: { status: "ready", score: 100 }, validation: { status: "ready", score: 100, checks: [], failed: 0, warnings: 0 },
    files: [
      { path: "index.html", role: "source", language: "html", content: "<h1>Private brief copy</h1>" },
      { path: "assets/photo.jpg", role: "asset", language: "binary", encoding: "base64", mediaType: "image/jpeg", content: "YWJj" },
      { path: "assets/font.woff2", role: "asset", language: "binary", encoding: "base64", mediaType: "font/woff2", content: "ZGVm" },
      { path: "ASSETS.md", role: "documentation", language: "markdown", content: "Owned photo licensed by the client." },
      { path: "DESIGN-CONTRACT.json", role: "documentation", language: "json", content: '{"version":1,"direction":"A"}' },
    ],
  };
}

function browserReport(width: number): RenderGateReport {
  return {
    source: "verve-render-gate", probeId: "test-revision", probeVersion: RENDER_RECEIPT_PROBE_VERSION, sequence: 1,
    viewport: { width, height: 900, documentWidth: width }, checks: [],
    surface: { routeKey: "surface-root", stateKey: "surface-default", activeStateCount: 1, expectedStateCount: 1 },
    fingerprint: { occupancyGrid: Array(144).fill(0), typographyScale: Array(6).fill(0), colorHistogram: [], mediaCoverage: 0, interactionDensity: 0, roundedness: 0, sectionRhythm: [], routeCount: 1 },
  };
}

function evaluation(): EvaluationCoherenceReport {
  return { version: 1, status: "coherent", releaseDecision: "ready", creativeClaim: "provisional", findings: [], policy: [], signals: [
    { id: "release-readiness", label: "Release", authority: "release-gate", stage: "release", status: "pass", score: 100, summary: "Source gates passed" },
    { id: "render-evidence", label: "Render", authority: "render-evidence", stage: "render", status: "unavailable", score: null, summary: "Waiting" },
  ] };
}

test("SHA-256 revisions bind source, configuration, font/image bytes, asset licenses and design decisions", async () => {
  const original = project();
  const baseline = await projectRevision(original);
  assert.ok(isProjectRevision(baseline));
  const previewKey = projectPreviewKey(original);
  assert.equal(projectPreviewKey({ ...original, name: "Renamed", files: [...original.files].reverse() }), previewKey);
  assert.deepEqual(await projectRevision({ ...original, name: "Renamed", warnings: ["Review"], files: [...original.files].reverse() }), baseline);
  for (const path of ["index.html", "assets/photo.jpg", "assets/font.woff2", "ASSETS.md", "DESIGN-CONTRACT.json"]) {
    const changed = structuredClone(original);
    changed.files.find((file) => file.path === path)!.content += "changed";
    assert.notDeepEqual(await projectRevision(changed), baseline, path);
    assert.notEqual(projectPreviewKey(changed), previewKey, `${path} invalidates preview matrices`);
  }
  assert.notDeepEqual(await projectRevision({ ...original, scripts: { start: "serve ." } }), baseline);
  assert.notEqual(projectPreviewKey({ ...original, dependencies: { react: "19" } }), previewKey);
  assert.notDeepEqual(await projectRevision({ ...original, files: original.files.filter((file) => file.path !== "assets/photo.jpg") }), baseline, "Lightweight history cannot reuse a complete asset receipt");
});

test("render summaries expose only hashes and tested viewport/route/state identities", async () => {
  let matrix = createRenderEvidenceMatrix();
  for (const width of [360, 768, 1440]) matrix = recordRenderEvidence(matrix, browserReport(width));
  const revision = await projectRevision(project());
  const audit = summarizeRenderAudit(matrix, null, null, revision);
  assert.equal(receiptMatchesRevision(audit.binding, revision, 3), true);
  assert.deepEqual(audit.binding!.testedSurfaces.map((surface) => surface.width), [360, 768, 1440]);
  assert.doesNotMatch(JSON.stringify(audit), /Private|index\.html|photo\.jpg|licensed by/);
  const legacy = browserReport(360);
  delete legacy.probeVersion;
  assert.equal(summarizeRenderAudit(recordRenderEvidence(createRenderEvidenceMatrix(), legacy), null, null, revision).binding, undefined);
  assert.match(createRenderProbeSource("revision-123"), /probeVersion: 3/);
});

test("a passing or failing receipt for another artifact cannot authorize or block this revision", async () => {
  let matrix = createRenderEvidenceMatrix();
  for (const width of [360, 768, 1440]) matrix = recordRenderEvidence(matrix, browserReport(width));
  const original = project();
  const revision = await projectRevision(original);
  const audit = { ...summarizeRenderAudit(matrix, null, .6, revision), directionFidelity: .9, directionStatus: "pass" as const };
  assert.equal(applyRenderedEvaluationEvidence(evaluation(), audit, .45, revision).creativeClaim, "eligible");
  for (const path of ["index.html", "assets/font.woff2", "assets/photo.jpg", "DESIGN-CONTRACT.json"]) {
    const changed = structuredClone(original);
    changed.files.find((file) => file.path === path)!.content += "changed";
    const currentRevision = await projectRevision(changed);
    const result = applyRenderedEvaluationEvidence(evaluation(), audit, .45, currentRevision);
    assert.equal(result.releaseDecision, "review-required", path);
    assert.equal(result.creativeClaim, "provisional", path);
    assert.equal(result.signals.find((signal) => signal.id === "render-evidence")?.score, null);
    const staleFailure = applyRenderedEvaluationEvidence(evaluation(), { ...audit, status: "fail", failures: 1, directionStatus: "fail" }, .45, currentRevision);
    assert.equal(staleFailure.releaseDecision, "review-required", "A stale failure belongs to the old artifact too");
  }
  assert.equal(applyRenderedEvaluationEvidence(evaluation(), { ...audit, binding: undefined }, .45, revision).releaseDecision, "review-required");
  assert.equal(applyRenderedEvaluationEvidence(evaluation(), audit, .45).creativeClaim, "provisional");
  const missingWidth = { ...audit, binding: { ...audit.binding!, testedSurfaces: audit.binding!.testedSurfaces.slice(0, 2) } };
  assert.equal(applyRenderedEvaluationEvidence(evaluation(), missingWidth, .45, revision).releaseDecision, "review-required");
});
