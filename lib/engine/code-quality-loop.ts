// =========================================================
// lib/engine/code-quality-loop.ts
// Phase 3.5: Post-generation code quality check
//
// After code-generator produces HTML/CSS/JSX:
//   1. Strip markdown fences
//   2. Run structural checks (unclosed tags, missing doctype, etc.)
//   3. Verify signature element appears in output
//   4. If issues found: one targeted repair pass via LLM
//   5. Return final code + quality report
// =========================================================

import type { LLMAdapter } from "./llm-utils";

export interface CodeQualityResult {
  code:           string;
  wasRepaired:    boolean;
  issues:         string[];
  signatureFound: boolean;
}

const REPAIR_SYSTEM = `You are a code repair specialist. Fix ONLY the specific issues listed.
Do not rewrite or restructure the design. Return ONLY the corrected code with no markdown, no explanation.`;

// ── Structural checks ─────────────────────────────────────────────────────────

function stripFences(code: string): string {
  return code
    .replace(/^```[\w-]*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

function checkUnclosedTags(code: string): string[] {
  const issues: string[] = [];
  // Simple heuristic: count opening vs closing for block elements
  const blockTags = ["div", "section", "main", "article", "aside", "header", "footer", "nav", "ul", "ol", "li", "table", "tbody", "tr"];
  for (const tag of blockTags) {
    const opens  = (code.match(new RegExp(`<${tag}[\\s>]`, "gi")) ?? []).length;
    const closes = (code.match(new RegExp(`</${tag}>`, "gi")) ?? []).length;
    if (opens !== closes) {
      issues.push(`Unclosed <${tag}> (${opens} open, ${closes} close)`);
    }
  }
  return issues;
}

function checkDoctype(code: string, framework: string): string[] {
  if (framework !== "html") return []; // JSX/Next.js don't need doctype
  if (!code.toLowerCase().includes("<!doctype html>")) {
    return ["Missing <!DOCTYPE html> declaration"];
  }
  return [];
}

function checkInlineStyles(code: string): string[] {
  // Warn on excessive inline styles (>10 style= attributes)
  const count = (code.match(/\sstyle=/g) ?? []).length;
  if (count > 10) {
    return [`Excessive inline styles (${count} instances) — prefer class-based styling`];
  }
  return [];
}

function checkSignatureElement(code: string, signatureElement: string): boolean {
  if (!signatureElement) return true; // Nothing to check

  // Extract key words from signature description and look for them
  const keywords = signatureElement
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["with", "that", "this", "from", "into", "using", "based"].includes(w))
    .slice(0, 4);

  if (keywords.length === 0) return true;

  // Check if at least half the keywords appear in the code
  const found = keywords.filter((kw) => code.toLowerCase().includes(kw));
  return found.length >= Math.ceil(keywords.length / 2);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runCodeQualityLoop(
  llm: LLMAdapter,
  rawCode: string,
  signatureElement: string,
  framework: string
): Promise<CodeQualityResult> {
  // Step 1: Strip fences
  const stripped = stripFences(rawCode);

  // Step 2: Run structural checks
  const issues: string[] = [
    ...checkDoctype(stripped, framework),
    ...checkUnclosedTags(stripped),
    ...checkInlineStyles(stripped),
  ];

  // Step 3: Check signature element
  const signatureFound = checkSignatureElement(stripped, signatureElement);
  if (!signatureFound) {
    issues.push(`Signature element "${signatureElement.slice(0, 80)}" not detected in output`);
  }

  // Step 4: If no issues — return as-is
  if (issues.length === 0) {
    return { code: stripped, wasRepaired: false, issues: [], signatureFound };
  }

  // Step 5: One targeted repair pass
  const repairPrompt = [
    `The following code has these specific issues that must be fixed:`,
    issues.map((i) => `- ${i}`).join("\n"),
    ``,
    `${signatureFound ? "" : `Also ensure the signature design element is present: "${signatureElement}"\n`}`,
    `Here is the code to fix:\n\`\`\`\n${stripped}\n\`\`\``,
    ``,
    `Return ONLY the fixed code. No markdown fences. No explanation.`,
  ].join("\n");

  try {
    const repaired = await llm.complete(
      [{ role: "user", content: repairPrompt }],
      { systemPrompt: REPAIR_SYSTEM, temperature: 0.1, maxTokens: 16000 }
    );

    const repairedStripped = stripFences(repaired);

    // Verify repair actually helped
    const repairedIssues = [
      ...checkDoctype(repairedStripped, framework),
      ...checkUnclosedTags(repairedStripped),
    ];

    const repairedSignatureFound = checkSignatureElement(repairedStripped, signatureElement);

    // Use repaired if it has fewer structural issues (don't revert if repair made things worse)
    if (repairedIssues.length <= issues.filter((i) => !i.includes("inline styles")).length) {
      return {
        code:           repairedStripped,
        wasRepaired:    true,
        issues,
        signatureFound: repairedSignatureFound,
      };
    }
  } catch (err) {
    // Repair LLM call failed — return original with issues noted
    console.warn("[CodeQualityLoop] Repair call failed:", err instanceof Error ? err.message : String(err));
  }

  // Repair failed or made things worse — return stripped original
  return { code: stripped, wasRepaired: false, issues, signatureFound };
}
