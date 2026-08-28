export type ClicheEntry = {
  id: string;
  category: string;
  pattern: string;
  description: string;
  example_values: string[];
  severity: string;
  date_observed: string;
  tags: string[];
};

export type ClicheData = { version: string; cliches: ClicheEntry[] };

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

/** Pure domain rule: no storage, framework, network, or provider dependency. */
export function evaluateBlocklist(
  data: ClicheData,
  content: string,
  existingCode?: string
): BlocklistResult {
  const fullText = [content, existingCode ?? ""].join("\n").toLowerCase();
  const matches: BlocklistMatch[] = [];

  for (const entry of data.cliches) {
    const matchedValues = entry.example_values.filter((value) => fullText.includes(value.toLowerCase()));
    const patternWords = entry.pattern.toLowerCase().split(/\s+/).filter((word) => word.length > 5);
    const keywordHits = patternWords.filter((word) => fullText.includes(word)).length;
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

  const blockedCategories = [...new Set(matches.map((match) => match.category))];
  const blocklist = data.cliches
    .map((entry) => `[${entry.severity.toUpperCase()}] ${entry.category}: ${entry.pattern}\n  → Avoid: ${entry.example_values.slice(0, 3).join(", ")}`)
    .join("\n");
  const detectedWarnings = matches.length > 0
    ? `\n\nWARNING — Detected potential clichés in existing content:\n${matches.map((match) => `- ${match.pattern} (${match.severity})`).join("\n")}`
    : "";
  const systemPromptInjection = `=== VERVE CLICHÉ BLOCKLIST (v${data.version}) ===
The following design patterns are forbidden because they represent the statistical default of AI-generated UIs.

${blocklist}
${detectedWarnings}

Actively avoid every pattern above and choose a brief-specific alternative.`;

  return { matches, blockedCategories, systemPromptInjection };
}

