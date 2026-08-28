import type { AssetBundle } from "./asset-sourcer";

export type AssetUsageEvidence = {
  available: number;
  required: number;
  used: number;
  attributed: number;
  items: Array<{
    url: string;
    source: "owned" | "pexels";
    used: boolean;
    attributionPresent: boolean;
  }>;
  warnings: string[];
};

/** Inspect the delivered code, rather than treating a successful search as use. */
export function inspectAssetUsage(bundle: AssetBundle, code: string): AssetUsageEvidence {
  const items = bundle.photos.map((photo) => {
    const used = code.includes(photo.url);
    const attributionPresent = photo.source === "owned"
      || !used
      || (code.includes(photo.photographer) && /https?:\/\/(?:www\.)?pexels\.com/i.test(code));
    return { url: photo.url, source: photo.source, used, attributionPresent };
  });
  const used = items.filter((item) => item.used).length;
  const attributed = items.filter((item) => item.used && item.attributionPresent).length;
  const warnings: string[] = [];

  if (used < bundle.mediaRequirement.minimumAssets) {
    const message = `Media usage gate: ${used}/${bundle.mediaRequirement.minimumAssets} required assets are present in the delivered code.`;
    warnings.push(bundle.mediaRequirement.level === "required" ? `BLOCKING: ${message}` : message);
  }
  const missingAttribution = items.filter((item) => item.used && !item.attributionPresent).length;
  if (missingAttribution > 0) {
    warnings.push(`${missingAttribution} used Pexels asset(s) need a visible linked credit before launch.`);
  }

  return {
    available: bundle.photos.length,
    required: bundle.mediaRequirement.minimumAssets,
    used,
    attributed,
    items,
    warnings,
  };
}
