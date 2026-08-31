import {
  ASSET_DIRECTION_VERSION,
  type AssetDirectionContract,
  type AssetNarrativeFunction,
  type DirectedAsset,
  type SceneAssetDirection,
  type StoryScene,
  type VisualLayer,
  type VisualNarrativeContract,
} from "../domain/project-spec";
import type { OwnedAssetManifest } from "../project/brand-kit";
import type { AssetBundle } from "./asset-sourcer";

function words(value: string): Set<string> {
  return new Set(value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2));
}

function narrativeFunction(scene: StoryScene): AssetNarrativeFunction {
  if (scene.narrativeRole === "hook") return "orientation";
  if (scene.narrativeRole === "tension") return "material-context";
  if (scene.narrativeRole === "discovery") return "exploration";
  if (scene.narrativeRole === "proof") return "evidence";
  if (scene.narrativeRole === "choice") return "comparison";
  return "state-feedback";
}

function mediumLayer(scene: StoryScene): VisualLayer | null {
  if (scene.medium === "photography" || scene.medium === "illustration") return "media";
  if (scene.medium === "data") return "data";
  if (scene.medium === "diagram" || scene.medium === "spatial" || scene.medium === "generative") return "shape";
  if (scene.medium === "interface") return "interaction";
  return null;
}

function expectedLayers(scene: StoryScene, narrative: VisualNarrativeContract): VisualLayer[] {
  const layers: VisualLayer[] = ["type"];
  const medium = mediumLayer(scene);
  if (medium) layers.push(medium);
  if ((scene.action || scene.visibleConsequence || scene.narrativeRole === "choice" || scene.narrativeRole === "payoff") && !layers.includes("interaction")) {
    layers.push("interaction");
  }
  if (narrative.richness.requiredLayers.includes("motion") && scene.visibleConsequence) layers.push("motion");
  return layers;
}

function framingFor(scene: StoryScene): SceneAssetDirection["framing"] {
  if (scene.narrativeRole === "proof") {
    return { scale: "detail", aspectRatio: "4:3", focalAnchor: "subject-led", cropBehavior: "Preserve material evidence and identifying detail at every breakpoint; never crop away the proof." };
  }
  if (scene.narrativeRole === "choice") {
    return { scale: "interface", aspectRatio: "adaptive", focalAnchor: "leading", cropBehavior: "Keep comparable objects aligned and preserve labels before decorative context." };
  }
  if (scene.narrativeRole === "hook" || scene.narrativeRole === "tension") {
    return { scale: "environment", aspectRatio: "3:2", focalAnchor: "subject-led", cropBehavior: "Let the composition expand, but preserve the primary object, decision evidence, and action in the first viewport." };
  }
  if (scene.narrativeRole === "discovery") {
    return { scale: "object", aspectRatio: "1:1", focalAnchor: "center", cropBehavior: "Use repeatable object framing so items remain comparable without becoming a generic card grid." };
  }
  return { scale: "interface", aspectRatio: "adaptive", focalAnchor: "trailing", cropBehavior: "Keep the action and its visible consequence in the same responsive composition." };
}

function directedCatalog(bundle: AssetBundle, ownedAssets: OwnedAssetManifest[]): DirectedAsset[] {
  const photos = bundle.photos.map((photo) => ({
    id: photo.id,
    url: photo.url,
    alt: photo.alt,
    source: photo.source,
    license: photo.source === "owned" ? "user-owned" as const : "pexels-license" as const,
    credit: photo.credit,
    sourcePageUrl: photo.sourcePageUrl,
  }));
  const photoUrls = new Set(photos.map((photo) => photo.url));
  const identityAssets: DirectedAsset[] = ownedAssets
    .filter((asset) => asset.kind === "logo" && !photoUrls.has(asset.url))
    .map((asset) => ({
      id: `owned:${asset.path}`,
      url: asset.url,
      alt: asset.alt,
      source: "owned" as const,
      license: "user-owned" as const,
      credit: "User-owned identity asset",
    }));
  return [...photos, ...identityAssets];
}

function choosePhoto(scene: StoryScene, photos: DirectedAsset[], uses: Map<string, number>): DirectedAsset | undefined {
  if (photos.length === 0) return undefined;
  const sceneWords = words(`${scene.focalObject} ${scene.evidence.join(" ")} ${scene.purpose}`);
  return [...photos].sort((left, right) => {
    const relevance = (asset: DirectedAsset) => {
      const overlap = [...words(asset.alt)].filter((word) => sceneWords.has(word)).length;
      const ownership = asset.source === "owned" ? 2 : 0;
      return overlap * 3 + ownership - (uses.get(asset.id) ?? 0) * 2;
    };
    return relevance(right) - relevance(left) || left.id.localeCompare(right.id);
  })[0];
}

function needsExternalAsset(scene: StoryScene): boolean {
  return scene.medium === "photography";
}

function sourcePolicy(scene: StoryScene, hasApprovedAsset: boolean, mediaPolicy: AssetBundle["mediaRequirement"]["level"]): SceneAssetDirection["sourcePolicy"] {
  if (mediaPolicy === "avoid" && needsExternalAsset(scene)) return "no-visual-asset";
  if (needsExternalAsset(scene)) return hasApprovedAsset || mediaPolicy === "required" ? "approved-only" : "approved-or-programmatic";
  if (scene.medium === "typography") return "no-visual-asset";
  return "programmatic-only";
}

function requirementFor(scene: StoryScene, bundle: AssetBundle): SceneAssetDirection["requirement"] {
  if (bundle.mediaRequirement.level === "avoid" && needsExternalAsset(scene)) return "avoid";
  if (needsExternalAsset(scene) && (bundle.mediaRequirement.level === "required" || scene.narrativeRole === "proof")) return "required";
  return needsExternalAsset(scene) || scene.medium === "illustration" ? "supporting" : "not-applicable";
}

function fallbackFor(scene: StoryScene, hasApprovedAsset: boolean, suggestedSubjects: string[]): string {
  if (hasApprovedAsset) return "If the assigned asset becomes unavailable, keep its measured slot and label the missing source instead of substituting an unrelated image.";
  if (scene.medium === "photography") {
    const subject = suggestedSubjects[0] ?? scene.focalObject;
    return `Use an honest asset-needed slot labelled for ${subject}; do not counterfeit photography with gradients, texture, or anonymous stock.`;
  }
  if (scene.medium === "data") return "Use only verified values from the brief; show an explicit evidence-pending state when a value is absent.";
  if (scene.medium === "diagram" || scene.medium === "spatial" || scene.medium === "generative") return "Build original SVG/CSS/canvas geometry whose labels and states explain the scene purpose.";
  if (scene.medium === "interface") return "Use a truthful local state or real route; disclose any unavailable external adapter.";
  return "Let typography carry orientation without adding a decorative image that has no task role.";
}

export function buildAssetDirectionContract(input: {
  narrative: VisualNarrativeContract;
  assetBundle: AssetBundle;
  ownedAssets?: OwnedAssetManifest[];
}): AssetDirectionContract {
  const { narrative, assetBundle, ownedAssets = [] } = input;
  const catalog = directedCatalog(assetBundle, ownedAssets);
  const identityAssetIds = catalog.filter((asset) => ownedAssets.some((owned) => owned.kind === "logo" && owned.url === asset.url)).map((asset) => asset.id);
  const identity = new Set(identityAssetIds);
  const photos = catalog.filter((asset) => !identity.has(asset.id));
  const uses = new Map<string, number>();
  const sceneDirections = narrative.scenes.map((scene): SceneAssetDirection => {
    const requirement = requirementFor(scene, assetBundle);
    const selected = requirement === "avoid" ? undefined : needsExternalAsset(scene) ? choosePhoto(scene, photos, uses) : undefined;
    if (selected) uses.set(selected.id, (uses.get(selected.id) ?? 0) + 1);
    return {
      sceneId: scene.id,
      requirement,
      narrativeFunction: narrativeFunction(scene),
      expectedLayers: expectedLayers(scene, narrative),
      preferredMedium: scene.medium,
      sourcePolicy: sourcePolicy(scene, Boolean(selected), assetBundle.mediaRequirement.level),
      selectedAssetIds: selected ? [selected.id] : [],
      framing: framingFor(scene),
      visualPurpose: `${narrativeFunction(scene)}: ${scene.focalObject} must help answer “${scene.audienceQuestion}”`,
      altIntent: `Describe the visible evidence that helps answer: ${scene.audienceQuestion}`,
      fallback: fallbackFor(scene, Boolean(selected), assetBundle.mediaRequirement.suggestedSubjects),
    };
  });
  const selectedIds = new Set(sceneDirections.flatMap((direction) => direction.selectedAssetIds));

  return {
    version: ASSET_DIRECTION_VERSION,
    catalog,
    identityAssetIds,
    sceneDirections,
    unusedAssetIds: catalog.filter((asset) => !identity.has(asset.id) && !selectedIds.has(asset.id)).map((asset) => asset.id),
    globalRules: [
      "Every visible asset must answer a scene question, expose evidence, orient the audience, or reveal state; atmosphere alone is not fulfillment.",
      "External-media requirement is separate from visual richness: not-applicable scenes still require their declared data, shape, motion, or interaction layers.",
      "Use only catalog URLs or original programmatic geometry. Never invent or silently substitute an asset; remote stock URLs are preview-only until copied into the project.",
      "Keep the assigned credit and source record in ASSETS.md; Pexels use also needs a visible linked credit in the experience.",
      "Treat framing as responsive information design: preserve the evidence-bearing subject before preserving the crop.",
    ],
  };
}

function tableCell(value: string): string {
  return value.replace(/[|\r\n]+/g, " ").trim();
}

export function formatAssetDirectionManifest(contract: AssetDirectionContract): string {
  const assetById = new Map(contract.catalog.map((asset) => [asset.id, asset]));
  const catalog = contract.catalog.length
    ? contract.catalog.map((asset) => `- **${tableCell(asset.id)}** — ${tableCell(asset.source)} / ${tableCell(asset.license)}; ${tableCell(asset.credit)}${asset.sourcePageUrl ? `; source: ${asset.sourcePageUrl}` : ""}; project URL: \`${asset.url}\``).join("\n")
    : "- No external visual assets were approved for this project.";
  const scenes = contract.sceneDirections.map((direction) => {
    const assigned = direction.selectedAssetIds.map((id) => assetById.get(id)?.id ?? id).join(", ") || (direction.sourcePolicy === "programmatic-only" ? "programmatic-original" : "none / pending");
    return `| ${tableCell(direction.sceneId)} | ${tableCell(direction.narrativeFunction)} | ${tableCell(direction.requirement)} | ${tableCell(assigned)} | ${tableCell(direction.framing.scale)} / ${tableCell(direction.framing.aspectRatio)} |`;
  }).join("\n");
  return `## Directed asset catalog

${catalog}

## Scene assignments

| Scene | Function | External media need | Assigned source | Framing |
| --- | --- | --- | --- | --- |
${scenes}

## Global asset rules

${contract.globalRules.map((rule) => `- ${rule}`).join("\n")}`;
}
