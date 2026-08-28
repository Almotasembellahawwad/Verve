import { randomUUID } from "node:crypto";
import type { ConcurrencyDecision, RateLimitDecision, RateLimitStorePort } from "../../ports/rate-limit";

type Entry = { timestamps: number[]; slots: Map<string, number> };

/** Local-development fallback. Production composition requires Redis. */
export class InMemoryRateLimitStore implements RateLimitStorePort {
  private readonly entries = new Map<string, Entry>();

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const now = Date.now();
    const entry = this.entry(key);
    entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < windowMs);
    if (entry.timestamps.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, windowMs - (now - (entry.timestamps[0] ?? now))),
      };
    }
    entry.timestamps.push(now);
    return { allowed: true, remaining: Math.max(0, limit - entry.timestamps.length), retryAfterMs: 0 };
  }

  async acquire(key: string, limit: number, ttlMs: number): Promise<ConcurrencyDecision> {
    const now = Date.now();
    const entry = this.entry(key);
    for (const [slotId, expiresAt] of entry.slots) if (expiresAt <= now) entry.slots.delete(slotId);
    const slotId = randomUUID();
    if (entry.slots.size >= limit) return { acquired: false, slotId };
    entry.slots.set(slotId, now + ttlMs);
    return { acquired: true, slotId };
  }

  async release(key: string, slotId: string): Promise<void> {
    this.entry(key).slots.delete(slotId);
  }

  private entry(key: string): Entry {
    const existing = this.entries.get(key);
    if (existing) return existing;
    const created: Entry = { timestamps: [], slots: new Map() };
    this.entries.set(key, created);
    return created;
  }
}
