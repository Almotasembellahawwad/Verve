const QUANTIFIED_CLAIM_PATTERN = /\b\d[\d,.]*[-\s]*(?:%|percent|per\s+cent|days?|weeks?|months?|years?|participants?|patients?|respondents?|users?|customers?|improvement|reduction|increase|faster|slower)(?=\s|[.,;:!?<'"}\]]|$)/gi;

function normalizeClaim(value: string): string {
  return value
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/per\s+cent/g, "%")
    .replace(/percent/g, "%")
    .replace(/-/g, "")
    .replace(/\s+/g, "")
    .replace(/s\b/g, "");
}

function visibleSource(code: string): string {
  return code
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/**
 * Detect quantified public-facing claims that are absent from the user's brief.
 * CSS is removed first so percentages used for layout never become content flags.
 */
export function findUnsupportedQuantifiedClaims(code: string, rawBrief: string): string[] {
  if (!rawBrief.trim()) return [];
  const supplied = new Set(
    [...rawBrief.matchAll(QUANTIFIED_CLAIM_PATTERN)].map((match) => normalizeClaim(match[0]))
  );
  const unsupported = [...visibleSource(code).matchAll(QUANTIFIED_CLAIM_PATTERN)]
    .map((match) => match[0].trim())
    .filter((claim) => !supplied.has(normalizeClaim(claim)));
  return [...new Set(unsupported)];
}
