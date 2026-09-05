import type { AssetBundle } from "./asset-sourcer";
import type { AssetDirectionContract } from "../domain/project-spec";
import type { AssetDeliveryReceipt } from "./asset-delivery";

export type AssetUsageEvidence = {
  available: number;
  required: number;
  used: number;
  attributed: number;
  plannedScenePlacements: number;
  tracedScenePlacements: number;
  items: Array<{
    id: string;
    url: string;
    source: "owned" | "pexels";
    used: boolean;
    attributionPresent: boolean;
    plannedSceneIds: string[];
    traced: boolean;
    deliveryStatus?: "bundled" | "skipped-unused" | "failed";
  }>;
  warnings: string[];
};

/** Inspect the delivered code, rather than treating a successful search as use. */
export function inspectAssetUsage(
  bundle: AssetBundle,
  code: string,
  direction?: AssetDirectionContract,
  delivery?: AssetDeliveryReceipt
): AssetUsageEvidence {
  const deliveryById = new Map(delivery?.items.map((item) => [item.assetId, item.status]) ?? []);
  const items = bundle.photos.map((photo) => {
    const used = [photo.url, photo.url.replaceAll("&", "&amp;"), photo.url.replaceAll("&", "\\u0026")]
      .some((reference) => code.includes(reference));
    const plannedSceneIds = direction?.sceneDirections
      .filter((scene) => scene.selectedAssetIds.includes(photo.id))
      .map((scene) => scene.sceneId) ?? [];
    const traced = used && new RegExp(`data-verve-asset-id\\s*=\\s*["']${photo.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(code);
    const attributionPresent = photo.source === "owned"
      || !used
      || (code.includes(photo.photographer) && /https?:\/\/(?:www\.)?pexels\.com/i.test(code));
    return {
      id: photo.id,
      url: photo.url,
      source: photo.source,
      used,
      attributionPresent,
      plannedSceneIds,
      traced,
      ...(deliveryById.has(photo.id) ? { deliveryStatus: deliveryById.get(photo.id) } : {}),
    };
  });
  const used = items.filter((item) => item.used).length;
  const attributed = items.filter((item) => item.used && item.attributionPresent).length;
  const plannedScenePlacements = direction?.sceneDirections.filter((scene) => scene.selectedAssetIds.length > 0).length ?? 0;
  const tracedScenePlacements = direction?.sceneDirections.filter((scene) => scene.selectedAssetIds.some((assetId) => items.some((item) => item.id === assetId && item.traced))).length ?? 0;
  const warnings: string[] = [];

  if (used < bundle.mediaRequirement.minimumAssets) {
    const message = `Media usage gate: ${used}/${bundle.mediaRequirement.minimumAssets} required assets are present in the delivered code.`;
    warnings.push(bundle.mediaRequirement.level === "required" ? `BLOCKING: ${message}` : message);
  }
  const missingAttribution = items.filter((item) => item.used && !item.attributionPresent).length;
  if (missingAttribution > 0) {
    warnings.push(`${missingAttribution} used Pexels asset(s) need a visible linked credit before launch.`);
  }
  const remoteStockAssets = items.filter((item) => item.used && item.source === "pexels" && item.deliveryStatus !== "bundled").length;
  if (remoteStockAssets > 0) {
    warnings.push(`${remoteStockAssets} used Pexels asset(s) remain remote preview dependencies; copy them into the project and preserve the source record before production.`);
  }
  if (plannedScenePlacements > tracedScenePlacements) {
    warnings.push(`Asset direction trace: ${tracedScenePlacements}/${plannedScenePlacements} planned scene placements use the assigned asset ID marker.`);
  }
  const unplannedAssets = items.filter((item) => item.used && item.plannedSceneIds.length === 0);
  if (unplannedAssets.length > 0) {
    const message = `Asset direction mismatch: ${unplannedAssets.length} used asset(s) were never assigned to a scene (${unplannedAssets.map((item) => item.id).join(", ")}).`;
    warnings.push(bundle.mediaRequirement.level === "required" ? `BLOCKING: ${message}` : message);
  }

  return {
    available: bundle.photos.length,
    required: bundle.mediaRequirement.minimumAssets,
    used,
    attributed,
    plannedScenePlacements,
    tracedScenePlacements,
    items,
    warnings,
  };
}
