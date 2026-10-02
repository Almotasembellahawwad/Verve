export const RENDER_RECEIPT_PROBE_VERSION = 4 as const;

export type ProjectRevision = {
  version: 1;
  algorithm: "sha256";
  sourceDigest: string;
  assetDigest: string;
  designDigest: string;
};

export type RenderReceiptBinding = {
  version: 1;
  revision: ProjectRevision;
  probeVersion: typeof RENDER_RECEIPT_PROBE_VERSION;
  testedSurfaces: Array<{ width: 360 | 768 | 1440; routeKey: string; stateKey: string }>;
};

export function isProjectRevision(value: unknown): value is ProjectRevision {
  if (!value || typeof value !== "object") return false;
  const revision = value as Partial<ProjectRevision>;
  return revision.version === 1 && revision.algorithm === "sha256"
    && [revision.sourceDigest, revision.assetDigest, revision.designDigest].every((digest) => typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest));
}

export function sameProjectRevision(left: unknown, right: unknown): boolean {
  return isProjectRevision(left) && isProjectRevision(right)
    && left.sourceDigest === right.sourceDigest && left.assetDigest === right.assetDigest && left.designDigest === right.designDigest;
}

export function receiptMatchesRevision(binding: RenderReceiptBinding | undefined, revision: ProjectRevision | null | undefined, covered: number): boolean {
  if (!binding || binding.version !== 1 || binding.probeVersion !== RENDER_RECEIPT_PROBE_VERSION
    || !sameProjectRevision(binding.revision, revision) || !Array.isArray(binding.testedSurfaces)
    || binding.testedSurfaces.length > 240 || !Number.isInteger(covered) || covered < 0 || covered > 3) return false;
  if (!binding.testedSurfaces.every((surface) => surface && [360, 768, 1440].includes(surface.width)
    && /^surface-[a-z0-9]+$/.test(surface.routeKey) && /^surface-[a-z0-9]+$/.test(surface.stateKey))) return false;
  return new Set(binding.testedSurfaces.map((surface) => surface.width)).size === covered;
}
