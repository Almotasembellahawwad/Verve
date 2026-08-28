import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { RateLimitStorePort } from "../ports/rate-limit";
import { InMemoryRateLimitStore } from "../adapters/rate-limit/in-memory-rate-limit-store";
import { UpstashRateLimitStore } from "../adapters/rate-limit/upstash-rate-limit-store";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  maxConcurrent: number;
  routeKey: string;
  concurrencyTtlMs?: number;
}

const localDevelopmentStore = new InMemoryRateLimitStore();

export function rateLimitBackendStatus(): { configured: boolean; backend: "upstash" | "memory"; productionSafe: boolean } {
  const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  return { configured, backend: configured ? "upstash" : "memory", productionSafe: configured };
}

function store(): RateLimitStorePort | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashRateLimitStore(url, token);
  const failClosed = process.env.RATE_LIMIT_FAIL_CLOSED === "true";
  if (process.env.VERCEL_ENV && failClosed) return null;
  return localDevelopmentStore;
}

function clientKey(req: NextRequest, routeKey: string, kind: "rate" | "concurrent"): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  const digest = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  return `verve:${kind}:${routeKey}:${digest}`;
}

function unavailable(): NextResponse {
  return NextResponse.json(
    { error: "RATE_LIMIT_UNAVAILABLE", message: "Admission control is temporarily unavailable." },
    { status: 503, headers: { "Retry-After": "30" } }
  );
}

export async function checkRateLimit(req: NextRequest, config: RateLimitConfig): Promise<NextResponse | null> {
  const backend = store();
  if (!backend) return unavailable();
  try {
    const decision = await backend.consume(clientKey(req, config.routeKey, "rate"), config.maxRequests, config.windowMs);
    if (decision.allowed) return null;
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many requests. Please wait before trying again.", retryAfterMs: decision.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) } }
    );
  } catch {
    return unavailable();
  }
}

export async function acquireConcurrentSlot(
  req: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | (() => Promise<void>)> {
  const backend = store();
  if (!backend) return unavailable();
  const key = clientKey(req, config.routeKey, "concurrent");
  try {
    const decision = await backend.acquire(key, config.maxConcurrent, config.concurrencyTtlMs ?? 330_000);
    if (!decision.acquired) {
      return NextResponse.json(
        { error: "CONCURRENT_LIMIT", message: "Another request is already in progress. Please wait." },
        { status: 429, headers: { "Retry-After": "10" } }
      );
    }
    return async () => {
      try { await backend.release(key, decision.slotId); } catch { /* slot TTL is the final safety net */ }
    };
  } catch {
    return unavailable();
  }
}

export const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  "generate-stream": { routeKey: "generate-stream", maxRequests: 5, windowMs: 60_000, maxConcurrent: 2 },
  generate: { routeKey: "generate", maxRequests: 5, windowMs: 60_000, maxConcurrent: 2 },
  compare: { routeKey: "compare", maxRequests: 3, windowMs: 60_000, maxConcurrent: 1 },
  patch: { routeKey: "patch", maxRequests: 20, windowMs: 60_000, maxConcurrent: 3 },
  critique: { routeKey: "critique", maxRequests: 10, windowMs: 60_000, maxConcurrent: 2 },
  "cliches-suggest": { routeKey: "cliches-suggest", maxRequests: 15, windowMs: 60_000, maxConcurrent: 3 },
};
