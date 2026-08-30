import type { ReferenceEntry, ReferenceLibraryRepositoryPort } from "../ports/repositories";
import type { BriefAnalysis } from "./brief-analyzer";

export type ReferencePatternSet = {
  domain: string;
  near: ReferenceEntry;
  far: [ReferenceEntry, ReferenceEntry];
  antiReference: { sourceId: string; risk: string };
};

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const DOMAIN_RULES: { id: string; pattern: RegExp }[] = [
  { id: "hospitality", pattern: /food|restaurant|cafe|hotel|hospitality|menu|طعام|مطعم|مقهى|ضيافة|فندق/i },
  { id: "architecture", pattern: /architecture|interior|building|space|architecture|عمارة|معمار|داخلي|مبنى/i },
  { id: "health", pattern: /health|medical|clinic|wellness|skincare|صحة|طبي|عيادة|بشرة/i },
  { id: "finance", pattern: /finance|bank|invest|fintech|payment|مال|بنك|استثمار|دفع/i },
  { id: "legal", pattern: /legal|law|attorney|compliance|قانون|محام|امتثال/i },
  { id: "education", pattern: /education|learn|school|course|تعليم|تعلم|مدرسة|دورة/i },
  { id: "commerce", pattern: /commerce|shop|store|fashion|product|retail|متجر|تجارة|أزياء|منتج/i },
  { id: "culture", pattern: /museum|culture|archive|exhibition|متحف|ثقافة|أرشيف|معرض/i },
  { id: "civic", pattern: /government|public service|civic|municipal|حكومة|خدمة عامة|مدني|بلدية/i },
  { id: "productivity", pattern: /software|saas|productivity|workflow|developer|برمج|إنتاجية|سير عمل/i },
  { id: "creative", pattern: /portfolio|studio|artist|music|film|creative|استوديو|فنان|موسيقى|فيلم|إبداع/i },
  { id: "climate", pattern: /climate|carbon|energy|sustain|environment|مناخ|كربون|طاقة|استدام|بيئة/i },
];

export function classifyReferenceDomain(analysis: BriefAnalysis): string {
  const text = `${analysis.industry} ${analysis.subject} ${analysis.primaryJob} ${analysis.rawBrief}`;
  return DOMAIN_RULES.find((rule) => rule.pattern.test(text))?.id ?? "creative";
}

function rotate<T>(items: T[], seed: number): T[] {
  if (items.length < 2) return [...items];
  const offset = seed % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export function selectReferencePatterns(
  analysis: BriefAnalysis,
  repository: ReferenceLibraryRepositoryPort,
  recentReferenceIds: string[] = []
): ReferencePatternSet {
  const entries = repository.list();
  if (entries.length < 4) throw new Error("Reference library v2 requires at least four abstracted patterns.");
  const domain = classifyReferenceDomain(analysis);
  const seed = fnv1a(`${analysis.rawBrief}\u001f${recentReferenceIds.join("|")}`);
  const unused = entries.filter((entry) => !recentReferenceIds.includes(entry.id));
  const pool = unused.length >= 4 ? unused : entries;
  const nearPool = pool.filter((entry) => entry.domainTags?.includes(domain) || entry.industry === domain);
  const near = rotate(nearPool.length ? nearPool : pool, seed)[0];
  const farPool = rotate(
    pool.filter((entry) => entry.id !== near.id && entry.industry !== near.industry),
    Math.floor(seed / 7)
  );
  const firstFar = farPool[0];
  const secondFar = farPool.find((entry) =>
    entry.industry !== firstFar?.industry
    && entry.experienceModels?.[0] !== firstFar?.experienceModels?.[0]
  ) ?? farPool[1];
  if (!firstFar || !secondFar) throw new Error("Reference library v2 could not provide two remote analogies.");
  const risk = near.fixationRisks?.[0]
    ?? firstFar.fixationRisks?.[0]
    ?? "Do not copy the source composition, typography, palette, or brand identity.";
  return { domain, near, far: [firstFar, secondFar], antiReference: { sourceId: near.id, risk } };
}

export function formatReferencePatternsForPrompt(set: ReferencePatternSet): string {
  const describe = (entry: ReferenceEntry) => ({
    id: entry.id,
    domain: entry.industry,
    experienceModel: entry.experienceModels?.[0],
    principles: entry.transferablePrinciples ?? [entry.what_makes_it_work],
    mechanics: entry.mechanics ?? entry.specific_techniques,
  });
  return [
    "=== ABSTRACTED REFERENCE PATTERNS ===",
    "These are transferable principles, never visual recipes. Do not imitate a source brand, palette, typeface, page silhouette, or copy.",
    JSON.stringify({ near: describe(set.near), remoteAnalogies: set.far.map(describe), antiReference: set.antiReference }),
  ].join("\n");
}
