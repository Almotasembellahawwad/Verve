export type RateLimitDecision = { allowed: boolean; retryAfterMs: number; remaining: number };
export type ConcurrencyDecision = { acquired: boolean; slotId: string };

export interface RateLimitStorePort {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
  acquire(key: string, limit: number, ttlMs: number): Promise<ConcurrencyDecision>;
  release(key: string, slotId: string): Promise<void>;
}
