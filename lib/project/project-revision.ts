import type { VerveProjectSpec } from "../domain/project-spec";
import { DESIGN_CONTRACT_PATH } from "../domain/design-contract";
import type { ProjectRevision } from "../domain/render-receipt";
import type { GeneratedProject, ProjectFile } from "./types";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sortedFiles(files: ProjectFile[]): ProjectFile[] {
  return [...files].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function revisionInputs(project: GeneratedProject, spec?: VerveProjectSpec) {
  const files = sortedFiles(project.files);
  return {
    source: { framework: project.framework, entryFile: project.entryFile, dependencies: project.dependencies, scripts: project.scripts,
      files: files.filter((file) => file.role !== "asset" && file.encoding !== "base64" && ![DESIGN_CONTRACT_PATH, "ASSETS.md", "FONT-LICENSES.md"].includes(file.path)) },
    assets: files.filter((file) => file.role === "asset" || file.encoding === "base64" || ["ASSETS.md", "FONT-LICENSES.md"].includes(file.path)),
    design: { spec: spec ?? null, receipt: files.find((file) => file.path === DESIGN_CONTRACT_PATH)?.content ?? null },
  };
}

/** Cheap React lifecycle key only. The SHA-256 receipt, not this key, authorizes evidence. */
export function projectPreviewKey(project: GeneratedProject, spec?: VerveProjectSpec): string {
  const input = canonical(revisionInputs(project, spec));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return `${input.length}-${(hash >>> 0).toString(36)}`;
}

/** Content binding only; hashes do not authenticate generated code or certify design quality. */
export async function projectRevision(project: GeneratedProject, spec?: VerveProjectSpec): Promise<ProjectRevision> {
  const inputs = revisionInputs(project, spec);
  const [sourceDigest, assetDigest, designDigest] = await Promise.all([
    digest(inputs.source), digest(inputs.assets), digest(inputs.design),
  ]);
  return { version: 1, algorithm: "sha256", sourceDigest, assetDigest, designDigest };
}
