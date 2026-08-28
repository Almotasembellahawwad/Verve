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

