import type { HistoryRepositoryPort } from "../../ports/repositories";

export class BrowserHistoryRepository<T extends { id: string; timestamp: number }>
implements HistoryRepositoryPort<T> {
  constructor(
    private readonly key: string,
    private readonly maxEntries: number,
    private readonly storage: Storage | undefined = typeof window === "undefined" ? undefined : window.localStorage
  ) {}

  list(): T[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(this.key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch { return []; }
  }

  put(entry: T): void {
    this.write([entry, ...this.list().filter((item) => item.id !== entry.id)].slice(0, this.maxEntries));
  }

  delete(id: string): void { this.write(this.list().filter((entry) => entry.id !== id)); }

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

