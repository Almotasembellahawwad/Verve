// =========================================================
// lib/middleware/rate-limit.ts
// Sliding-window in-memory rate limiter
//
// IMPORTANT: This is an in-memory implementation.
// In a multi-instance / serverless deploy (Vercel Edge), each instance
// has its own memory — rate limits are per-instance, not global.
// For true global rate limiting, swap the Map for a Redis/KV store.
//
// Two tiers of protection:
//   1. Per-IP request rate (sliding window)
//   2. Per-IP concurrent in-flight request cap
// =========================================================

import { NextRequest, NextResponse } from "next/server";

interface WindowEntry {
  timestamps: number[];
  inFlight:   number;
}

// Separate stores per route to allow different limits
const stores: Record<string, Map<string, WindowEntry>> = {};

function getStore(route: string): Map<string, WindowEntry> {
  if (!stores[route]) stores[route] = new Map();
  return stores[route];
}

// Prune old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const store of Object.values(stores)) {
    for (const [ip, entry] of store) {
      // Remove IPs with no recent requests and no in-flight calls
      entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
      if (entry.timestamps.length === 0 && entry.inFlight === 0) store.delete(ip);
    }
  }
}, 5 * 60_000);

export interface RateLimitConfig {
  /** Max requests per windowMs */
  maxRequests:    number;
  /** Window duration in ms */
  windowMs:       number;
  /** Max concurrent in-flight requests per IP */
  maxConcurrent:  number;
  /** Route identifier for separate stores */
  routeKey:       string;
}

/**
 * Check rate limit for a request. Returns a 429 Response if exceeded,
 * or null if the request is allowed.
 *
 * Usage:
 *   const limited = checkRateLimit(req, config);
 *   if (limited) return limited;
 */
export function checkRateLimit(req: NextRequest, config: RateLimitConfig): NextResponse | null {
  const { maxRequests, windowMs, maxConcurrent, routeKey } = config;
  const store = getStore(routeKey);
  const ip    = getIP(req);
  const now   = Date.now();

  const entry = store.get(ip) ?? { timestamps: [], inFlight: 0 };

  // Slide the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    store.set(ip, entry);
    return NextResponse.json(
      {
        error:     "RATE_LIMITED",
        message:   "Too many requests. Please wait before trying again.",
        retryAfterMs: windowMs - (now - (entry.timestamps[0] ?? now)),
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) },
      }
    );
  }

  if (entry.inFlight >= maxConcurrent) {
    store.set(ip, entry);
    return NextResponse.json(
      {
        error:   "CONCURRENT_LIMIT",
        message: "Another generation is already in progress. Please wait.",
      },
      { status: 429 }
    );
  }

  // Allow — record this request
  entry.timestamps.push(now);
  store.set(ip, entry);
  return null;
}

/**
 * Mark an in-flight request as started. Returns a cleanup function
 * that MUST be called when the request finishes (success or error).
 *
 * Usage:
 *   const release = acquireConcurrentSlot(req, config);
 *   try { ... } finally { release(); }
 */
export function acquireConcurrentSlot(req: NextRequest, config: RateLimitConfig): () => void {
  const store = getStore(config.routeKey);
  const ip    = getIP(req);
  const entry = store.get(ip) ?? { timestamps: [], inFlight: 0 };
  entry.inFlight++;
  store.set(ip, entry);

  return () => {
    const e = store.get(ip);
    if (e) {
      e.inFlight = Math.max(0, e.inFlight - 1);
    }
  };
}

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Pre-configured limits for each route
export const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  "generate-stream": {
    routeKey:      "generate-stream",
    maxRequests:   5,          // 5 generations per minute per IP
    windowMs:      60_000,
    maxConcurrent: 2,          // max 2 simultaneous generations per IP
  },
  "generate": {
    routeKey:      "generate",
    maxRequests:   5,
    windowMs:      60_000,
    maxConcurrent: 2,
  },
  "compare": {
    routeKey:      "compare",
    maxRequests:   3,          // Runs pipeline twice — stricter
    windowMs:      60_000,
    maxConcurrent: 1,
  },
  "patch": {
    routeKey:      "patch",
    maxRequests:   20,         // Patch is cheap — more lenient
    windowMs:      60_000,
    maxConcurrent: 3,
  },
  "critique": {
    routeKey:      "critique",
    maxRequests:   10,
    windowMs:      60_000,
    maxConcurrent: 2,
  },
  "cliches-suggest": {
    routeKey:      "cliches-suggest",
    maxRequests:   15,
    windowMs:      60_000,
    maxConcurrent: 3,
  },
};
