export const BRIEF_EVIDENCE_VERSION = 1 as const;

export type BriefEvidenceKind = "quantified-fact" | "record" | "comparison-dimension" | "prohibited-pattern" | "collection-expectation";

export type BriefEvidenceItem = {
  id: string;
  kind: BriefEvidenceKind;
  text: string;
  sourceStart: number;
  sourceEnd: number;
};

export type BriefEvidenceAttribute = {
  label: string;
  value: string;
  evidenceId: string;
};

export type BriefEvidenceRecord = {
  id: string;
  label: string;
  evidenceId: string;
  attributes: BriefEvidenceAttribute[];
};

export type BriefEvidenceGap = {
  id: string;
  kind: "missing-records" | "missing-comparison-values";
  message: string;
  expected: number;
  known: number;
};

export type BriefEvidenceContract = {
  version: typeof BRIEF_EVIDENCE_VERSION;
  sourcePolicy: "verbatim-brief-spans-only";
  sourceLength: number;
  sourceDigest: string;
  density: "sparse" | "balanced" | "rich";
  items: BriefEvidenceItem[];
  records: BriefEvidenceRecord[];
  comparisonDimensions: Array<{ id: string; label: string; evidenceId: string }>;
  prohibitedPatterns: Array<{ id: string; text: string; evidenceId: string }>;
  collectionExpectation?: {
    label: string;
    expectedCount: number;
    knownRecordCount: number;
    evidenceId: string;
  };
  gaps: BriefEvidenceGap[];
};

export type BriefEvidenceValidation = { valid: boolean; issues: string[] };
