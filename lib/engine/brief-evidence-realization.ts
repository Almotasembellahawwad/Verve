import type { BriefEvidenceContract } from "../domain/brief-evidence";

export type BriefEvidenceRealizationCheck = {
  id: string;
  kind: "record" | "attribute" | "comparison-dimension" | "gap-disclosure" | "prohibited-pattern";
  label: string;
  matched: boolean;
};

export type BriefEvidenceRealization = {
  passed: boolean;
  coverage: number;
  positiveCoverage: number;
  checks: BriefEvidenceRealizationCheck[];
  issues: string[];
};

const DISCLOSURE_PATTERNS = [
  /\bpending\b/i,
  /\bnot (?:supplied|provided|available|yet documented)\b/i,
  /\b(?:unavailable|awaiting|missing|unverified)\b/i,
  /\bto be (?:confirmed|provided|documented)\b/i,
  /\bverified (?:value|specification|record|material) (?:pending|required)\b/i,
  /(?:غير متوفر|غير موثق|بانتظار|مفقود|لم يرد|لم يتم توفيره|قيد التحقق)/i,
];

const DIMENSION_ALIASES: Record<string, string[]> = {
  "Paper weight": ["paper weight", "gsm", "g/m2", "g/m²", "وزن الورق"],
  "Binding type": ["binding type", "binding method", "binding", "bookbind", "نوع التجليد", "تجليد"],
  "Batch size": ["batch size", "batch", "edition size", "حجم الدفعة", "دفعة"],
  Price: ["price", "pricing", "cost", "egp", "usd", "eur", "gbp", "السعر", "تكلفة"],
  "Format / size": ["format", "dimensions", "المقاس", "الأبعاد", "الحجم"],
  Material: ["material", "paper stock", "substrate", "المواد", "الخامة"],
  Provenance: ["provenance", "origin", "source", "المصدر", "المنشأ"],
  Availability: ["availability", "available", "inventory", "stock", "التوفر", "المخزون"],
  Duration: ["duration", "timeline", "lead time", "المدة", "الجدول الزمني"],
  Status: ["status", "stage", "progress", "الحالة", "المرحلة"],
  Risk: ["risk", "severity", "exposure", "المخاطر", "الخطورة"],
  Location: ["location", "place", "region", "city", "الموقع", "المكان", "المدينة"],
  Performance: ["performance", "result", "efficiency", "speed", "الأداء", "النتيجة", "الكفاءة"],
  "Capacity / quantity": ["capacity", "quantity", "count", "units", "pages", "السعة", "الكمية", "العدد", "صفحات"],
};

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/&(?:nbsp|amp|quot|apos);/gi, " ")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

function isRepresented(source: string, value: string): boolean {
  const normalizedSource = normalize(source);
  const normalizedValue = normalize(value);
  if (!normalizedValue) return true;
  if (normalizedSource.includes(normalizedValue)) return true;
  const expectedTokens = tokens(value);
  if (expectedTokens.length <= 2) return expectedTokens.every((token) => normalizedSource.includes(token));
  const uniqueTokens = [...new Set(expectedTokens)];
  const matched = uniqueTokens.filter((token) => normalizedSource.includes(token)).length;
  const numericTokens = uniqueTokens.filter((token) => /\d/.test(token));
  return numericTokens.every((token) => normalizedSource.includes(token)) && matched / uniqueTokens.length >= 0.72;
}

function dimensionIsRepresented(source: string, label: string): boolean {
  const aliases = DIMENSION_ALIASES[label] ?? [label];
  return aliases.some((alias) => isRepresented(source, alias));
}

function prohibitedProbes(value: string): string[] {
  const quoted = [...value.matchAll(/["“]([^"”]{2,80})["”]/g)].map((match) => match[1]);
  if (quoted.length) return quoted;
  const stripped = value
    .replace(/\b(?:aesthetics?|language|default palettes?|photography|styling|style)\b/gi, " ")
    .replace(/[()]/g, " ");
  return stripped
    .split(/\s+(?:or|and)\s+|\//i)
    .map((part) => part.trim())
    .filter((part) => tokens(part).length > 0 && tokens(part).length <= 6);
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function gapIsDisclosed(source: string, contract: BriefEvidenceContract, gap: BriefEvidenceContract["gaps"][number]): boolean {
  if (!DISCLOSURE_PATTERNS.some((pattern) => pattern.test(source))) return false;
  const normalizedSource = normalize(source);
  if (gap.kind === "missing-records") {
    const missing = gap.expected - gap.known;
    const numberWords = Object.entries({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 })
      .filter(([, value]) => value === missing)
      .map(([word]) => word);
    const countAppears = normalizedSource.split(" ").includes(String(missing))
      || numberWords.some((word) => normalizedSource.split(" ").includes(word));
    const labelTokens = tokens(contract.collectionExpectation?.label ?? "record specifications");
    const collectionAppears = labelTokens.some((token) => normalizedSource.includes(token))
      || /\b(?:records?|products?|services?|projects?|items?|lines?|specifications?)\b/i.test(source)
      || /(?:سجلات|منتجات|خدمات|مشاريع|عناصر|خطوط|مواصفات)/i.test(source);
    return countAppears && collectionAppears;
  }
  return /\b(?:comparison|values?|data|specifications?|fields?|dimensions?)\b/i.test(source)
    || /(?:مقارنة|قيم|بيانات|مواصفات|حقول|أبعاد)/i.test(source);
}

/**
 * Checks whether generated source realizes the brief's source-bound content
 * contract. This is intentionally a deterministic source check: render gates
 * still own viewport truth, while this gate prevents generic code from passing
 * after silently dropping known records, comparison fields, or evidence gaps.
 */
export function inspectBriefEvidenceRealization(
  source: string,
  contract?: BriefEvidenceContract
): BriefEvidenceRealization {
  if (!contract) return { passed: true, coverage: 1, positiveCoverage: 1, checks: [], issues: [] };

  const checks: BriefEvidenceRealizationCheck[] = [];
  for (const record of contract.records) {
    checks.push({
      id: `record:${record.id}`,
      kind: "record",
      label: record.label,
      matched: isRepresented(source, record.label),
    });
    for (const [index, attribute] of record.attributes.entries()) {
      checks.push({
        id: `attribute:${record.id}:${index + 1}`,
        kind: "attribute",
        label: `${record.label} — ${attribute.label}: ${attribute.value}`,
        matched: isRepresented(source, attribute.value),
      });
    }
  }
  for (const dimension of contract.comparisonDimensions) {
    checks.push({
      id: `dimension:${dimension.id}`,
      kind: "comparison-dimension",
      label: dimension.label,
      matched: dimensionIsRepresented(source, dimension.label),
    });
  }
  for (const gap of contract.gaps) {
    checks.push({
      id: `gap:${gap.id}`,
      kind: "gap-disclosure",
      label: gap.message,
      matched: gapIsDisclosed(source, contract, gap),
    });
  }
  for (const prohibited of contract.prohibitedPatterns) {
    const probes = prohibitedProbes(prohibited.text);
    const match = probes.find((probe) => isRepresented(source, probe));
    checks.push({
      id: `prohibited:${prohibited.id}`,
      kind: "prohibited-pattern",
      label: prohibited.text,
      matched: !match,
    });
  }

  const positiveChecks = checks.filter((check) => check.kind !== "prohibited-pattern");
  const matchedPositive = positiveChecks.filter((check) => check.matched).length;
  const positiveCoverage = positiveChecks.length ? matchedPositive / positiveChecks.length : 1;
  const matched = checks.filter((check) => check.matched).length;
  const coverage = checks.length ? matched / checks.length : 1;
  const missingRecords = checks.filter((check) => check.kind === "record" && !check.matched);
  const missingAttributes = checks.filter((check) => check.kind === "attribute" && !check.matched);
  const missingDimensions = checks.filter((check) => check.kind === "comparison-dimension" && !check.matched);
  const missingGapDisclosures = checks.filter((check) => check.kind === "gap-disclosure" && !check.matched);
  const prohibitedMatches = checks.filter((check) => check.kind === "prohibited-pattern" && !check.matched);
  const attributeChecks = checks.filter((check) => check.kind === "attribute");
  const attributeCoverage = attributeChecks.length
    ? attributeChecks.filter((check) => check.matched).length / attributeChecks.length
    : 1;
  const dimensionChecks = checks.filter((check) => check.kind === "comparison-dimension");
  const dimensionCoverage = dimensionChecks.length
    ? dimensionChecks.filter((check) => check.matched).length / dimensionChecks.length
    : 1;

  const issues: string[] = [];
  for (const record of missingRecords.slice(0, 4)) {
    issues.push(`Brief Evidence Gate: known record "${record.label}" is absent from generated source`);
  }
  if (missingAttributes.length) {
    issues.push(`Brief Evidence Gate: record specification coverage is ${percentage(attributeCoverage)}; preserve known values such as ${missingAttributes.slice(0, 3).map((check) => `"${check.label}"`).join(", ")}`);
  }
  if (missingDimensions.length) {
    issues.push(`Brief Evidence Gate: requested comparison dimensions are missing (${missingDimensions.map((check) => check.label).join(", ")})`);
  }
  if (missingGapDisclosures.length) {
    issues.push("Brief Evidence Gate: the UI does not disclose that part of the requested collection or comparison data is not supplied; label the gap instead of inventing records");
  }
  if (prohibitedMatches.length) {
    issues.push(`Brief Evidence Gate: generated source repeats explicitly prohibited language or styling (${prohibitedMatches.slice(0, 3).map((check) => `"${check.label}"`).join(", ")})`);
  }

  const passed = missingRecords.length === 0
    && attributeCoverage >= 0.7
    && dimensionCoverage >= 0.75
    && missingGapDisclosures.length === 0
    && prohibitedMatches.length === 0;
  return { passed, coverage, positiveCoverage, checks, issues };
}
