import clicheraw from "../../data/cliches.json";

type ClicheEntry = {
  id: string;
  category: string;
  pattern: string;
  description: string;
  example_values: string[];
  severity: string;
  date_observed: string;
  tags: string[];
};

type ClicheData = {
  version: string;
  cliches: ClicheEntry[];
};

const clicheData = clicheraw as ClicheData;

export type BlocklistMatch = {
  id: string;
  category: string;
  pattern: string;
  severity: string;
  matchedValues: string[];
};

export type BlocklistResult = {
  matches: BlocklistMatch[];
  blockedCategories: string[];
  systemPromptInjection: string;
};

/**
 * Checks brief text and existing code against the cliché blocklist.
 * Returns matches + a system prompt injection string for steps [3] and [4].
 */
export function runBlocklistFilter(content: string, existingCode?: string): BlocklistResult {
  const fullText = [content, existingCode ?? ""].join("\n").toLowerCase();
  const matches: BlocklistMatch[] = [];

  for (const entry of clicheData.cliches) {
    const matchedValues = entry.example_values.filter((val) =>
      fullText.includes(val.toLowerCase())
    );

    // Also check pattern keywords in the text
    const patternWords = entry.pattern.toLowerCase().split(/\s+/).filter((word) => word.length > 5);
    const keywordHits = patternWords.filter((word) => fullText.includes(word)).length;
    // Two generic source-code tokens such as "heading" and "weight" do not
    // prove a compound visual cliché. Exact examples remain authoritative;
    // keyword inference requires most of a pattern's distinctive vocabulary.
    const keywordThreshold = Math.max(3, Math.ceil(patternWords.length * 0.75));
    const keywordHit = patternWords.length >= 3 && keywordHits >= keywordThreshold;

    if (matchedValues.length > 0 || keywordHit) {
      matches.push({
        id: entry.id,
        category: entry.category,
        pattern: entry.pattern,
        severity: entry.severity,
        matchedValues,
      });
    }
  }

  const blockedCategories = [...new Set(matches.map((m) => m.category))];

  const blocklist = clicheData.cliches
    .map(
      (e) =>
        `[${e.severity.toUpperCase()}] ${e.category}: ${e.pattern}\n  → Avoid: ${e.example_values.slice(0, 3).join(", ")}`
    )
    .join("\n");

  const detectedWarnings =
    matches.length > 0
      ? `\n\nWARNING — Detected potential clichés in existing content:\n${matches.map((m) => `- ${m.pattern} (${m.severity})`).join("\n")}`
      : "";

  const systemPromptInjection = `=== VERVE CLICHÉ BLOCKLIST (v${clicheData.version}) ===
The following design patterns are FORBIDDEN because they represent the statistical default of AI-generated UIs.
Using any of these will produce a result indistinguishable from any other AI-generated design.

${blocklist}
${detectedWarnings}

You MUST actively avoid every pattern above. When tempted to use a "safe" or "neutral" choice, ask: is this on the blocklist? If it might be, choose something else. The goal is a design that could only exist for this specific brief.`;

  return { matches, blockedCategories, systemPromptInjection };
}

export function getAllCliches(): ClicheData {
  return clicheData;
}
