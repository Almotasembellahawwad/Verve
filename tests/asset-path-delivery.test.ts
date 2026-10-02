import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverGeneratedAssets, formatAssetDeliveryReceipt, MAX_DELIVERED_TOTAL_BYTES } from "../lib/engine/asset-delivery";
import { analyzeBriefLocally } from "../lib/engine/brief-analyzer";
import { generateDesignPlanLocally } from "../lib/engine/fast-path";
import { buildVerveProjectSpec } from "../lib/engine/project-spec-builder";
import type { AssetBundle } from "../lib/engine/asset-sourcer";
import type { GeneratedCode, GeneratedSourceFile } from "../lib/engine/code-generator";
import type { VerveProjectFramework } from "../lib/domain/project-spec";
import type { AssetDeliveryPort } from "../lib/ports/assets";

const REMOTE_URL = "https://images.pexels.com/photos/42/pexels-photo-42.jpeg?auto=compress&fit=crop&w=940";
const ASSET_PATH = "assets/pexels-42-aaaaaaaaaaaa.jpg";
const SOURCE_PAGE = "https://www.pexels.com/photo/42/";
const DELIVERY_PORT: AssetDeliveryPort = {
  async fetchApprovedAsset() {
    return {
      ok: true,
      content: "/9j/",
      encoding: "base64",
      mediaType: "image/jpeg",
      extension: "jpg",
      byteSize: 3,
      sha256: "a".repeat(64),
    };
  },
};

function fixture(framework: VerveProjectFramework = "html") {
  const analysis = analyzeBriefLocally("An architecture portfolio with material photography and project evidence.");
  const plan = generateDesignPlanLocally(analysis);
  const assetBundle: AssetBundle = {
    photos: [{
      id: "pexels:42", url: REMOTE_URL, alt: "Brick facade", photographer: "Example Photographer",
      credit: "Photo by Example Photographer on Pexels", source: "pexels", sourcePageUrl: SOURCE_PAGE,
      dominant_hex: "#67594d",
    }],
    icons: [], extractedPalette: [], warnings: [], readinessWarnings: [],
    font: { family: "Arial", weights: [400, 700], cssImport: "none", isGoogleFont: false, source: "fallback" },
    mediaRequirement: { level: "required", minimumAssets: 1, reason: "Built work requires visual evidence.", suggestedSubjects: ["facade"] },
    assetSummary: "One approved photograph.",
  };
  const projectSpec = buildVerveProjectSpec({ analysis, plan, framework, mode: "creative", assetBundle });
  return { assetBundle, projectSpec };
}

async function deliverFiles(files: GeneratedSourceFile[], framework: VerveProjectFramework = "html", entryPath?: string) {
  const generatedCode: GeneratedCode = {
    code: files[0]!.content, files, framework, entryPath: entryPath ?? files[0]!.path,
    componentName: "DeliveryFixture", imports: [], setupNotes: "test",
  };
  return deliverGeneratedAssets({
    ...fixture(framework), generatedCode, sourceBeforeDelivery: files.map((file) => file.content).join("\n"),
    deliveryPort: DELIVERY_PORT,
  });
}

test("HTML stock assets resolve from root, nested, and deeply nested pages", async () => {
  const delivery = await deliverFiles([
    { path: "index.html", content: `<img src="${REMOTE_URL}">`, language: "html" },
    { path: "projects/index.html", content: `<img src="${REMOTE_URL}">`, language: "html" },
    { path: "projects/residential/index.html", content: `<img src="${REMOTE_URL}">`, language: "html" },
  ]);
  const delivered = delivery.generatedCode.files!;
  assert.equal(delivered[0]!.content, `<img src="./${ASSET_PATH}">`);
  assert.equal(delivered[1]!.content, `<img src="../${ASSET_PATH}">`);
  assert.equal(delivered[2]!.content, `<img src="../../${ASSET_PATH}">`);
  assert.equal(delivery.generatedCode.code, delivered[0]!.content);
  assert.equal(delivery.files[0]!.path, ASSET_PATH);
});

test("CSS image URLs resolve from the stylesheet rather than a route or the project root", async () => {
  const delivery = await deliverFiles([
    { path: "index.html", content: '<link rel="stylesheet" href="styles/theme/site.css">', language: "html" },
    { path: "styles.css", content: `.photo{background:url("${REMOTE_URL}")}`, language: "css" },
    { path: "styles/theme/site.css", content: `.photo{background:url('${REMOTE_URL}')}`, language: "css" },
    { path: "assets/theme.css", content: `.photo{background-image:url(${REMOTE_URL})}`, language: "css" },
  ]);
  assert.equal(delivery.generatedCode.files![1]!.content, `.photo{background:url("./${ASSET_PATH}")}`);
  assert.equal(delivery.generatedCode.files![2]!.content, `.photo{background:url('../../${ASSET_PATH}')}`);
  assert.equal(delivery.generatedCode.files![3]!.content, ".photo{background-image:url(./pexels-42-aaaaaaaaaaaa.jpg)}");
});

test("HTML inline CSS follows the page base and encoded asset URLs are localized", async () => {
  const htmlEncodedUrl = REMOTE_URL.replaceAll("&", "&amp;");
  const unicodeEncodedUrl = REMOTE_URL.replaceAll("&", "\\u0026");
  const delivery = await deliverFiles([
    { path: "index.html", content: `<img src="${REMOTE_URL}">`, language: "html" },
    { path: "project/index.html", content: `<img src="${htmlEncodedUrl}"><style>.photo{background:url("${REMOTE_URL}")}</style><script>const photo="${unicodeEncodedUrl}";</script>`, language: "html" },
  ]);
  assert.equal(delivery.generatedCode.files![1]!.content, `<img src="../${ASSET_PATH}"><style>.photo{background:url("../${ASSET_PATH}")}</style><script>const photo="../${ASSET_PATH}";</script>`);
});

test("the compatibility code adapter is the transformed entry, including a nested entry", async () => {
  const generatedCode: GeneratedCode = {
    framework: "html", entryPath: "preview/index.html", componentName: "NestedFixture", imports: [], setupNotes: "test",
    code: "stale compatibility entry",
    files: [{ path: "preview/index.html", content: `<img src="${REMOTE_URL}">`, language: "html" }],
  };
  const delivery = await deliverGeneratedAssets({
    ...fixture(), generatedCode, sourceBeforeDelivery: generatedCode.files![0]!.content, deliveryPort: DELIVERY_PORT,
  });
  assert.equal(delivery.generatedCode.code, `<img src="../${ASSET_PATH}">`);
  assert.equal(delivery.generatedCode.code, delivery.generatedCode.files![0]!.content);
});

test("legacy entry-only HTML still receives a local asset path", async () => {
  const delivery = await deliverGeneratedAssets({
    ...fixture(), sourceBeforeDelivery: `<img src="${REMOTE_URL}">`, deliveryPort: DELIVERY_PORT,
    generatedCode: { code: `<img src="${REMOTE_URL}">`, framework: "html", componentName: "LegacyFixture", imports: [], setupNotes: "test" },
  });
  assert.equal(delivery.generatedCode.code, `<img src="./${ASSET_PATH}">`);
  assert.equal(delivery.generatedCode.files, undefined);
});

test("HTML script DOM URLs retain the entry document base, not the script directory", async () => {
  const delivery = await deliverFiles([
    { path: "index.html", content: '<script src="scripts/app.js"></script>', language: "html" },
    { path: "scripts/app.js", content: `photo.src="${REMOTE_URL}";`, language: "javascript" },
  ]);
  assert.equal(delivery.generatedCode.files![1]!.content, `photo.src="./${ASSET_PATH}";`);
});

for (const framework of ["react", "nextjs"] as const) {
  test(`${framework} stock assets remain root-absolute and live under public/assets`, async () => {
    const entryPath = framework === "react" ? "src/App.tsx" : "app/page.tsx";
    const delivery = await deliverFiles([
      { path: entryPath, content: `export default function App(){return <img src="${REMOTE_URL}"/>}`, language: "tsx" },
      { path: "components/Detail.tsx", content: `const image="${REMOTE_URL}";`, language: "tsx" },
      { path: "src/styles/theme.css", content: `.photo{background:url("${REMOTE_URL}")}`, language: "css" },
    ], framework);
    assert.equal(delivery.files[0]!.path, `public/${ASSET_PATH}`);
    assert.ok(delivery.generatedCode.files!.every((file) => file.content.includes(`/${ASSET_PATH}`)));
    assert.ok(delivery.generatedCode.files!.every((file) => !file.content.includes(`../${ASSET_PATH}`)));
    assert.equal(delivery.generatedCode.code, delivery.generatedCode.files![0]!.content);
    assert.equal(delivery.projectSpec.assetDirection.catalog[0]!.url, `/${ASSET_PATH}`);
  });
}

test("path localization preserves binary integrity, license, source record, and catalog identity", async () => {
  const delivery = await deliverFiles([{ path: "index.html", content: `<img src="${REMOTE_URL}">`, language: "html" }]);
  assert.equal(delivery.receipt.status, "complete");
  assert.equal(delivery.receipt.totalBytes, 3);
  assert.equal(delivery.receipt.items[0]!.sha256, "a".repeat(64));
  assert.equal(delivery.receipt.items[0]!.license, "pexels-license");
  assert.equal(delivery.receipt.items[0]!.sourcePageUrl, SOURCE_PAGE);
  assert.equal(delivery.receipt.items[0]!.originalUrl, REMOTE_URL);
  assert.equal(delivery.receipt.items[0]!.projectPath, ASSET_PATH);
  assert.equal(delivery.receipt.items[0]!.publicPath, `./${ASSET_PATH}`);
  assert.equal(delivery.projectSpec.assetDirection.catalog[0]!.url, `./${ASSET_PATH}`);
  assert.equal(delivery.files[0]!.content, "/9j/");
  assert.equal(delivery.files[0]!.encoding, "base64");
  assert.match(formatAssetDeliveryReceipt(delivery.receipt), /does not prove that resource links resolve or images render/);
});

test("unused assets are still skipped without fetching or altering source", async () => {
  const generatedCode: GeneratedCode = { code: "<h1>Text only</h1>", framework: "html", componentName: "NoMedia", imports: [], setupNotes: "test" };
  const delivery = await deliverGeneratedAssets({
    ...fixture(), generatedCode, sourceBeforeDelivery: generatedCode.code,
    deliveryPort: { async fetchApprovedAsset() { throw new Error("An unused asset must not be fetched."); } },
  });
  assert.equal(delivery.receipt.status, "not-required");
  assert.equal(delivery.receipt.items[0]!.status, "skipped-unused");
  assert.deepEqual(delivery.files, []);
  assert.equal(delivery.generatedCode.code, generatedCode.code);
});

test("failed or over-budget bytes are not localized or misreported as complete", async () => {
  const generatedCode: GeneratedCode = { code: `<img src="${REMOTE_URL}">`, framework: "html", componentName: "FailedMedia", imports: [], setupNotes: "test" };
  for (const deliveryPort of [
    { async fetchApprovedAsset() { return { ok: false as const, code: "timeout" as const }; } },
    { async fetchApprovedAsset(request) { const payload = await DELIVERY_PORT.fetchApprovedAsset(request); return payload.ok ? { ...payload, byteSize: MAX_DELIVERED_TOTAL_BYTES + 1 } : payload; } } satisfies AssetDeliveryPort,
  ]) {
    const delivery = await deliverGeneratedAssets({ ...fixture(), generatedCode, sourceBeforeDelivery: generatedCode.code, deliveryPort });
    assert.equal(delivery.receipt.status, "failed");
    assert.equal(delivery.receipt.bundled, 0);
    assert.equal(delivery.receipt.totalBytes, 0);
    assert.equal(delivery.generatedCode.code, generatedCode.code);
    assert.deepEqual(delivery.files, []);
    assert.ok(delivery.receipt.warnings[0]!.startsWith("BLOCKING:"));
  }
});
