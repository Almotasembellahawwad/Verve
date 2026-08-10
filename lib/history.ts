// lib/history.ts
// Design History — localStorage-based persistence
// Stores up to 20 generation results with LRU eviction

export const HISTORY_KEY = "verve_design_history";
export const MAX_HISTORY  = 20;

export type HistoryEntry = {
  id:        string;
  timestamp: number;   // Unix ms
  brief:     string;
  score:     number;
  grade:     string;
  archetype: string;
  normanLevels?: {
    visceral:   number;
    behavioral: number;
    reflective: number;
  };
  signatureElement: string;
  palette: { name: string; hex: string }[];
  codeSnippet: string; // first 500 chars of generated code
  fullResult:  unknown; // complete API response, stored as-is
};

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full — evict oldest and retry
    const trimmed = entries.slice(-10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  }
}

export function getHistory(): HistoryEntry[] {
  return load().sort((a, b) => b.timestamp - a.timestamp);
}

export function addHistory(entry: Omit<HistoryEntry, "id" | "timestamp">): HistoryEntry {
  const entries = load();
  const newEntry: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  // LRU eviction — keep most recent MAX_HISTORY entries
  const updated = [newEntry, ...entries].slice(0, MAX_HISTORY);
  save(updated);
  return newEntry;
}

export function getHistoryEntry(id: string): HistoryEntry | undefined {
  return load().find((e) => e.id === id);
}

export function deleteHistoryEntry(id: string): void {
  save(load().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  if (typeof window !== "undefined") localStorage.removeItem(HISTORY_KEY);
}

/** Format a history entry from a pipeline API response */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function entryFromResult(brief: string, result: any): Omit<HistoryEntry, "id" | "timestamp"> {
  const dr = result?.distinctivenessReport ?? {};
  return {
    brief:            brief.slice(0, 200),
    score:            dr.score            ?? 0,
    grade:            dr.grade            ?? "?",
    archetype:        dr.archetypeId      ?? result?.archetype?.id ?? "unknown",
    normanLevels: dr.normanLevels ? {
      visceral:   dr.normanLevels.visceral?.score   ?? 0,
      behavioral: dr.normanLevels.behavioral?.score ?? 0,
      reflective: dr.normanLevels.reflective?.score ?? 0,
    } : undefined,
    signatureElement: dr.signatureElement ?? result?.plan?.signatureElement?.name ?? "",
    palette:          (result?.plan?.colorPalette ?? []).map(
      (c: { name: string; hex: string }) => ({ name: c.name, hex: c.hex })
    ).slice(0, 5),
    codeSnippet:      (result?.code?.code ?? "").slice(0, 500),
    fullResult:       result,
  };
}
