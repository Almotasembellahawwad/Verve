import type { HistoryRepositoryPort } from "../../ports/repositories";

function optionalStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

export class BrowserHistoryRepository<T extends { id: string; timestamp: number }>
implements HistoryRepositoryPort<T> {
  constructor(
    private readonly key: string,
    private readonly maxEntries: number,
    private readonly storage: Storage | undefined = optionalStorage()
  ) {}

  list(): T[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry): entry is T => Boolean(entry && typeof entry === "object"
        && typeof entry.id === "string" && typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)))
        .sort((a, b) => b.timestamp - a.timestamp).slice(0, this.maxEntries);
    } catch { return []; }
  }

  put(entry: T): void {
    this.write([entry, ...this.list().filter((item) => item.id !== entry.id)].slice(0, this.maxEntries));
  }

  delete(id: string): void { this.write(this.list().filter((entry) => entry.id !== id)); }

  /** setItem is atomic: a failed replacement leaves the previous history intact. */
  replace(entries: T[]): void { this.write([...entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, this.maxEntries)); }

  clear(): void {
    try { this.storage?.removeItem(this.key); } catch { /* optional persistence */ }
  }

  private write(entries: T[]): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(entries));
    } catch {
      try { this.storage.setItem(this.key, JSON.stringify(entries.slice(0, Math.min(10, this.maxEntries)))); }
      catch { /* optional persistence */ }
    }
  }
}
