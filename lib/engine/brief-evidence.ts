import {
  BRIEF_EVIDENCE_VERSION,
  type BriefEvidenceAttribute,
  type BriefEvidenceContract,
  type BriefEvidenceItem,
  type BriefEvidenceValidation,
} from "../domain/brief-evidence";

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  واحد: 1,
  واحدة: 1,
  اثنان: 2,
  اثنتان: 2,
  اثنين: 2,
  اثنتين: 2,
  ثلاثة: 3,
  أربع: 4,
  اربعة: 4,
  أربعة: 4,
  خمس: 5,
  خمسة: 5,
  ست: 6,
  ستة: 6,
  سبع: 7,
  سبعة: 7,
  ثمان: 8,
  ثمانية: 8,
  تسع: 9,
  تسعة: 9,
  عشر: 10,
  عشرة: 10,
};

const DIMENSION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Paper weight", pattern: /paper\s+weight|\d+(?:\.\d+)?\s*gsm\b|وزن\s+الورق/i },
  { label: "Binding type", pattern: /binding(?:\s+type|\s+method)?|bookbind|نوع\s+التجليد|تجليد/i },
  { label: "Batch size", pattern: /batch(?:\s+size)?|edition\s+size|حجم\s+الدفعة|دفعة/i },
  { label: "Price", pattern: /price|cost|pricing|\b(?:egp|usd|eur|gbp)\b|السعر|تكلفة/i },
  { label: "Format / size", pattern: /format|dimensions?|\bA[0-9]\b|size|المقاس|الأبعاد|الحجم/i },
  { label: "Material", pattern: /materials?|paper\s+stock|substrate|fabric|wood|metal|المواد|الخامة/i },
  { label: "Provenance", pattern: /provenance|origin|source|traceab|المصدر|المنشأ/i },
  { label: "Availability", pattern: /availability|available|inventory|stock|التوفر|المخزون/i },
  { label: "Duration", pattern: /duration|timeline|lead\s+time|days?|weeks?|المدة|الجدول\s+الزمني/i },
  { label: "Status", pattern: /status|stage|progress|الحالة|المرحلة/i },
  { label: "Risk", pattern: /risk|severity|exposure|المخاطر|الخطورة/i },
  { label: "Location", pattern: /location|place|region|city|الموقع|المكان|المدينة/i },
  { label: "Performance", pattern: /performance|result|efficiency|speed|الأداء|النتيجة|الكفاءة/i },
  { label: "Capacity / quantity", pattern: /capacity|quantity|count|units?|pages?|السعة|الكمية|العدد|صفحات/i },
];

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitOutsideGroups(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote || (quote === "“" && character === "”")) quote = "";
      continue;
    }
    if (character === '"' || character === "“" || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") depth++;
    if (character === ")") depth = Math.max(0, depth - 1);
    if ((character === "," || character === ";" || character === "،" || character === "؛") && depth === 0) {
      if (compact(current)) parts.push(compact(current));
      current = "";
      continue;
    }
    current += character;
  }
  if (compact(current)) parts.push(compact(current));
  return parts;
}

function sentenceSpans(source: string): Array<{ text: string; start: number; end: number }> {
  const spans: Array<{ text: string; start: number; end: number }> = [];
  const pattern = /[^.!?\n]+(?:[.!?]+|$)/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[0];
    const leading = raw.search(/\S/);
    if (leading < 0 || match.index === undefined) continue;
    const text = compact(raw);
    const start = match.index + leading;
    spans.push({ text, start, end: start + raw.trim().length });
  }
  return spans;
}

function addItem(
  items: BriefEvidenceItem[],
  seen: Set<string>,
  source: string,
  kind: BriefEvidenceItem["kind"],
  start: number,
  end: number
): BriefEvidenceItem | undefined {
  const boundedStart = Math.max(0, start);
  const boundedEnd = Math.min(source.length, end);
  const text = compact(source.slice(boundedStart, boundedEnd)).slice(0, 500);
  const key = `${kind}:${text.toLowerCase()}`;
  if (!text || seen.has(key)) return undefined;
  const item = { id: `evidence-${items.length + 1}`, kind, text, sourceStart: boundedStart, sourceEnd: boundedEnd };
  items.push(item);
  seen.add(key);
  return item;
}

function attributeLabel(value: string): string {
  const match = DIMENSION_PATTERNS.find((candidate) => candidate.pattern.test(value));
  if (match) return match.label;
  if (/\b\d+(?:\.\d+)?\s*(?:gsm|g\/m²)\b/i.test(value)) return "Paper weight";
  if (/\b(?:egp|usd|eur|gbp)\s*\d|[$€£]\s*\d/i.test(value)) return "Price";
  if (/\bA[0-9]\b/i.test(value)) return "Format / size";
  return "Specification";
}

function appendRecord(
  source: string,
  content: string,
  contentStart: number,
  items: BriefEvidenceItem[],
  seen: Set<string>,
  records: BriefEvidenceContract["records"],
  recordKeys: Set<string>
): void {
  if (records.length >= 20) return;
  const split = content.split(/\s+[—–]\s+|\s+-\s+/);
  if (split.length < 2 || !/\d|\b(?:egp|usd|eur|gbp|gsm)\b/i.test(content)) return;
  const label = compact(split.shift() ?? "").replace(/^["“]|["”]$/g, "").slice(0, 120);
  const specification = compact(split.join(" — ")).replace(/["”]$/g, "");
  const key = `${label.toLocaleLowerCase()}:${specification.toLocaleLowerCase()}`;
  if (!label || !specification || recordKeys.has(key)) return;
  const evidence = addItem(items, seen, source, "record", contentStart, contentStart + content.length);
  if (!evidence) return;
  const attributes: BriefEvidenceAttribute[] = splitOutsideGroups(specification).slice(0, 16).map((value) => ({
    label: attributeLabel(value),
    value: value.slice(0, 220),
    evidenceId: evidence.id,
  }));
  records.push({ id: `record-${records.length + 1}`, label, evidenceId: evidence.id, attributes });
  recordKeys.add(key);
}

function extractRecords(source: string, items: BriefEvidenceItem[], seen: Set<string>) {
  const records: BriefEvidenceContract["records"] = [];
  const recordKeys = new Set<string>();
  const quotePattern = /["“]([^"”\n]{4,500})["”]/g;
  for (const match of source.matchAll(quotePattern)) {
    if (records.length >= 20) break;
    if (match.index === undefined) continue;
    const content = compact(match[1]);
    appendRecord(source, content, match.index + 1, items, seen, records, recordKeys);
  }
  const linePattern = /(?:^|\n)[ \t]*(?:[-*•]\s+|\d{1,2}[.)]\s+)([^\n]{4,500})/g;
  for (const match of source.matchAll(linePattern)) {
    if (records.length >= 20) break;
    if (match.index === undefined || /^["“]/.test(match[1].trim())) continue;
    const content = match[1].trim();
    const offset = match[0].indexOf(match[1]) + match[1].indexOf(content);
    appendRecord(source, content, match.index + offset, items, seen, records, recordKeys);
  }
  return records;
}

function collectionExpectation(source: string, items: BriefEvidenceItem[], seen: Set<string>) {
  const english = /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:finished\s+|active\s+|available\s+|current\s+)?(product\s+lines?|products?|services?|cases?|projects?|plans?|options?|items?|locations?|courses?|collections?)\b/i;
  const arabic = /(\d{1,3}|واحد(?:ة)?|اثنان|اثنتان|اثنين|اثنتين|ثلاثة|أربع|اربعة|أربعة|خمس(?:ة)?|ست(?:ة)?|سبع(?:ة)?|ثمان(?:ية)?|تسع(?:ة)?|عشر(?:ة)?)\s+(خطوط\s+منتجات|منتجات|خدمات|حالات|مشاريع|خطط|خيارات|عناصر|مواقع|دورات|مجموعات)/i;
  const match = english.exec(source) ?? arabic.exec(source);
  if (!match || match.index === undefined) return undefined;
  const expectedCount = /^\d+$/.test(match[1]) ? Number(match[1]) : NUMBER_WORDS[match[1].toLowerCase()];
  if (!expectedCount || expectedCount > 100) return undefined;
  const evidence = addItem(items, seen, source, "collection-expectation", match.index, match.index + match[0].length);
  if (!evidence) return undefined;
  return { label: compact(match[2]), expectedCount, knownRecordCount: 0, evidenceId: evidence.id };
}

function prohibitedPatterns(source: string, items: BriefEvidenceItem[], seen: Set<string>) {
  const clauses: Array<{ value: string; start: number }> = [];
  const pattern = /(?:explicitly\s+avoid|avoid|do\s+not\s+use|don't\s+use|must\s+not\s+use|تجنب|تجنّب|لا\s+تستخدم|يجب\s+ألا\s+تستخدم)\s*:?[ \t]*([^\n.]+)/gi;
  for (const match of source.matchAll(pattern)) {
    if (match.index === undefined) continue;
    const value = match[1].replace(/[.\s]+$/, "");
    clauses.push({ value, start: match.index + match[0].indexOf(match[1]) });
  }
  const output: BriefEvidenceContract["prohibitedPatterns"] = [];
  clausesLoop: for (const clause of clauses) {
    for (const rawPart of splitOutsideGroups(clause.value)) {
      if (output.length >= 20) break clausesLoop;
      const part = compact(rawPart.replace(/^(?:and|or)\s+/i, "").replace(/[.\s]+$/, ""));
      if (!part) continue;
      const relative = source.toLowerCase().indexOf(part.toLowerCase(), clause.start);
      const start = relative >= 0 ? relative : clause.start;
      const evidence = addItem(items, seen, source, "prohibited-pattern", start, start + part.length);
      if (!evidence) continue;
      output.push({ id: `prohibited-${output.length + 1}`, text: evidence.text, evidenceId: evidence.id });
    }
  }
  return output;
}

function comparisonDimensions(source: string, items: BriefEvidenceItem[], seen: Set<string>) {
  const comparisonStarts = [...source.matchAll(/compare|comparison|versus|مقارن/gi)];
  if (!comparisonStarts.length) return [];
  const output: BriefEvidenceContract["comparisonDimensions"] = [];
  const labels = new Set<string>();
  const occupiedRanges: Array<{ start: number; end: number }> = [];
  for (const startMatch of comparisonStarts) {
    if (startMatch.index === undefined) continue;
    const sentenceEnd = source.slice(startMatch.index).search(/[.\n]/);
    const end = sentenceEnd < 0 ? Math.min(source.length, startMatch.index + 320) : startMatch.index + sentenceEnd;
    const window = source.slice(startMatch.index, end);
    for (const candidate of DIMENSION_PATTERNS) {
      if (labels.has(candidate.label)) continue;
      const match = candidate.pattern.exec(window);
      if (!match || match.index === undefined) continue;
      const absoluteStart = startMatch.index + match.index;
      const absoluteEnd = absoluteStart + match[0].length;
      if (occupiedRanges.some((range) => absoluteStart < range.end && absoluteEnd > range.start)) continue;
      const evidence = addItem(items, seen, source, "comparison-dimension", absoluteStart, absoluteEnd);
      if (!evidence) continue;
      output.push({ id: `dimension-${output.length + 1}`, label: candidate.label, evidenceId: evidence.id });
      labels.add(candidate.label);
      occupiedRanges.push({ start: absoluteStart, end: absoluteEnd });
    }
  }
  return output;
}

export function buildBriefEvidenceContract(source: string): BriefEvidenceContract {
  const items: BriefEvidenceItem[] = [];
  const seen = new Set<string>();
  const records = extractRecords(source, items, seen);
  const expectation = collectionExpectation(source, items, seen);
  const prohibited = prohibitedPatterns(source, items, seen);
  const dimensions = comparisonDimensions(source, items, seen);

  for (const sentence of sentenceSpans(source)) {
    if (items.length >= 64) break;
    const quantified = /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(?:egp|usd|eur|gbp|gsm|pages?|units?)\b/i.test(sentence.text);
    if (quantified) addItem(items, seen, source, "quantified-fact", sentence.start, sentence.end);
  }

  const collection = expectation ? { ...expectation, knownRecordCount: records.length } : undefined;
  const arabicSource = /[\u0600-\u06ff]/.test(source);
  const gaps: BriefEvidenceContract["gaps"] = [];
  if (collection && collection.expectedCount > collection.knownRecordCount) {
    const missingCount = collection.expectedCount - collection.knownRecordCount;
    gaps.push({
      id: "gap-missing-records",
      kind: "missing-records",
      message: arabicSource
        ? `ينقص البريف مواصفات موثقة على مستوى السجل لعدد ${missingCount} من ${collection.label}.`
        : `${missingCount} ${collection.label} lack verified record-level specifications in the brief.`,
      expected: collection.expectedCount,
      known: collection.knownRecordCount,
    });
  }
  const knownComparisonValues = records.reduce((total, record) => total + dimensions
    .filter((dimension) => record.attributes.some((attribute) => attribute.label === dimension.label))
    .length, 0);
  if (dimensions.length && records.length && knownComparisonValues < dimensions.length * records.length) {
    gaps.push({
      id: "gap-missing-comparison-values",
      kind: "missing-comparison-values",
      message: arabicSource
        ? "سجل موثق واحد أو أكثر لا يوفّر كل أبعاد المقارنة المطلوبة."
        : "One or more known records do not supply every requested comparison dimension.",
      expected: dimensions.length * records.length,
      known: knownComparisonValues,
    });
  }
  const richness = items.length + records.reduce((total, record) => total + record.attributes.length, 0) + dimensions.length + prohibited.length;
  const density = richness >= 12 ? "rich" : richness >= 5 ? "balanced" : "sparse";

  return {
    version: BRIEF_EVIDENCE_VERSION,
    sourcePolicy: "verbatim-brief-spans-only",
    sourceLength: source.length,
    sourceDigest: fnv1a(source),
    density,
    items,
    records,
    comparisonDimensions: dimensions.slice(0, 16),
    prohibitedPatterns: prohibited.slice(0, 20),
    ...(collection ? { collectionExpectation: collection } : {}),
    gaps,
  };
}

export function validateBriefEvidenceContract(contract: BriefEvidenceContract, source?: string): BriefEvidenceValidation {
  const issues: string[] = [];
  if (contract.version !== BRIEF_EVIDENCE_VERSION) issues.push("Unsupported brief evidence version.");
  if (contract.sourcePolicy !== "verbatim-brief-spans-only") issues.push("Brief evidence must use verbatim source spans.");
  if (contract.items.length > 64 || contract.records.length > 20 || contract.comparisonDimensions.length > 16 || contract.prohibitedPatterns.length > 20) issues.push("Brief evidence exceeds its bounded contract size.");
  const itemIds = new Set(contract.items.map((item) => item.id));
  if (itemIds.size !== contract.items.length) issues.push("Brief evidence item IDs must be unique.");
  const recordIds = new Set(contract.records.map((record) => record.id));
  if (recordIds.size !== contract.records.length) issues.push("Brief evidence record IDs must be unique.");
  for (const item of contract.items) {
    if (!item.text.trim() || item.text.length > 500) issues.push(`${item.id} has invalid evidence text.`);
    if (!Number.isInteger(item.sourceStart) || !Number.isInteger(item.sourceEnd) || item.sourceStart < 0 || item.sourceEnd <= item.sourceStart || item.sourceEnd > contract.sourceLength) issues.push(`${item.id} has an invalid source span.`);
    if (source && compact(source.slice(item.sourceStart, item.sourceEnd)).slice(0, 500) !== item.text) issues.push(`${item.id} does not match its source span.`);
  }
  if (source && (contract.sourceLength !== source.length || contract.sourceDigest !== fnv1a(source))) issues.push("Brief evidence is bound to a different source brief.");
  for (const record of contract.records) {
    if (!itemIds.has(record.evidenceId)) issues.push(`${record.id} references unknown evidence.`);
    if (!record.label.trim()) issues.push(`${record.id} has no label.`);
    for (const attribute of record.attributes) if (!itemIds.has(attribute.evidenceId) || !attribute.label.trim() || !attribute.value.trim()) issues.push(`${record.id} has an invalid attribute.`);
  }
  for (const dimension of contract.comparisonDimensions) if (!itemIds.has(dimension.evidenceId) || !dimension.label.trim()) issues.push(`${dimension.id} has invalid evidence.`);
  for (const prohibited of contract.prohibitedPatterns) if (!itemIds.has(prohibited.evidenceId) || !prohibited.text.trim()) issues.push(`${prohibited.id} has invalid evidence.`);
  if (contract.collectionExpectation) {
    if (!itemIds.has(contract.collectionExpectation.evidenceId)) issues.push("Collection expectation references unknown evidence.");
    if (contract.collectionExpectation.expectedCount < contract.collectionExpectation.knownRecordCount) issues.push("Known records exceed the declared collection expectation.");
  }
  for (const gap of contract.gaps) if (gap.known < 0 || gap.expected < gap.known || !gap.message.trim()) issues.push(`${gap.id} is invalid.`);
  return { valid: issues.length === 0, issues };
}

export function evidenceFactValues(contract: BriefEvidenceContract): string[] {
  return contract.items
    .filter((item) => item.kind === "record" || item.kind === "quantified-fact" || item.kind === "collection-expectation")
    .map((item) => item.text)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 24);
}
