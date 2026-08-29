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

function removeCommentsOutsideStrings(value: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    const next = value[index + 1];

    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === "/" && next === "/") {
      index += 2;
      while (index < value.length && value[index] !== "\n" && value[index] !== "\r") index++;
      if (index < value.length) result += value[index];
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < value.length - 1 && !(value[index] === "*" && value[index + 1] === "/")) index++;
      index++;
      continue;
    }
    result += char;
  }

  return result;
}

function removeTrailingCommasOutsideStrings(value: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(value[lookahead] ?? "")) lookahead++;
      if (value[lookahead] === "}" || value[lookahead] === "]") continue;
    }
    result += char;
  }

  return result;
}

function cleanJsonString(str: string): string {
  return removeTrailingCommasOutsideStrings(removeCommentsOutsideStrings(str)).trim();
}

function parseJsonCandidate<T>(candidate: string): T {
  const trimmed = candidate.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return JSON.parse(cleanJsonString(trimmed)) as T;
  }
}

/**
 * Extract and parse the first valid JSON object from LLM output.
 *
 * LLMs often wrap JSON in markdown code fences, add explanatory text,
 * include comments (/* or //), trailing commas, or multiple JSON-like structures.
 * This function handles all common output formats.
 *
 * @throws Error if no valid JSON object can be extracted
 */
export function extractJSON<T = unknown>(raw: string, context = "LLM"): T {
  // A valid provider response is the common path. Parse it without any repair
  // first so authored CSS/JS comments inside JSON strings remain byte-for-byte
  // intact.
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    // Continue with bounded recovery for providers that add prose or fences.
  }

  // Step 1: Try to extract from markdown code fence first
  //   ```json\n{ ... }\n```  or  ```\n{ ... }\n```
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return parseJsonCandidate<T>(fenceMatch[1]);
    } catch {
      // fence content wasn't valid JSON, continue to other methods
    }
  }

  // Step 2: Find the FIRST complete JSON object using brace counting
  //   This avoids the greedy regex problem where /\{[\s\S]*\}/ captures
  //   everything from first { to LAST }, including non-JSON text between
  //   multiple objects.
  let start = raw.indexOf("{");
  if (start === -1) {
    throw new Error(`${context} returned no JSON object. Raw output starts with: "${raw.slice(0, 200)}"`);
  }

  let lastParseError: unknown;
  while (start !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (inString && escape) { escape = false; continue; }
      if (inString && ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return parseJsonCandidate<T>(raw.slice(start, i + 1));
          } catch (error) {
            lastParseError = error;
            start = raw.indexOf("{", i + 1);
            break;
          }
        }
      }
    }

    if (depth > 0 || inString) break;
  }

  throw new Error(
    `${context} returned malformed or incomplete JSON${lastParseError instanceof Error ? ` (${lastParseError.message})` : ""}. ` +
    `Raw output (first 300 chars): "${raw.slice(0, 300)}"`
  );
}
