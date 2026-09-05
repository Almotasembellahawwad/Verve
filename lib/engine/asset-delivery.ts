import type { VerveProjectSpec } from "../domain/project-spec";
import type { AssetDeliveryFailureCode, AssetDeliveryPort } from "../ports/assets";
import type { ProjectFile } from "../project/types";
import type { GeneratedCode } from "./code-generator";
import type { AssetBundle } from "./asset-sourcer";

export const ASSET_DELIVERY_VERSION = 1 as const;
/** Conservative binary budget before base64 expansion and the surrounding SSE JSON. */
export const MAX_DELIVERED_TOTAL_BYTES = 2_400_000;

export type AssetDeliveryItem = {
  assetId: string;
  status: "bundled" | "skipped-unused" | "failed";
  license: "pexels-license";
  credit: string;
  sourcePageUrl?: string;
  originalUrl: string;
  projectPath?: string;
  publicPath?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp";
  byteSize?: number;
  sha256?: string;
  failureCode?: AssetDeliveryFailureCode | "adapter-unavailable";
};

export type AssetDeliveryReceipt = {
  version: typeof ASSET_DELIVERY_VERSION;
  policy: "allowlisted-copy-with-integrity";
  status: "not-required" | "complete" | "partial" | "failed";
  requested: number;
  bundled: number;
  failed: number;
  totalBytes: number;
  items: AssetDeliveryItem[];
  warnings: string[];
};

export type AssetDeliveryResult = {
  generatedCode: GeneratedCode;
  projectSpec: VerveProjectSpec;
  files: ProjectFile[];
  receipt: AssetDeliveryReceipt;
};

function safeAssetStem(assetId: string): string {
  return assetId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "pexels-asset";
}

function sourceUrlVariants(url: string): string[] {
  return [...new Set([url, url.replaceAll("&", "&amp;"), url.replaceAll("&", "\\u0026")])];
}

function sourceIncludesAsset(source: string, url: string): boolean {
  return sourceUrlVariants(url).some((variant) => source.includes(variant));
}

function replaceExactAssetUrl(generated: GeneratedCode, originalUrl: string, localUrl: string): GeneratedCode {
  const replace = (content: string) => sourceUrlVariants(originalUrl)
    .reduce((output, variant) => output.split(variant).join(localUrl), content);
  return {
    ...generated,
    code: replace(generated.code),
    files: generated.files?.map((file) => ({ ...file, content: replace(file.content) })),
  };
}

function deliveryStatus(requested: number, bundled: number): AssetDeliveryReceipt["status"] {
  if (requested === 0) return "not-required";
  if (bundled === requested) return "complete";
  if (bundled > 0) return "partial";
  return "failed";
}

function remapProjectSpec(spec: VerveProjectSpec, items: AssetDeliveryItem[]): VerveProjectSpec {
  const localUrls = new Map(items.filter((item) => item.status === "bundled" && item.publicPath).map((item) => [item.assetId, item.publicPath!]));
  if (localUrls.size === 0) return spec;
  return {
    ...spec,
    assetDirection: {
      ...spec.assetDirection,
      catalog: spec.assetDirection.catalog.map((asset) => localUrls.has(asset.id) ? { ...asset, url: localUrls.get(asset.id)! } : asset),
    },
  };
}

export async function deliverGeneratedAssets(input: {
  generatedCode: GeneratedCode;
  projectSpec: VerveProjectSpec;
  assetBundle: AssetBundle;
  sourceBeforeDelivery: string;
  deliveryPort?: AssetDeliveryPort;
  signal?: AbortSignal;
}): Promise<AssetDeliveryResult> {
  const { assetBundle, deliveryPort, signal, sourceBeforeDelivery } = input;
  let generatedCode = input.generatedCode;
  const files: ProjectFile[] = [];
  const items: AssetDeliveryItem[] = [];

  for (const asset of assetBundle.photos.filter((photo) => photo.source === "pexels")) {
    if (!sourceIncludesAsset(sourceBeforeDelivery, asset.url)) {
      items.push({
        assetId: asset.id,
        status: "skipped-unused",
        license: "pexels-license",
        credit: asset.credit,
        sourcePageUrl: asset.sourcePageUrl,
        originalUrl: asset.url,
      });
      continue;
    }
    if (!deliveryPort) {
      items.push({
        assetId: asset.id,
        status: "failed",
        license: "pexels-license",
        credit: asset.credit,
        sourcePageUrl: asset.sourcePageUrl,
        originalUrl: asset.url,
        failureCode: "adapter-unavailable",
      });
      continue;
    }

    const delivered = await deliveryPort.fetchApprovedAsset({ assetId: asset.id, url: asset.url, signal });
    if (!delivered.ok) {
      items.push({
        assetId: asset.id,
        status: "failed",
        license: "pexels-license",
        credit: asset.credit,
        sourcePageUrl: asset.sourcePageUrl,
        originalUrl: asset.url,
        failureCode: delivered.code,
      });
      continue;
    }

    const currentTotal = items.reduce((sum, item) => sum + (item.byteSize ?? 0), 0);
    if (currentTotal + delivered.byteSize > MAX_DELIVERED_TOTAL_BYTES) {
      items.push({
        assetId: asset.id,
        status: "failed",
        license: "pexels-license",
        credit: asset.credit,
        sourcePageUrl: asset.sourcePageUrl,
        originalUrl: asset.url,
        failureCode: "body-too-large",
      });
      continue;
    }

    const filename = `${safeAssetStem(asset.id)}-${delivered.sha256.slice(0, 12)}.${delivered.extension}`;
    const publicPath = `/assets/${filename}`;
    const projectPath = generatedCode.framework === "html" ? `assets/${filename}` : `public/assets/${filename}`;
    const sourceReference = generatedCode.framework === "html" ? `./assets/${filename}` : publicPath;
    generatedCode = replaceExactAssetUrl(generatedCode, asset.url, sourceReference);
    files.push({
      path: projectPath,
      content: delivered.content,
      encoding: delivered.encoding,
      mediaType: delivered.mediaType,
      language: "binary",
      role: "asset",
    });
    items.push({
      assetId: asset.id,
      status: "bundled",
      license: "pexels-license",
      credit: asset.credit,
      sourcePageUrl: asset.sourcePageUrl,
      originalUrl: asset.url,
      projectPath,
      publicPath: sourceReference,
      mediaType: delivered.mediaType,
      byteSize: delivered.byteSize,
      sha256: delivered.sha256,
    });
  }

  const requestedItems = items.filter((item) => item.status !== "skipped-unused");
  const bundledItems = requestedItems.filter((item) => item.status === "bundled");
  const failedItems = requestedItems.filter((item) => item.status === "failed");
  const warnings = failedItems.map((item) =>
    `BLOCKING: Asset delivery could not bundle ${item.assetId} (${item.failureCode ?? "unavailable"}); its remote preview URL remains in source.`
  );
  const receipt: AssetDeliveryReceipt = {
    version: ASSET_DELIVERY_VERSION,
    policy: "allowlisted-copy-with-integrity",
    status: deliveryStatus(requestedItems.length, bundledItems.length),
    requested: requestedItems.length,
    bundled: bundledItems.length,
    failed: failedItems.length,
    totalBytes: bundledItems.reduce((sum, item) => sum + (item.byteSize ?? 0), 0),
    items,
    warnings,
  };
  return {
    generatedCode,
    projectSpec: remapProjectSpec(input.projectSpec, items),
    files,
    receipt,
  };
}

export function formatAssetDeliveryReceipt(receipt: AssetDeliveryReceipt): string {
  const rows = receipt.items.length
    ? receipt.items.map((item) => {
        const location = item.status === "bundled"
          ? `\`${item.projectPath}\` · ${item.byteSize} bytes · SHA-256 \`${item.sha256}\``
          : item.status === "failed"
            ? `not bundled · ${item.failureCode}`
            : "not referenced by delivered source";
        const source = item.sourcePageUrl ? `[source page](${item.sourcePageUrl})` : "source page unavailable";
        return `- **${item.assetId}** — ${item.status}; ${location}; ${item.credit}; ${source}; [Pexels License](https://www.pexels.com/license/).`;
      }).join("\n")
    : "- No external stock asset was present in this project.";
  return `## Licensed asset delivery receipt

- Policy: ${receipt.policy}
- Status: ${receipt.status}
- Bundled: ${receipt.bundled}/${receipt.requested} requested assets
- Total bundled bytes: ${receipt.totalBytes}
- This status covers binary delivery for assets referenced by the generated source; the separate Media Usage Gate verifies the brief-level minimum and scene assignments.
- A checksum proves delivered-byte identity; it does not replace the source license or attribution obligation.
- Pexels API projects must retain a prominent Pexels link and should preserve the photographer/photo-page credit recorded above.
- Do not redistribute a stock file on a standalone basis, imply endorsement, or treat this receipt as clearance of third-party people, property, logo, or trademark rights.

${rows}`;
}
