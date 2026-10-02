import test from "node:test";
import assert from "node:assert/strict";
import { buildDirectionStudy, buildDirectionStudyContext, directionStudyLabel } from "../lib/engine/direction-study";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDirectionBoard, createDirectionCheckpoint, directionCheckpointMatches } from "../lib/engine/direction-board";
import { runDirectionExplorationUseCase } from "../lib/application/run-direction-exploration-use-case";
import { StaticReferenceLibraryRepository } from "../lib/adapters/storage/static-content-repositories";
import { directionBrandContext, type OwnedAssetManifest } from "../lib/project/brand-kit";
import { DirectionRequestSchema } from "../lib/api/generation-request";
import { colorContrast, resolveDesignColorRoles } from "../lib/engine/design-color-roles";

const brief = 'A Cairo print studio has 5 product lines. "Riso Notebook — A5, 80 pages, 120gsm recycled paper, EGP 450." Buyers compare paper weight, binding type, batch size and price. Explicitly avoid beige palettes and "Made with love" language.';
const repository = new StaticReferenceLibraryRepository();
const offline = { async complete() { throw new Error("offline"); } };
const owned: OwnedAssetManifest = { path: "assets/paper.png", url: "./assets/paper.png", kind: "image", mediaType: "image/png", alt: "Owned paper specimen" };

test("direction studies keep verbatim specifications and never fill a declared collection with invented records", () => {
  const context = buildDirectionStudyContext(brief);
  assert.equal(context.entries.length, 1);
  assert.equal(context.entries[0].label, "Riso Notebook");
  assert.deepEqual(context.entries[0].attributes.map((attribute) => attribute.value), ["A5", "80 pages", "120gsm recycled paper", "EGP 450."]);
  assert.equal(context.evidence.collectionExpectation?.expectedCount, 5);
  assert.ok(context.evidence.gaps.some((gap) => gap.known === 1 && gap.expected === 5));
  assert.equal(context.heading, "Riso Notebook");
  assert.equal(buildDirectionStudyContext(brief, "Nile Press").heading, "Nile Press");
  assert.ok(context.entries.every((entry) => brief.includes(entry.label)));
  assert.ok(!JSON.stringify(context.entries).includes("Made with love"));
});

test("sparse and Arabic studies reveal only source excerpts, not exclusions or imagined coordinates and metrics", () => {
  const source = 'مطعم في القاهرة للحجز ومقارنة الخيارات. تجنب "طبق وهمي — 20 قطعة، EGP 900". بدون صور.';
  const context = buildDirectionStudyContext(source);
  assert.equal(context.locale, "ar");
  assert.equal(context.mediaExcluded, true);
  assert.ok(context.entries.every((entry) => entry.kind === "brief-excerpt" && source.includes(entry.text)));
  assert.ok(!JSON.stringify(context.entries).includes("طبق وهمي"));
  const empty = buildDirectionStudyContext("Avoid all photography.");
  assert.equal(empty.entries.length, 0);
});

test("every study preserves its candidate identity and the exact delivery color roles without certifying readiness", async () => {
  const board = await generateDirectionBoard({ llm: offline, analysis: analyzeBriefLocally(brief), mode: "fast", framework: "html", referenceRepository: repository });
  for (const candidate of board.portfolio.candidates) {
    const study = buildDirectionStudy(candidate, buildDirectionStudyContext(brief), 1);
    assert.equal(study.directionId, candidate.id);
    assert.ok(directionStudyLabel(candidate).length <= 140);
    assert.deepEqual(study.colors, resolveDesignColorRoles(candidate.identity.palette));
    assert.ok(Object.values(study.colors).every((color) => candidate.identity.palette.some((entry) => entry.hex === color)));
    assert.ok(!Object.hasOwn(study, "qualityScore"));
    assert.equal(study.media, candidate.descriptors.mediaRole === "none" ? "not-used" : "available");
    assert.equal(buildDirectionStudy(candidate, buildDirectionStudyContext("An interior practice. Avoid all photography."), 3).media, "excluded");
  }
  const candidate = board.portfolio.candidates[0];
  candidate.identity.palette = ["#bbbbbb", "#cccccc", "#dddddd"].map((hex, index) => ({ hex, role: index ? "text" : "background", name: hex }));
  const low = buildDirectionStudy(candidate, buildDirectionStudyContext(brief));
  assert.ok(colorContrast(low.colors.surface, low.colors.textPrimary) < 4.5);
  assert.ok(low.warnings.some((warning) => warning.includes("readable")));
  assert.throws(() => resolveDesignColorRoles([{ hex: "url(bad)", role: "background" }]));
});

test("direction asset metadata reaches the provider and checkpoint without binary transport or extra calls", async () => {
  for (const mode of ["fast", "creative"] as const) {
    let calls = 0;
    const messages: string[] = [];
    const input = DirectionRequestSchema.parse({ brief, apiKey: "test", framework: "html", mode, ownedAssets: [owned], brandProfile: { name: "Nile Press", colors: [] } });
    const { board, checkpoint } = await runDirectionExplorationUseCase(input, { referenceLibraryRepository: repository, llm: { async complete(turns) { calls++; messages.push(JSON.stringify(turns)); throw new Error("offline"); } } });
    assert.equal(calls, mode === "fast" ? 1 : 2);
    assert.ok(messages.every((message) => message.includes("Owned paper specimen") && message.includes("Nile Press")));
    assert.equal(directionCheckpointMatches(checkpoint, { brief, framework: "html", mode, brandContext: directionBrandContext(input.brandProfile, [owned]) }), true);
    assert.equal(directionCheckpointMatches(checkpoint, { brief, framework: "html", mode, brandContext: directionBrandContext(input.brandProfile, [{ ...owned, alt: "Different material" }]) }), false);
    assert.equal(checkpoint.board, board);
  }
  assert.equal(directionBrandContext({ colors: [] }, []), JSON.stringify({ colors: [] }), "Asset-free v1 hashes stay compatible");
  const board = await generateDirectionBoard({ llm: offline, analysis: analyzeBriefLocally(brief), mode: "fast", framework: "html", referenceRepository: repository });
  assert.equal(directionCheckpointMatches(createDirectionCheckpoint(board), { brief, framework: "html", mode: "fast" }), true);
  assert.equal(DirectionRequestSchema.safeParse({ brief, apiKey: "test", ownedAssets: [{ ...owned, url: "https://unapproved.test/image.jpg" }] }).success, false);
});
