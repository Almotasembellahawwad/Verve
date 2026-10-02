import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDesignPlanLocally } from "../lib/engine/fast-path";
import { createFallbackDirectionPortfolio } from "../lib/engine/direction-portfolio";
import { buildBriefEvidenceContract } from "../lib/engine/brief-evidence";
import { buildVisualNarrativeContract, deriveNarrativeRoutes } from "../lib/engine/visual-narrative-builder";
import type { AssetBundle } from "../lib/engine/asset-sourcer";
import type { DesignPlan } from "../lib/engine/plan-generator";
import type { ExperienceModel } from "../lib/domain/project-spec";

const noMedia: AssetBundle = {
  photos: [], icons: [], extractedPalette: [], warnings: [], readinessWarnings: [],
  font: { family: "Arial", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
  mediaRequirement: { level: "avoid", minimumAssets: 0, reason: "Routing test", suggestedSubjects: [] },
  assetSummary: "No external assets.",
};

function planFor(brief: string, model: ExperienceModel, openingMode: "task-first" | "index-first" | "question-first" | "canvas-first" | "story-first" | "media-first" = "task-first"): DesignPlan {
  const analysis = analyzeBriefLocally(brief);
  const plan = generateDesignPlanLocally(analysis);
  const portfolio = createFallbackDirectionPortfolio(plan, analysis);
  const candidate = { ...portfolio.candidates[0], descriptors: { ...portfolio.candidates[0].descriptors, experienceModel: model, openingMode } };
  return { ...plan, directionPortfolio: { ...portfolio, candidates: [candidate], selectedDirectionId: candidate.id } };
}

function narrativeFor(brief: string, model: ExperienceModel, openingMode?: Parameters<typeof planFor>[2]) {
  const analysis = analyzeBriefLocally(brief);
  const plan = planFor(brief, model, openingMode);
  return buildVisualNarrativeContract({
    analysis, plan, profile: "balanced", routes: deriveNarrativeRoutes(analysis, "balanced", model, 5),
    assetBundle: noMedia, briefEvidence: buildBriefEvidenceContract(brief),
  });
}

test("complexity ceilings do not manufacture supporting pages or comparison exports", () => {
  for (const profile of ["focused", "balanced", "systemic"] as const) {
    const analysis = analyzeBriefLocally("A local studio website. Start a qualified enquiry.");
    // Even inferred jobs containing choose/decision must not create destinations.
    analysis.primaryJob = "Help buyers choose and compare their decision options";
    assert.deepEqual(deriveNarrativeRoutes(analysis, profile, "narrative-scroll", 5).map((route) => route.path), ["/"]);
  }
});

test("portfolio and operational tasks stay inline unless separate pages are requested", () => {
  for (const brief of [
    "A portfolio for a senior motion designer. Show selected projects and let visitors contact the designer.",
    "An operations analytics workspace with a dashboard and supplier catalog. Teams compare suppliers, monitor a workflow, inspect evidence and request a quote.",
  ]) {
    assert.deepEqual(deriveNarrativeRoutes(analyzeBriefLocally(brief), "systemic", "collection-browser", 5).map((route) => route.path), ["/"]);
  }
});

test("print specifications become an inline decision scene, not an automatic compare page", () => {
  const brief = "A print studio with 5 product lines. Compare paper weight, binding type, batch size, and price. Riso Notebook — A5, 80 pages, 120gsm paper, EGP 450.";
  const narrative = narrativeFor(brief, "collection-browser", "index-first");
  assert.equal(new Set(narrative.scenes.map((scene) => scene.routeId)).size, 1);
  assert.ok(narrative.scenes.some((scene) => scene.narrativeRole === "choice"));
  assert.ok(narrative.scenes.some((scene) => scene.narrativeRole === "proof"));
  assert.ok(narrative.scenes.every((scene) => !scene.id.includes("compare")));
});

test("genuine explicit multi-page requests retain named destinations within the mode budget", () => {
  const analysis = analyzeBriefLocally("Build a multi-page practice website with Home, Projects, About and Contact pages.");
  assert.deepEqual(deriveNarrativeRoutes(analysis, "balanced", "narrative-scroll", 5).map((route) => route.path), ["/", "/projects", "/about", "/contact"]);
  assert.equal(deriveNarrativeRoutes(analysis, "balanced", "narrative-scroll", 3).length, 3);
  const explicitComparison = analyzeBriefLocally("Build a supplier dashboard and a separate comparison page at /compare.");
  assert.deepEqual(deriveNarrativeRoutes(explicitComparison, "systemic", "task-workbench", 5).map((route) => route.path), ["/", "/compare"]);
});

test("single-page collection requests and plural product records are not page-list intent", () => {
  const analysis = analyzeBriefLocally("Build a single-page portfolio with project records, evidence, and contact. The notebook has 80 pages: recycled paper, bound in batches.");
  assert.deepEqual(deriveNarrativeRoutes(analysis, "balanced", "collection-browser", 5).map((route) => route.path), ["/"]);
  const print = analyzeBriefLocally("5 products in production. Notebook pages: recycled paper. Buyers compare specifications.");
  assert.deepEqual(deriveNarrativeRoutes(print, "systemic", "collection-browser", 5).map((route) => route.path), ["/"]);
});

test("negated single-page styling does not override explicitly requested pages", () => {
  for (const exclusion of ["Avoid a single-page design.", "Not single-page.", "Don't build a one-page brochure.", "لا اريد صفحة واحدة.", "ليس صفحة واحدة."]) {
    const analysis = analyzeBriefLocally(`Build Home, Projects and Contact pages. ${exclusion}`);
    assert.deepEqual(deriveNarrativeRoutes(analysis, "balanced", "collection-browser", 5).map((route) => route.path), ["/", "/projects", "/contact"]);
  }
  const affirmative = analyzeBriefLocally("Build a single-page practice website. Keep Projects and Contact on the same page.");
  assert.deepEqual(deriveNarrativeRoutes(affirmative, "systemic", "collection-browser", 5).map((route) => route.path), ["/"]);
  const arabic = analyzeBriefLocally("أريد صفحة واحدة لمكتب محاماة. إعلان واضح عن الخدمة.");
  assert.deepEqual(deriveNarrativeRoutes(arabic, "balanced", "narrative-scroll", 5).map((route) => route.path), ["/"]);
});

test("Arabic page intent and explicit exclusions remain authoritative", () => {
  const analysis = analyzeBriefLocally("موقع متعدد الصفحات: الرئيسية، المشاريع، من نحن، التواصل.");
  assert.deepEqual(deriveNarrativeRoutes(analysis, "balanced", "narrative-scroll", 5).map((route) => route.path), ["/", "/projects", "/about", "/contact"]);
  for (const brief of ["A product catalog. Do not create a comparison page or /compare.", "موقع منتجات بدون صفحة مقارنة."]) {
    assert.deepEqual(deriveNarrativeRoutes(analyzeBriefLocally(brief), "systemic", "collection-browser", 5).map((route) => route.path), ["/"]);
  }
});

test("declared page lists preserve named pages, not a portfolio artifact descriptor", () => {
  for (const brief of [
    "Build a multi-page portfolio with Home, Projects, About and Contact pages.",
    "Build Home, Projects, About and Contact pages for a motion designer.",
    "Build a multi-page portfolio with Home, Projects, About and Contact.",
    "Pages:\n- Home\n- Projects\n- About\n- Contact",
  ]) {
    assert.deepEqual(deriveNarrativeRoutes(analyzeBriefLocally(brief), "balanced", "collection-browser", 5).map((route) => route.path), ["/", "/projects", "/about", "/contact"]);
  }
});

test("custom safe routes and multiple pages of the same semantic kind are preserved", () => {
  const cases = [
    { brief: "Build a website with separate /services and /team routes.", paths: ["/", "/services", "/team"] },
    { brief: "Create a separate services page for an interior practice.", paths: ["/", "/services"] },
    { brief: "Build a multi-page shop with Products and Collection pages, and a Checkout page.", paths: ["/", "/products", "/collection", "/checkout"] },
    { brief: "Pages: Home, Services, Team, Case Studies, Care Guide.", paths: ["/", "/services", "/team", "/case-studies", "/care-guide"] },
  ];
  for (const { brief, paths } of cases) assert.deepEqual(deriveNarrativeRoutes(analyzeBriefLocally(brief), "systemic", "collection-browser", 5).map((route) => route.path), paths);
});

test("frontend route extraction excludes external URLs and source/asset/backend paths", () => {
  const brief = "Create an evidence page. Inspiration: https://example.com/team. Use ./styles.css, /shared.js and /assets/logo.svg; backend endpoint /api/contact.";
  assert.deepEqual(deriveNarrativeRoutes(analyzeBriefLocally(brief), "focused", "narrative-scroll", 5).map((route) => route.path), ["/", "/evidence"]);
});

test("mode ceilings disclose requested routes omitted from this generation", () => {
  const brief = "Pages: Home, Projects, About, Contact, Services, Team.";
  const routes = deriveNarrativeRoutes(analyzeBriefLocally(brief), "focused", "collection-browser", 3);
  assert.deepEqual(routes.map((route) => route.path), ["/", "/projects", "/about"]);
  assert.match(routes[0].purpose, /Route budget 3/);
  assert.match(routes[0].purpose, /\/contact, \/services, \/team/);
  assert.match(routes[0].purpose, /do not pretend/);
});

test("unsupported story roles are not filled into every brief", () => {
  const brief = "An employment law firm specializing in discrimination. Start a confidential consultation on its website.";
  const narrative = narrativeFor(brief, "narrative-scroll", "media-first");
  assert.equal(narrative.scenes.length, 3);
  assert.deepEqual(narrative.scenes.map((scene) => scene.narrativeRole), ["hook", "choice", "payoff"]);
  assert.ok(!narrative.scenes.some((scene) => scene.narrativeRole === "proof" || scene.narrativeRole === "tension"));
  const arabic = narrativeFor("موقع لمكتب محاماة يقدم استشارة سرية.", "narrative-scroll", "media-first");
  assert.deepEqual(arabic.scenes.map((scene) => scene.narrativeRole), ["hook", "choice", "payoff"]);
});

test("selected experience models materially order supported content roles", () => {
  const brief = "A collection of 5 products with verified material specifications and price. Let buyers compare available binding and paper weight.";
  const models: ExperienceModel[] = ["task-workbench", "spatial-map", "narrative-scroll", "guided-conversation", "collection-browser", "live-canvas"];
  const narratives = models.map((model) => narrativeFor(brief, model, "media-first"));
  const sequences = new Set(narratives.map((narrative) => narrative.scenes.map((scene) => scene.narrativeRole).join("/")));
  assert.ok(sequences.size >= 3);
  assert.ok(narratives.every((narrative) => !narrative.scenes.some((scene) => scene.narrativeRole === "tension")));
  assert.ok(narratives.every((narrative) => narrative.scenes.some((scene) => scene.narrativeRole === "payoff")));
});
