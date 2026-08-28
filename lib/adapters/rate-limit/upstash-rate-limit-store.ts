import { randomUUID } from "node:crypto";
import type { ConcurrencyDecision, RateLimitDecision, RateLimitStorePort } from "../../ports/rate-limit";

const RATE_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then retry = math.max(1, window - (now - tonumber(oldest[2]))) end
  return {0, 0, retry}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, limit - count - 1, 0}
`;

const CONCURRENCY_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local slot = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now)
local count = redis.call('ZCARD', key)
if count >= limit then return {0} end
redis.call('ZADD', key, now + ttl, slot)
redis.call('PEXPIRE', key, ttl)
return {1}
`;

export class UpstashRateLimitStore implements RateLimitStorePort {
  constructor(private readonly url: string, private readonly token: string) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const now = Date.now();
    const result = await this.command<number[]>([
      "EVAL", RATE_SCRIPT, 1, key, now, windowMs, limit, `${now}:${randomUUID()}`,
    ]);
    return { allowed: result[0] === 1, remaining: result[1] ?? 0, retryAfterMs: result[2] ?? windowMs };
  }

  async acquire(key: string, limit: number, ttlMs: number): Promise<ConcurrencyDecision> {
    const slotId = randomUUID();
    const result = await this.command<number[]>([
      "EVAL", CONCURRENCY_SCRIPT, 1, key, Date.now(), ttlMs, limit, slotId,
    ]);
    return { acquired: result[0] === 1, slotId };
  }

  async release(key: string, slotId: string): Promise<void> {
    await this.command<number>(["ZREM", key, slotId]);
  }

  private async command<T>(command: Array<string | number>): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Upstash Redis request failed with ${response.status}`);
    const payload = await response.json() as { result?: T; error?: string };
    if (payload.error || payload.result === undefined) throw new Error(payload.error ?? "Upstash Redis returned no result");
    return payload.result;
  }
}
