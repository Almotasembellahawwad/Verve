import type { GeneratedProject, ProjectFile } from "./types";

export const MAX_OWNED_ASSETS = 4;
export const MAX_OWNED_ASSET_BYTES = 1_500_000;

export type BrandProfile = {
  name?: string;
  colors: string[];
  notes?: string;
};

export type OwnedAssetKind = "logo" | "image";

export type OwnedAssetManifest = {
  path: string;
  url: string;
  kind: OwnedAssetKind;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";
  alt: string;
};

export type LocalOwnedAsset = Omit<OwnedAssetManifest, "url"> & {
  content: string;
  encoding: "base64";
  byteSize: number;
};

const MEDIA_EXTENSIONS: Record<OwnedAssetManifest["mediaType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function safeStem(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return withoutExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48) || "owned-asset";
}

export async function readOwnedAsset(file: File, kind: OwnedAssetKind): Promise<LocalOwnedAsset> {
  if (!(file.type in MEDIA_EXTENSIONS)) throw new Error(`${file.name}: unsupported image format.`);
  if (file.size > MAX_OWNED_ASSET_BYTES) throw new Error(`${file.name}: keep each asset below 1.5 MB.`);

  const mediaType = file.type as OwnedAssetManifest["mediaType"];
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`${file.name}: browser could not read this file.`));
    reader.readAsDataURL(file);
  });
  const content = dataUrl.split(",", 2)[1] ?? "";
  const stem = safeStem(file.name);

  return {
    path: `assets/${stem}.${MEDIA_EXTENSIONS[mediaType]}`,
    kind,
    mediaType,
    alt: stem.replace(/[-_]+/g, " "),
    content,
    encoding: "base64",
    byteSize: file.size,
  };
}

export function ownedAssetManifest(asset: LocalOwnedAsset, framework: GeneratedProject["framework"]): OwnedAssetManifest {
  const path = framework === "html" ? asset.path : `public/${asset.path}`;
  return {
    path,
    url: framework === "html" ? `./${asset.path}` : `/${asset.path}`,
    kind: asset.kind,
    mediaType: asset.mediaType,
    alt: asset.alt.trim() || asset.path.replace(/^assets\//, "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
  };
}

export function attachOwnedAssets(project: GeneratedProject, assets: LocalOwnedAsset[]): GeneratedProject {
  const existing = new Set(project.files.map((file) => file.path));
  const assetFiles: ProjectFile[] = assets
    .map((asset) => ({ asset, targetPath: project.framework === "html" ? asset.path : `public/${asset.path}` }))
    .filter(({ targetPath }) => !existing.has(targetPath))
    .map(({ asset, targetPath }) => ({
        path: targetPath,
        content: asset.content,
        encoding: "base64",
        mediaType: asset.mediaType,
        language: "binary",
        role: "asset",
      }));
  return { ...project, files: [...project.files, ...assetFiles] };
}

export function stripOwnedAssetContent(project: GeneratedProject): GeneratedProject {
  const warning = "Owned image bytes stay in the current browser session and are not copied into localStorage history. Reattach them before previewing or exporting this restored result.";
  return {
    ...project,
    files: project.files.filter((file) => file.encoding !== "base64"),
    warnings: project.warnings.includes(warning) ? project.warnings : [...project.warnings, warning],
    readiness: {
      status: project.readiness.status === "blocked" ? "blocked" : "review-required",
      score: Math.min(project.readiness.score, 82),
    },
  };
}

export function projectFileDataUrl(file: ProjectFile): string | null {
  if (file.encoding !== "base64" || !file.mediaType) return null;
  return `data:${file.mediaType};base64,${file.content}`;
}

export function replaceOwnedAssetReferences(content: string, files: ProjectFile[]): string {
  let output = content;
  for (const file of files) {
    const dataUrl = projectFileDataUrl(file);
    if (!dataUrl) continue;
    const path = file.path.replace(/^\/+/, "");
    const publicPath = path.replace(/^public\//, "");
    const references = [...new Set([`./${path}`, `/${path}`, path, `./${publicPath}`, `/${publicPath}`, publicPath])]
      .sort((left, right) => right.length - left.length);
    for (const reference of references) {
      output = output.split(reference).join(dataUrl);
    }
  }
  return output;
}

export function brandContextSummary(profile: BrandProfile | undefined, assets: OwnedAssetManifest[]): string {
  const lines = ["=== USER-OWNED BRAND KIT ==="];
  if (profile?.name?.trim()) lines.push(`Brand name: ${profile.name.trim()}`);
  if (profile?.colors.length) lines.push(`Required brand colors: ${profile.colors.join(", ")}`);
  if (profile?.notes?.trim()) lines.push(`Identity direction: ${profile.notes.trim()}`);
  if (assets.length) {
    lines.push("Local project assets (approved by the user; reference these exact paths):");
    for (const asset of assets) lines.push(`- ${asset.kind}: ${asset.url} (project file: ${asset.path}; ${asset.mediaType}); alt: ${asset.alt}`);
  }
  lines.push("Do not invent additional brand marks, image URLs, or colors that conflict with this kit.");
  return lines.join("\n");
}
