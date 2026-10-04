import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDesignPlanLocally } from "../lib/engine/fast-path";
import { applySelectedDirection } from "../lib/engine/direction-portfolio";
import { buildVerveProjectSpec } from "../lib/engine/project-spec-builder";
import { validateVerveProjectSpec } from "../lib/domain/project-spec";
import type { DirectionOpeningMode, ExperienceModel } from "../lib/domain/design-direction";
import type { AssetBundle } from "../lib/engine/asset-sourcer";

// Offline compiler regressions, not provider-generated websites or screenshots.
// Holding the experience model constant isolates whether opening intent survives
// compilation instead of changing only palette/prose.
const pairedBriefs: Array<{ id: string; brief: string; model: ExperienceModel; openings: [DirectionOpeningMode, DirectionOpeningMode] }> = [
  {
    id: "architecture",
    brief: "An Abu Dhabi interior design practice for residential and hospitality projects. Visitors inspect approved project photography and material evidence before requesting a consultation. No invented projects, awards or testimonials. Single-page website.",
    model: "spatial-map", openings: ["media-first", "index-first"],
  },
  {
    id: "cairo-print",
    brief: "An independent Cairo print studio has 5 product lines. Riso Notebook — A5, 80 pages, terracotta / olive / charcoal covers, 120gsm recycled paper, EGP 450. Wholesale bookshops compare paper weight, binding type, batch size and price; individuals inspect each line before ordering. Do not invent the other four specifications. Avoid beige palettes, kraft-paper aesthetics and made with love copy. Single-page website.",
    model: "collection-browser", openings: ["index-first", "question-first"],
  },
  {
    id: "carbon-workbench",
    brief: "A carbon operations dashboard. Team A: 120 tCO2e, reporting date 2026-09-01. Team B: 80 tCO2e, reporting date 2026-09-02. Operators compare records, filter teams and inspect reporting dates. Show which record is selected without inventing a baseline or claimed reduction. Single-page website.",
    model: "task-workbench", openings: ["task-first", "canvas-first"],
  },
  {
    id: "arabic-reservation",
    brief: "صفحة واحدة لمطعم في القاهرة بالعربية. قاعة داخلية أو فناء خارجي. موعد الغداء الساعة ١ ظهراً وموعد العشاء الساعة ٨ مساءً. يختار الزائر المكان والموعد وعدد الضيوف ويراجع اختياراته قبل طلب الحجز. لا تدّع تأكيد الحجز دون خدمة متصلة ولا تخترع أسعاراً أو تقييمات. تجربة واضحة وغنية بصرياً تحترم RTL.",
    model: "guided-conversation", openings: ["question-first", "story-first"],
  },
];

const noMedia: AssetBundle = {
  photos: [], icons: [], extractedPalette: [], warnings: [], readinessWarnings: [],
  font: { family: "Arial", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
  mediaRequirement: { level: "avoid", minimumAssets: 0, reason: "Offline compilation, not an asset-delivery pass", suggestedSubjects: [] },
  assetSummary: "No approved images supplied to the offline regression.",
};

function compilePair(fixture: (typeof pairedBriefs)[number]) {
  const analysis = analyzeBriefLocally(fixture.brief);
  const seed = generateDesignPlanLocally(analysis);
  assert.ok(seed.directionPortfolio);
  const original = seed.directionPortfolio.candidates[0];
  const candidates = fixture.openings.map((openingMode) => ({
    ...original,
    id: `${fixture.id}-${openingMode}`,
    descriptors: { ...original.descriptors, experienceModel: fixture.model, openingMode },
  }));
  const plan = { ...seed, directionPortfolio: { ...seed.directionPortfolio, candidates } };
  return candidates.map((candidate) => buildVerveProjectSpec({
    analysis, plan: applySelectedDirection(plan, candidate.id), framework: "html", mode: "fast", assetBundle: noMedia,
  }));
}

for (const fixture of pairedBriefs) {
  test(`paired opening intent survives compilation: ${fixture.id}`, () => {
    const [left, right] = compilePair(fixture);
    assert.equal(validateVerveProjectSpec(left).valid, true);
    assert.equal(validateVerveProjectSpec(right).valid, true);
    assert.equal(left.experience.model, right.experience.model);
    assert.deepEqual(left.facts, right.facts, "Opening variation must not invent content");
    assert.deepEqual(left.briefEvidence, right.briefEvidence);
    assert.deepEqual(left.experience.routes.map((route) => route.path), ["/"]);
    assert.deepEqual(right.experience.routes.map((route) => route.path), ["/"]);
    assert.equal(left.complexity.maxSourceFiles, 8);
    assert.equal(right.complexity.maxSourceFiles, 8);
    assert.notEqual(left.designContract!.identity.directionId, right.designContract!.identity.directionId);
    assert.notDeepEqual(
      left.narrative.compositionGenome!.assignments[0].genes,
      right.narrative.compositionGenome!.assignments[0].genes,
      "A different opening must not be reduced to a new label on the same spatial composition",
    );
    for (const spec of [left, right]) {
      assert.ok(spec.narrative.compositionGenome!.distinctStructures >= 3);
      assert.ok(spec.narrative.compositionGenome!.minimumAdjacentDistance >= 0.3);
    }
    assert.deepEqual(compilePair(fixture), [left, right], "Compiler decisions remain reproducible");
  });
}
