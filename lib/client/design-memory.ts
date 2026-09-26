import type { DesignDirectionFingerprint } from "../domain/design-direction";
import type { VisualFingerprint } from "../project/render-gate";
import {
  recentDesignFingerprints,
  rememberDesignDirection,
  type DesignMemoryEntry,
  type DesignMemoryOutcome,
} from "../domain/design-memory";

const STORAGE_KEY = "verve_design_memory_v1";
const VISUAL_STORAGE_KEY = "verve_visual_memory_v1";

function storage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function isFingerprint(value: unknown): value is DesignDirectionFingerprint {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return [
    "directionId",
    "topology",
    "hierarchy",
    "spatialRhythm",
    "typographyRole",
    "mediaStrategy",
    "interactionMetaphor",
    "signatureMechanism",
  ].every((key) => typeof candidate[key] === "string" && candidate[key].length > 0 && candidate[key].length <= 700)
    && (!candidate.structure || (
      typeof candidate.structure === "object"
      && Array.isArray((candidate.structure as Record<string, unknown>).traits)
    ));
}

function isMemoryEntry(value: unknown): value is DesignMemoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<DesignMemoryEntry>;
  return entry.schemaVersion === 1
    && typeof entry.id === "string"
    && typeof entry.createdAt === "number"
    && typeof entry.updatedAt === "number"
    && typeof entry.uses === "number"
    && ["generated", "accepted", "rejected"].includes(String(entry.outcome))
    && isFingerprint(entry.fingerprint);
}

export function readDesignMemory(): DesignMemoryEntry[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMemoryEntry).slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function rememberLocalDesignDirection(
  fingerprint: DesignDirectionFingerprint,
  outcome: DesignMemoryOutcome
): void {
  try {
    storage()?.setItem(
      STORAGE_KEY,
      JSON.stringify(rememberDesignDirection(readDesignMemory(), fingerprint, outcome))
    );
  } catch {
    // Generation and editing remain available if browser storage is unavailable.
  }
}

export function getRecentLocalDesignFingerprints(limit = 12): DesignDirectionFingerprint[] {
  return recentDesignFingerprints(readDesignMemory(), limit);
}

export function clearLocalDesignMemory(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
    storage()?.removeItem(VISUAL_STORAGE_KEY);
  } catch { /* local memory is optional */ }
}

export type VisualMemoryEntry = { schemaVersion: 1; id: string; createdAt: number; fingerprint: VisualFingerprint; projectKey?: string };

function visualKey(fingerprint: VisualFingerprint): string {
  const source = JSON.stringify(fingerprint);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `visual-${(hash >>> 0).toString(36)}`;
}

/** Only opaque local IDs are accepted; never persist a project name or brief. */
function projectKey(projectId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < projectId.length; index++) {
    hash ^= projectId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `project-${(hash >>> 0).toString(36)}`;
}

function validVisualFingerprint(value: unknown): value is VisualFingerprint {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VisualFingerprint>;
  const boundedUnit = (entry: unknown) => typeof entry === "number" && Number.isFinite(entry) && entry >= 0 && entry <= 1;
  const baseValid = Array.isArray(candidate.occupancyGrid) && candidate.occupancyGrid.length === 144
    && Array.isArray(candidate.typographyScale) && candidate.typographyScale.length === 6
    && Array.isArray(candidate.colorHistogram) && candidate.colorHistogram.length <= 8
    && Array.isArray(candidate.sectionRhythm) && candidate.sectionRhythm.length <= 12
    && typeof candidate.mediaCoverage === "number"
    && typeof candidate.interactionDensity === "number"
    && typeof candidate.roundedness === "number"
    && typeof candidate.routeCount === "number";
  if (!baseValid || candidate.schemaVersion === undefined) return baseValid;
  return candidate.schemaVersion === 2
    && Array.isArray(candidate.colorAreaHistogram) && candidate.colorAreaHistogram.length <= 8
    && candidate.colorAreaHistogram.every((entry) => typeof entry.color === "string" && boundedUnit(entry.weight))
    && Array.isArray(candidate.fontHistogram) && candidate.fontHistogram.length <= 8
    && candidate.fontHistogram.every((entry) => typeof entry.family === "string" && boundedUnit(entry.weight))
    && Array.isArray(candidate.visualLayerHistogram) && candidate.visualLayerHistogram.length <= 6
    && candidate.visualLayerHistogram.every((entry) => ["type", "media", "data", "shape", "motion", "interaction"].includes(entry.layer) && boundedUnit(entry.weight))
    && boundedUnit(candidate.statefulControlDensity)
    && boundedUnit(candidate.depthDensity)
    && boundedUnit(candidate.alignmentDiversity);
}

function readVisualMemoryEntries(): VisualMemoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(VISUAL_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is VisualMemoryEntry => Boolean(entry && typeof entry === "object"
        && typeof (entry as VisualMemoryEntry).id === "string"
        && Number.isFinite((entry as VisualMemoryEntry).createdAt)
        && validVisualFingerprint((entry as VisualMemoryEntry).fingerprint)));
  } catch {
    return [];
  }
}

/** Unowned legacy records cannot prove that a project is distinct from itself. */
export function selectVisualArchive(entries: VisualMemoryEntry[], limit = 24, projectId?: string): VisualMemoryEntry[] {
  const owner = projectId ? projectKey(projectId) : null;
  return entries
    .filter((entry) => owner === null || (entry.projectKey !== undefined && entry.projectKey !== owner))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, Math.max(0, Math.min(24, limit)));
}

export function getRecentVisualFingerprints(limit = 24, excludeProjectId?: string): VisualFingerprint[] {
  return selectVisualArchive(readVisualMemoryEntries(), limit, excludeProjectId).map((entry) => entry.fingerprint);
}

export function updateVisualArchive(entries: VisualMemoryEntry[], fingerprint: VisualFingerprint, projectId?: string, now = Date.now()): VisualMemoryEntry[] {
  const owner = projectId ? projectKey(projectId) : undefined;
  const id = owner ? `${owner}:${visualKey(fingerprint)}` : visualKey(fingerprint);
  return [
    { schemaVersion: 1 as const, id, projectKey: owner, createdAt: now, fingerprint },
    ...entries.filter((entry) => owner ? entry.projectKey !== owner : entry.id !== id),
  ].slice(0, 24);
}

export function rememberVisualFingerprint(fingerprint: VisualFingerprint, projectId?: string): void {
  try {
    storage()?.setItem(VISUAL_STORAGE_KEY, JSON.stringify(updateVisualArchive(readVisualMemoryEntries(), fingerprint, projectId)));
  } catch {
    // Visual memory is private, local, and optional.
  }
}
