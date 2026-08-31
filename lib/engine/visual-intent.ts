import type { AssetDirectionContract, VerveProjectSpec, VisualLayer } from "../domain/project-spec";

export const FUNCTIONAL_VISUAL_FULFILLMENT_VERSION = 1 as const;

export type VisualIntentSourceEvidence = {
  version: typeof FUNCTIONAL_VISUAL_FULFILLMENT_VERSION;
  metric: "functional-visual-fulfillment";
  status: "pass" | "review" | "fail";
  score: number;
  coverage: {
    scenes: number;
    layers: number;
    purposes: number;
    assets: number | null;
  };
  expectedScenes: number;
  markedScenes: number;
  expectedLayers: VisualLayer[];
  markedLayers: VisualLayer[];
  requiredAssetPlacements: number;
  tracedAssetPlacements: number;
  warnings: string[];
};

function literalAttribute(code: string, name: string, value?: string): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (value === undefined) return new RegExp(`${escapedName}\\s*=`, "i").test(code);
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escapedName}\\s*=\\s*["']${escapedValue}["']`, "i").test(code);
}

function coverage(found: number, expected: number): number {
  return expected === 0 ? 1 : Math.min(1, found / expected);
}

/** A harmonic mean prevents one polished opening from hiding unfulfilled scenes. */
export function harmonicCoverage(values: number[]): number {
  if (values.length === 0) return 1;
  if (values.some((value) => value <= 0)) return 0;
  return values.length / values.reduce((sum, value) => sum + 1 / value, 0);
}

function requiredAssetDirections(contract: AssetDirectionContract) {
  return contract.sceneDirections.filter((direction) => direction.requirement === "required");
}

export function inspectVisualIntentSource(spec: VerveProjectSpec, code: string): VisualIntentSourceEvidence {
  const expectedScenes = spec.assetDirection.sceneDirections.length;
  const markedScenes = spec.assetDirection.sceneDirections.filter((direction) => literalAttribute(code, "data-verve-scene", direction.sceneId)).length;
  const expectedLayers = [...new Set(spec.assetDirection.sceneDirections.flatMap((direction) => direction.expectedLayers))]
    .filter((layer) => layer !== "type");
  const markedLayers = expectedLayers.filter((layer) => literalAttribute(code, "data-verve-layer", layer));
  const purposeMarkers = (code.match(/data-verve-visual-purpose\s*=/gi) ?? []).length;
  const purposeExpectedScenes = spec.assetDirection.sceneDirections.filter((direction) => direction.expectedLayers.some((layer) => layer !== "type")).length;
  const purposefulScenes = Math.min(purposeExpectedScenes, purposeMarkers);
  const assetDirections = requiredAssetDirections(spec.assetDirection);
  const catalogById = new Map(spec.assetDirection.catalog.map((asset) => [asset.id, asset]));
  const tracedAssetPlacements = assetDirections.filter((direction) => direction.selectedAssetIds.some((assetId) => {
    const asset = catalogById.get(assetId);
    return Boolean(asset && code.includes(asset.url) && literalAttribute(code, "data-verve-asset-id", assetId));
  })).length;
  const sceneCoverage = coverage(markedScenes, expectedScenes);
  const layerCoverage = coverage(markedLayers.length, expectedLayers.length);
  const purposeCoverage = coverage(purposefulScenes, purposeExpectedScenes);
  const assetCoverage = assetDirections.length ? coverage(tracedAssetPlacements, assetDirections.length) : null;
  const scoreTerms = [sceneCoverage, layerCoverage, purposeCoverage, ...(assetCoverage === null ? [] : [assetCoverage])];
  const score = Math.round(harmonicCoverage(scoreTerms) * 100);
  const warnings: string[] = [];

  if (markedScenes < expectedScenes) warnings.push(`Visual intent trace: ${markedScenes}/${expectedScenes} story scenes use exact data-verve-scene markers.`);
  if (markedLayers.length < expectedLayers.length) warnings.push(`Visual intent trace: missing functional layer markers for ${expectedLayers.filter((layer) => !markedLayers.includes(layer)).join(", ")}.`);
  if (purposefulScenes < purposeExpectedScenes) warnings.push(`Visual intent trace: ${purposefulScenes}/${purposeExpectedScenes} scenes declare why their non-text visual exists.`);
  if (assetDirections.length && tracedAssetPlacements < assetDirections.length) warnings.push(`Visual intent trace: ${tracedAssetPlacements}/${assetDirections.length} required scene assets have both an exact URL and asset ID marker.`);

  return {
    version: FUNCTIONAL_VISUAL_FULFILLMENT_VERSION,
    metric: "functional-visual-fulfillment",
    status: score >= 80 ? "pass" : score >= 55 ? "review" : "fail",
    score,
    coverage: {
      scenes: Number(sceneCoverage.toFixed(3)),
      layers: Number(layerCoverage.toFixed(3)),
      purposes: Number(purposeCoverage.toFixed(3)),
      assets: assetCoverage === null ? null : Number(assetCoverage.toFixed(3)),
    },
    expectedScenes,
    markedScenes,
    expectedLayers,
    markedLayers,
    requiredAssetPlacements: assetDirections.length,
    tracedAssetPlacements,
    warnings,
  };
}
