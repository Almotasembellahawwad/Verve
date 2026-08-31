import type { BriefAnalysis } from "../engine/brief-analyzer";
import type { AssetBundle } from "../engine/asset-sourcer";
import type { BrandProfile, OwnedAssetManifest } from "../project/brand-kit";

export type AssetSourceRequest = {
  analysis: BriefAnalysis;
  pexelsKey?: string;
  brandProfile?: BrandProfile;
  ownedAssets?: OwnedAssetManifest[];
};

export interface AssetSourcePort {
  source(request: AssetSourceRequest): Promise<AssetBundle>;
}

export const ASSET_DELIVERY_FAILURE_CODES = [
  "origin-not-approved",
  "timeout",
  "upstream-rejected",
  "body-too-large",
  "unsupported-media",
  "signature-mismatch",
  "unavailable",
] as const;

export type AssetDeliveryFailureCode = typeof ASSET_DELIVERY_FAILURE_CODES[number];

export type AssetDeliveryRequest = {
  assetId: string;
  url: string;
  signal?: AbortSignal;
};

export type AssetDeliveryPayload = {
  ok: true;
  content: string;
  encoding: "base64";
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  byteSize: number;
  sha256: string;
};

export type AssetDeliveryFailure = {
  ok: false;
  code: AssetDeliveryFailureCode;
};

/** Fetches bytes only from an adapter-owned allowlist and never invents a fallback. */
export interface AssetDeliveryPort {
  fetchApprovedAsset(request: AssetDeliveryRequest): Promise<AssetDeliveryPayload | AssetDeliveryFailure>;
}
