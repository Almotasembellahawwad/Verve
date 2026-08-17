// =========================================================
// lib/middleware/error-handler.ts
// Centralized error response builder
//
// POLICY: Never return raw error messages to the client.
// Always log the full error server-side with a requestId.
// Return only a generic code + requestId so client can report it.
// =========================================================

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

type ErrorCode =
  | "GENERATION_FAILED"
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "NO_API_KEY"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INTERNAL_ERROR";

/**
 * Creates a sanitized error response.
 * Logs the real error server-side. Returns only a code + requestId to client.
 */
export function errorResponse(
  err: unknown,
  code: ErrorCode = "INTERNAL_ERROR",
  status = 500,
  requestId?: string
): NextResponse {
  const id = requestId ?? uuidv4();

  // Redact API key fragments before logging
  const message = sanitizeForLog(
    err instanceof Error ? err.message : String(err)
  );

  console.error(`[verve] requestId=${id} code=${code} error=${message}`);

  return NextResponse.json(
    { error: code, requestId: id },
    { status }
  );
}

/**
 * Redacts API key patterns from log strings.
 * Handles: sk-ant-*, sk-or-*, sk-*, AIzaSy*, bearer tokens.
 */
function sanitizeForLog(msg: string): string {
  return msg
    .replace(/sk-ant-[A-Za-z0-9_\-]{10,}/g, "sk-ant-[REDACTED]")
    .replace(/sk-or-v1-[A-Za-z0-9_\-]{10,}/g, "sk-or-[REDACTED]")
    .replace(/sk-[A-Za-z0-9]{20,}/g, "sk-[REDACTED]")
    .replace(/AIzaSy[A-Za-z0-9_\-]{20,}/g, "AIzaSy[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._\-]{20,}/gi, "Bearer [REDACTED]");
}

/**
 * Maps known error types to appropriate HTTP status codes and error codes.
 */
export function classifyError(err: unknown): { code: ErrorCode; status: number } {
  if (!err) return { code: "INTERNAL_ERROR", status: 500 };

  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  if (msg.includes("api key") || msg.includes("unauthorized") || msg.includes("authentication")) {
    return { code: "NO_API_KEY", status: 401 };
  }
  if (msg.includes("rate limit") || msg.includes("429") || msg.includes("too many")) {
    return { code: "RATE_LIMITED", status: 429 };
  }
  if (msg.includes("timeout") || msg.includes("abort") || msg.includes("timed out")) {
    return { code: "TIMEOUT", status: 504 };
  }
  if (msg.includes("provider") || msg.includes("model") || msg.includes("empty response")) {
    return { code: "PROVIDER_ERROR", status: 502 };
  }
  if (msg.includes("generation") || msg.includes("pipeline") || msg.includes("critique")) {
    return { code: "GENERATION_FAILED", status: 500 };
  }

  return { code: "INTERNAL_ERROR", status: 500 };
}
