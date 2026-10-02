import type { DesignDirectionCandidate } from "../domain/design-direction";
import type { BriefEvidenceContract, BriefEvidenceAttribute } from "../domain/brief-evidence";
import { colorContrast, resolveDesignColorRoles } from "./design-color-roles";
import type { DesignContract } from "../domain/design-contract";
import { buildBriefEvidenceContract } from "./brief-evidence";
import { analyzeBriefLocally } from "./brief-analyzer";
import { assessMediaRequirement } from "./media-requirement";

export type StudyEntry = {
  id: string; label: string; text: string; kind: "record" | "brief-excerpt";
  attributes: BriefEvidenceAttribute[];
};
export type DirectionStudyContext = {
  heading: string; locale: "ar" | "en"; evidence: BriefEvidenceContract;
  entries: StudyEntry[]; mediaExcluded: boolean;
};
export type DirectionStudy = {
  version: 1; directionId: string; context: DirectionStudyContext;
  colors: DesignContract["colorRoles"];
  media: "excluded" | "not-used" | "available" | "not-supplied";
  warnings: string[];
};

/** The fallback's full brief belongs in inspection, not six oversized card titles. */
export function directionStudyLabel(candidate: DesignDirectionCandidate): string {
  const fallback = candidate.concept.match(/ as (?:a|an) (.{1,80})$/i)?.[1];
  if (fallback) return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  return candidate.concept.length > 140 ? `${candidate.concept.slice(0, 137).trimEnd()}…` : candidate.concept;
}

/** Local, bounded, verbatim decision material. A declared total never pads the dataset. */
export function buildDirectionStudyContext(brief: string, brandName?: string): DirectionStudyContext {
  const evidence = buildBriefEvidenceContract(brief);
  const locale = /[\u0600-\u06ff]/.test(brief) ? "ar" : "en";
  const exclusion = /(?:explicitly\s+avoid|\bavoid\b|do not|don't|must not|تجنب|تجنّب|لا تستخدم|يجب ألا)/i;
  const clauses = [...brief.matchAll(/[^.!?\n]+(?:[.!?]+|$)/g)];
  const excludedRecord = (evidenceId: string) => {
    const span = evidence.items.find((item) => item.id === evidenceId)!;
    return clauses.some((clause) => exclusion.test(clause[0]) && span.sourceStart >= clause.index! && span.sourceStart < clause.index! + clause[0].length);
  };
  const records: StudyEntry[] = evidence.records.filter((record) => !excludedRecord(record.evidenceId)).slice(0, 6).map((record) => ({
    id: record.id, label: record.label,
    text: evidence.items.find((item) => item.id === record.evidenceId)!.text,
    kind: "record", attributes: record.attributes,
  }));
  // Exclusions are design constraints, never visitor-facing offer/evidence cards.
  const excerpt = /[^.!?\n]+(?:[.!?]+|$)/g;
  const entries = records.length ? records : [...brief.matchAll(excerpt)]
    .map((match) => match[0].trim())
    .filter((text) => text && !exclusion.test(text))
    .slice(0, 4).map((text, index): StudyEntry => ({
      id: `excerpt-${index + 1}`, label: locale === "ar" ? `من البريف ${index + 1}` : `Brief excerpt ${index + 1}`,
      text: text.slice(0, 500), kind: "brief-excerpt", attributes: [],
    }));
  const first = entries[0];
  const heading = brandName?.trim().slice(0, 120)
    || (first?.kind === "record" ? first.label : first?.text.slice(0, 160))
    || (locale === "ar" ? "لم يُقدّم محتوى للمعاينة" : "No preview content supplied");
  return { heading, locale, evidence, entries, mediaExcluded: assessMediaRequirement(analyzeBriefLocally(brief)).level === "avoid" };
}

/** A structural interpretation, not generated code or measured quality evidence. */
export function buildDirectionStudy(candidate: DesignDirectionCandidate, context: DirectionStudyContext, suppliedPhotoCount = 0): DirectionStudy {
  const colors = resolveDesignColorRoles(candidate.identity.palette);
  const media = context.mediaExcluded ? "excluded" : candidate.descriptors.mediaRole === "none" ? "not-used"
    : suppliedPhotoCount > 0 ? "available" : "not-supplied";
  const warnings = context.evidence.gaps.map((gap) => gap.message);
  if (media === "not-supplied") warnings.push(context.locale === "ar" ? "لم تُقدّم صور معتمدة لهذه الدراسة؛ لا تمثّل العناصر الرسومية صورًا حقيقية." : "No approved photography supplied for this study; graphic elements are not real imagery.");
  if (colorContrast(colors.textPrimary, colors.surface) < 4.5) warnings.push("Candidate palette needs a readable text/surface pair before delivery.");
  return { version: 1, directionId: candidate.id, context, colors, media, warnings };
}
