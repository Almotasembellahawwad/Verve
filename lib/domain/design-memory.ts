export type DesignMemoryFingerprint = {
  directionId: string;
  topology: string;
  hierarchy: string;
  spatialRhythm: string;
  typographyRole: string;
  mediaStrategy: string;
  interactionMetaphor: string;
  signatureMechanism: string;
  structure?: {
    topologyFamily: "editorial-register" | "workbench" | "dashboard" | "timeline" | "comparison" | "spatial-canvas" | "catalog" | "form-led" | "narrative" | "unknown";
    openingMode: "viewport-hero" | "split-opening" | "compact-task" | "unknown";
    sectionRhythm: "viewport-stages" | "numbered-rows" | "panel-grid" | "mixed" | "unknown";
    traits: string[];
  };
};

export type DesignMemoryOutcome = "generated" | "accepted" | "rejected";

export type DesignMemoryEntry = {
  schemaVersion: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  outcome: DesignMemoryOutcome;
  uses: number;
  fingerprint: DesignMemoryFingerprint;
};

const MAX_MEMORY_ENTRIES = 20;

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function designFingerprintKey(fingerprint: DesignMemoryFingerprint): string {
  const source = [
    fingerprint.topology,
    fingerprint.hierarchy,
    fingerprint.spatialRhythm,
    fingerprint.typographyRole,
    fingerprint.mediaStrategy,
    fingerprint.interactionMetaphor,
    fingerprint.signatureMechanism,
    fingerprint.structure
      ? JSON.stringify(fingerprint.structure)
      : "structure-unavailable",
  ].map(normalize).join("|");

  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `direction-${(hash >>> 0).toString(36)}`;
}

export function rememberDesignDirection(
  entries: readonly DesignMemoryEntry[],
  fingerprint: DesignMemoryFingerprint,
  outcome: DesignMemoryOutcome,
  now = Date.now()
): DesignMemoryEntry[] {
  const id = designFingerprintKey(fingerprint);
  const previous = entries.find((entry) => entry.id === id);
  const next: DesignMemoryEntry = {
    schemaVersion: 1,
    id,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    outcome: outcome === "generated" && previous?.outcome === "accepted" ? "accepted" : outcome,
    uses: (previous?.uses ?? 0) + 1,
    fingerprint,
  };

  return [next, ...entries.filter((entry) => entry.id !== id)]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_MEMORY_ENTRIES);
}

export function recentDesignFingerprints(
  entries: readonly DesignMemoryEntry[],
  limit = 12
): DesignMemoryFingerprint[] {
  return entries
    .filter((entry) => entry.outcome !== "rejected")
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, Math.max(0, Math.min(limit, MAX_MEMORY_ENTRIES)))
    .map((entry) => entry.fingerprint);
}
