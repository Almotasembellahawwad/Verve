import type { AssetSourcePort, AssetSourceRequest } from "../../ports/assets";
import type { AssetBundle } from "../../engine/asset-sourcer";
import { sourceAssets } from "../../engine/asset-sourcer";
import { CircuitBreaker } from "../../application/circuit-breaker";

export class PexelsAssetSourceAdapter implements AssetSourcePort {
  constructor(
    private readonly pexelsKey?: string,
    private readonly breaker = new CircuitBreaker("assets:pexels")
  ) {}

  source(request: AssetSourceRequest): Promise<AssetBundle> {
    return sourceAssets(
      request.analysis,
      this.pexelsKey,
      request.brandProfile,
      request.ownedAssets,
      this.breaker
    );
  }
}

