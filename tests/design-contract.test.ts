import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDirectionBoard, buildPlanFromDirectionBoard } from "../lib/engine/direction-board";
import { StaticReferenceLibraryRepository } from "../lib/adapters/storage/static-content-repositories";
import { buildTypographyContract, applyTypographyContract } from "../lib/engine/typography-contract";
import { buildVerveProjectSpec, formatVerveProjectSpecForGeneration } from "../lib/engine/project-spec-builder";
import { validateVerveProjectSpec } from "../lib/domain/project-spec";
import { buildGeneratedProject } from "../lib/project/project-builder";
import { validateGeneratedProject } from "../lib/project/project-validator";
import { readProjectDesignContract } from "../lib/project/design-contract";
import { designContractCss } from "../lib/domain/design-contract";
import { DesignContractSchema } from "../lib/engine/design-contract-schema";
import type { AssetBundle } from "../lib/engine/asset-sourcer";
import { projectPreviewKey } from "../lib/project/project-revision";

const assets: AssetBundle = {
  photos: [], icons: [], extractedPalette: [], warnings: [], readinessWarnings: [], assetSummary: "No approved photos.",
  mediaRequirement: { level: "avoid", minimumAssets: 0, reason: "Data and material diagrams.", suggestedSubjects: [] },
  font: { family: "Manrope", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
};

async function fixture(brief = "A Cairo print studio comparing exact paper weights and binding methods.") {
  const analysis = analyzeBriefLocally(brief);
  const board = await generateDirectionBoard({ analysis, mode: "fast", framework: "html", referenceRepository: new StaticReferenceLibraryRepository(), llm: { async complete() { throw new Error("offline"); } } });
  return { analysis, board };
}

test("unified design identity preserves every selected direction and bundled typography, including Arabic", async () => {
  for (const brief of ["A Cairo print studio comparing paper weights and binding.", "مختبر عربي للطلاب يشرح التجارب بالتفاعل والرسوم."]) {
    const { analysis, board } = await fixture(brief);
    for (const direction of board.portfolio.candidates) {
      const chosen = buildPlanFromDirectionBoard(analysis, board, direction.id);
      const fonts = buildTypographyContract(analysis, chosen);
      const plan = applyTypographyContract(chosen, fonts);
      const spec = buildVerveProjectSpec({ analysis, plan, framework: "html", mode: "fast", assetBundle: assets, typographyContract: fonts });
      const identity = spec.designContract!;
      assert.equal(identity.identity.directionId, direction.id);
      assert.equal(identity.identity.experienceModel, direction.descriptors.experienceModel);
      assert.equal(identity.identity.signature.mechanism, spec.visualSystem.signature.mechanism);
      assert.equal(identity.typography.display, fonts.display.stack);
      assert.equal(identity.typography.body, fonts.body.stack);
      assert.deepEqual(identity.palette, plan.colorPalette);
      assert.deepEqual(identity.sceneIds, spec.narrative.scenes.map((scene) => scene.id));
      assert.match(formatVerveProjectSpecForGeneration(spec), /--verve-color-surface/);
      assert.equal(validateVerveProjectSpec(spec).valid, true);
      const wrong = structuredClone(spec);
      wrong.designContract!.typography.display = "Unrelated serif";
      assert.equal(validateVerveProjectSpec(wrong).valid, false);
      delete wrong.designContract;
      assert.equal(validateVerveProjectSpec(wrong).valid, true, "Older ProjectSpec v2 remains readable");
    }
  }
});

test("all framework exports wire one deterministic design stylesheet and validate receipt drift", async () => {
  const { analysis, board } = await fixture();
  const plan = buildPlanFromDirectionBoard(analysis, board);
  const spec = buildVerveProjectSpec({ analysis, plan, framework: "html", mode: "fast", assetBundle: assets });
  for (const framework of ["html", "react", "nextjs"] as const) {
    const code = framework === "html" ? '<!doctype html><html lang="en"><head><title>Paper</title></head><body><h1>Paper specifications</h1></body></html>' : '"use client";\nexport default function App(){return <main><h1>Paper specifications</h1></main>}';
    const project = buildGeneratedProject({ framework, code, componentName: "App", imports: [], setupNotes: "" }, analysis, plan, [], [], undefined, undefined, [], undefined, undefined, [], "", undefined, spec.designContract);
    assert.deepEqual(readProjectDesignContract(project), spec.designContract);
    const previewKey = projectPreviewKey(project, spec);
    const changedSpec = structuredClone(spec);
    changedSpec.designContract!.identity.concept += " amended";
    assert.notEqual(projectPreviewKey(project, changedSpec), previewKey, "A spec-only edit restarts the browser probe");
    const gate = () => validateGeneratedProject(project).checks.find((check) => check.id === "design-contract")!;
    assert.equal(gate().status, "pass", framework);
    const css = project.files.find((file) => file.path.endsWith("verve-design.css"))!;
    assert.equal(css.content, designContractCss(spec.designContract!));
    assert.equal(validateGeneratedProject(project).checks.find((check) => check.id === "design-token-use")!.status, "warning", "An unused token sheet is not identity realization");
    project.files.push({ path: "identity-proof.css", role: "source", language: "css", content: "main{color:var(--verve-color-text-primary);padding:var(--verve-space-4)}" });
    assert.equal(validateGeneratedProject(project).checks.find((check) => check.id === "design-token-use")!.status, "pass");
    css.content = css.content.replace(/--verve-color-accent: #[a-f0-9]{6}/i, "--verve-color-accent: #abcdef");
    assert.equal(gate().status, "fail", "Token drift cannot inherit the old design receipt");
    css.content = designContractCss(spec.designContract!);
    const entry = project.files.find((file) => file.path === (framework === "html" ? "index.html" : framework === "react" ? "src/main.tsx" : "app/layout.tsx"))!;
    entry.content = entry.content.replace(/<link[^>]*verve-design\.css[^>]*>|import "\.\/verve-design\.css";/g, "");
    assert.equal(gate().status, "fail", "Disconnected stylesheets are not delivered tokens");
  }
});

test("nested HTML routes share the same reserved tokens and cannot disconnect their stylesheet", async () => {
  const { analysis, board } = await fixture();
  const plan = buildPlanFromDirectionBoard(analysis, board);
  const contract = buildVerveProjectSpec({ analysis, plan, framework: "html", assetBundle: assets }).designContract!;
  const html = '<!doctype html><html lang="en"><head><title>Paper</title></head><body><main>Paper</main></body></html>';
  const project = buildGeneratedProject({ framework: "html", code: html, componentName: "Paper", imports: [], setupNotes: "", files: [
    { path: "index.html", content: html, language: "html" }, { path: "catalog/detail.html", content: html, language: "html" },
  ] }, analysis, plan, [], [], undefined, undefined, [], undefined, undefined, [], "", undefined, contract);
  const detail = project.files.find((file) => file.path === "catalog/detail.html")!;
  assert.match(detail.content, /href="\.\.\/verve-design.css"/);
  assert.equal(validateGeneratedProject(project).checks.find((check) => check.id === "design-contract")!.status, "pass");
  detail.content = detail.content.replace(/<link[^>]*verve-design\.css[^>]*>/, '<!-- <link rel="stylesheet" href="../verve-design.css" /> -->');
  assert.equal(validateGeneratedProject(project).checks.find((check) => check.id === "design-contract")!.status, "fail", "A commented-out route stylesheet is not delivery");
});

test("design contract parser rejects injected CSS values and colors outside the selected identity", async () => {
  const { analysis, board } = await fixture();
  const plan = buildPlanFromDirectionBoard(analysis, board);
  const contract = buildVerveProjectSpec({ analysis, plan, framework: "html", assetBundle: assets }).designContract!;
  assert.equal(DesignContractSchema.safeParse({ ...contract, colorRoles: { ...contract.colorRoles, accent: "red; } body{display:none}" } }).success, false);
  assert.equal(DesignContractSchema.safeParse({ ...contract, colorRoles: { ...contract.colorRoles, accent: "#abcdef" } }).success, false);
  assert.throws(() => designContractCss({ ...contract, spatial: { ...contract.spatial, spacingRem: [1, 2, 3, 4, 5, Infinity] } }));
});
