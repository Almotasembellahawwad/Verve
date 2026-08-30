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
import { findUnsupportedQuantifiedClaims } from "./content-safety";
import { inspectDesignDiversity } from "./design-diversity";
import ts from "typescript";

export interface CodeQualityResult {
  code:           string;
  wasRepaired:    boolean;
  issues:         string[];
  signatureFound: boolean;
}

const REPAIR_SYSTEM = `You are a code repair specialist. Fix ONLY the specific issues listed.
Preserve the supplied content, factual safety, behavior, and framework contract. If a Template Diversity Gate issue is listed, change the information composition itself while preserving the intended job; changing colors or class names is not a repair. Otherwise avoid unrelated redesign. Return ONLY the corrected code with no markdown, no explanation.`;

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

function checkMinimumStructure(code: string, framework: string): string[] {
  if (!code.trim()) return ["Generated code is empty"];

  if (framework === "html") {
    return /<html[\s>]/i.test(code) && /<body[\s>]/i.test(code)
      ? []
      : ["HTML output is missing an <html> or <body> element"];
  }

  return /(?:export\s+default|export\s+function|function\s+[A-Z]|const\s+[A-Z])/m.test(code)
    ? []
    : ["Component output has no exported or named component"];
}

function checkDeliveryPolicies(code: string, rawBrief = ""): string[] {
  const issues: string[] = [];
  if (/dangerouslySetInnerHTML|\.innerHTML\s*=/i.test(code)) {
    issues.push("Unsafe HTML injection API detected; use framework rendering or safe DOM construction");
  }
  if (/@import\s+(?:url\()?['"]?https?:\/\/(?:fonts\.googleapis|api\.fontshare)/i.test(code)) {
    issues.push("Render-blocking runtime font import detected; use a deliberate system stack or bundled font asset");
  }
  if (/(?:^|[},\s`])(?:html|body|#root|\.site-shell|\.page-shell|\.app-shell)\s*\{[^}]*overflow(?:-x)?\s*:\s*hidden/i.test(code)) {
    issues.push("Root-level overflow hidden may conceal horizontal mobile clipping; fix the overflowing child instead");
  }
  if (/key\s*=\s*\{\s*[A-Za-z_$][\w$]*\.(?:label|title|name|heading|measure|result)\s*\}/i.test(code)) {
    issues.push("React list key is derived from display copy and may not be unique; use a stable id");
  }
  const tinySizes = [...code.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)]
    .map((match) => Number(match[1]))
    .filter((size) => size > 0 && size < 10);
  if (tinySizes.length > 0) {
    issues.push(`Text below 10px detected (${Math.min(...tinySizes)}px); keep readable UI text at 10px or larger`);
  }
  const declaredFonts = new Set(
    [...code.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*["']([^"']+)["']/gi)]
      .map((match) => match[1].toLowerCase())
  );
  const unbackedFonts = [...code.matchAll(/font-family\s*:\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((family) => !declaredFonts.has(family.toLowerCase()));
  if (unbackedFonts.length > 0) {
    issues.push(`Font "${unbackedFonts[0]}" is referenced without a bundled font or @font-face declaration`);
  }
  for (const claim of findUnsupportedQuantifiedClaims(code, rawBrief)) {
    issues.push(`Unsupported quantified claim "${claim}" is absent from the source brief; replace it with a clearly labeled pending value`);
  }
  const diversity = inspectDesignDiversity(code);
  issues.push(...diversity.warnings);
  return issues;
}

function checkEntryContract(code: string, framework: string): string[] {
  if (framework === "html") return [];
  return /export\s+default\s+(?:function|class|[A-Za-z_$])/m.test(code)
    ? []
    : [`${framework === "nextjs" ? "app/page.tsx" : "src/App.tsx"} requires a default export`];
}

function checkSyntax(code: string, framework: string): string[] {
  if (framework === "html" || !code.trim()) return [];

  const result = ts.transpileModule(code, {
    fileName: framework === "nextjs" ? "generated.tsx" : "component.tsx",
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
    },
  });

  return (result.diagnostics ?? [])
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .slice(0, 8)
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
      if (!diagnostic.file || diagnostic.start === undefined) return `Syntax error: ${message}`;
      const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return `Syntax error at ${position.line + 1}:${position.character + 1}: ${message}`;
    });
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

export function inspectSupportingSource(code: string, path: string, framework: string, rawBrief = ""): string[] {
  const stripped = stripFences(code);
  const syntax = /\.(?:tsx?|jsx?|mjs)$/i.test(path) ? checkSyntax(stripped, framework === "html" ? "react" : framework) : [];
  const markup = /\.(?:tsx?|jsx?|html)$/i.test(path) ? checkUnclosedTags(stripped) : [];
  const doctype = path.endsWith(".html") ? checkDoctype(stripped, "html") : [];
  return [...syntax, ...markup, ...doctype, ...checkInlineStyles(stripped), ...checkDeliveryPolicies(stripped, rawBrief)]
    .map((issue) => `${path}: ${issue}`);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runCodeQualityLoop(
  llm: LLMAdapter,
  rawCode: string,
  signatureElement: string,
  framework: string,
  allowRepair = true,
  rawBrief = ""
): Promise<CodeQualityResult> {
  // Step 1: Strip fences
  const stripped = stripFences(rawCode);

  // Step 2: Run structural checks
  const issues: string[] = [
    ...checkMinimumStructure(stripped, framework),
    ...checkEntryContract(stripped, framework),
    ...checkDoctype(stripped, framework),
    ...checkUnclosedTags(stripped),
    ...checkSyntax(stripped, framework),
    ...checkInlineStyles(stripped),
    ...checkDeliveryPolicies(stripped, rawBrief),
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

  // Fast mode deliberately stops at deterministic validation to preserve its
  // bounded budget. Creative mode may spend one additional call on repair.
  if (!allowRepair) {
    return { code: stripped, wasRepaired: false, issues, signatureFound };
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
      { systemPrompt: REPAIR_SYSTEM, temperature: 0.1, maxTokens: 16000, timeoutMs: 60_000 }
    );

    const repairedStripped = stripFences(repaired);

    // Verify repair actually helped
    const repairedIssues = [
      ...checkMinimumStructure(repairedStripped, framework),
      ...checkEntryContract(repairedStripped, framework),
      ...checkDoctype(repairedStripped, framework),
      ...checkUnclosedTags(repairedStripped),
      ...checkSyntax(repairedStripped, framework),
      ...checkDeliveryPolicies(repairedStripped, rawBrief),
    ];

    const repairedSignatureFound = checkSignatureElement(repairedStripped, signatureElement);

    const originalStructuralIssues = issues.filter((issue) => !issue.includes("inline styles"));

    // A repair must preserve the required signature and remove at least one
    // issue. This rejects empty, destructive, and no-op "repairs".
    if (
      repairedSignatureFound &&
      repairedIssues.length < originalStructuralIssues.length
    ) {
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
