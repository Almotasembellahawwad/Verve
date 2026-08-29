import type { DesignDirectionFingerprint } from "../domain/design-direction";
import {
  recentDesignFingerprints,
  rememberDesignDirection,
  type DesignMemoryEntry,
  type DesignMemoryOutcome,
} from "../domain/design-memory";

const STORAGE_KEY = "verve_design_memory_v1";

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
  ].every((key) => typeof candidate[key] === "string" && candidate[key].length > 0 && candidate[key].length <= 700);
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
  try { storage()?.removeItem(STORAGE_KEY); } catch { /* local memory is optional */ }
}
