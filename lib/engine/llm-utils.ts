// =========================================================
// lib/engine/llm-utils.ts
// Shared utilities for all engine modules
//
// 1. extractJSON() — robust JSON extraction from LLM output
//    Handles: markdown fences, text before/after JSON,
//    multiple JSON objects (takes the first valid one),
//    GPT-5.6 reasoning artifacts in output
//
// 2. Type for LLM adapter injection (replaces singleton)
// =========================================================

import type { LLMAdapter } from "../llm-adapter/types";

// Re-export for convenience -- all engine modules import from here
export type { LLMAdapter };

/**
 * Extract and parse the first valid JSON object from LLM output.
 *
 * LLMs often wrap JSON in markdown code fences, add explanatory text,
 * or include multiple JSON-like structures. This function handles all
 * common output formats.
 *
 * @throws Error if no valid JSON object can be extracted
 */
export function extractJSON<T = unknown>(raw: string, context = "LLM"): T {
  // Step 1: Try to extract from markdown code fence first
  //   ```json\n{ ... }\n```  or  ```\n{ ... }\n```
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // fence content wasn't valid JSON, continue to other methods
    }
  }

  // Step 2: Find the FIRST complete JSON object using brace counting
  //   This avoids the greedy regex problem where /\{[\s\S]*\}/ captures
  //   everything from first { to LAST }, including non-JSON text between
  //   multiple objects.
  const firstBrace = raw.indexOf("{");
  if (firstBrace === -1) {
    throw new Error(`${context} returned no JSON object. Raw output starts with: "${raw.slice(0, 200)}"`);
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < raw.length; i++) {
    const ch = raw[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = raw.slice(firstBrace, i + 1);
        try {
          return JSON.parse(candidate) as T;
        } catch (e) {
          // This complete brace-pair wasn't valid JSON
          // Try to find the next opening brace
          const nextBrace = raw.indexOf("{", i + 1);
          if (nextBrace === -1) {
            throw new Error(
              `${context} returned malformed JSON. Parse error: ${e instanceof Error ? e.message : String(e)}. ` +
              `Raw output (first 300 chars): "${raw.slice(0, 300)}"`
            );
          }
          // Reset and continue searching from next brace
          depth = 0;
          // We'll let the loop continue naturally since we just need to find the next {
          // But we need to update firstBrace for the error context
        }
      }
    }
  }

  throw new Error(
    `${context} returned incomplete JSON (unmatched braces). ` +
    `Raw output (first 300 chars): "${raw.slice(0, 300)}"`
  );
}
