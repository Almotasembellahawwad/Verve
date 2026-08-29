import type {
  DesignDirectionCandidate,
  DesignDirectionFingerprint,
  DirectionDiversityAssessment,
  DirectionDimensions,
  DirectionPortfolio,
} from "../domain/design-direction";
import type { BriefAnalysis } from "./brief-analyzer";
import type { DesignPlan } from "./plan-generator";

const DIMENSION_KEYS: (keyof DirectionDimensions)[] = [
  "topology",
  "hierarchy",
  "spatialRhythm",
  "typographyRole",
  "mediaStrategy",
  "interactionMetaphor",
  "signatureMechanism",
];

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function textDistance(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : 1 - intersection / union;
}

export function fingerprintDirection(candidate: DesignDirectionCandidate): DesignDirectionFingerprint {
  return { directionId: candidate.id, ...candidate.dimensions };
}

export function directionDistance(
  left: Pick<DesignDirectionFingerprint, keyof DirectionDimensions>,
  right: Pick<DesignDirectionFingerprint, keyof DirectionDimensions>
): number {
  const total = DIMENSION_KEYS.reduce((sum, key) => sum + textDistance(left[key], right[key]), 0);
  return Number((total / DIMENSION_KEYS.length).toFixed(3));
}

function normalizePortfolio(portfolio: DirectionPortfolio): DirectionPortfolio {
  const candidates = portfolio.candidates.slice(0, 4).map((candidate, index) => ({
    ...candidate,
    id: candidate.id.trim() || `direction-${index + 1}`,
    briefFit: Math.max(0, Math.min(100, candidate.briefFit)),
    feasibility: Math.max(0, Math.min(100, candidate.feasibility)),
    estimatedLikelihood: Math.max(0, candidate.estimatedLikelihood),
  }));
  const likelihoodTotal = candidates.reduce((sum, candidate) => sum + candidate.estimatedLikelihood, 0);
  const normalized = candidates.map((candidate) => ({
    ...candidate,
    estimatedLikelihood: Number((likelihoodTotal > 0
      ? candidate.estimatedLikelihood / likelihoodTotal
      : 1 / Math.max(candidates.length, 1)).toFixed(4)),
  }));
  const selectedDirectionId = normalized.some((candidate) => candidate.id === portfolio.selectedDirectionId)
    ? portfolio.selectedDirectionId
    : normalized[0]?.id ?? "direction-1";
  return { ...portfolio, candidates: normalized, selectedDirectionId };
}

export function assessDirectionPortfolio(
  rawPortfolio: DirectionPortfolio,
  recentFingerprints: DesignDirectionFingerprint[] = []
): DirectionDiversityAssessment {
  const portfolio = normalizePortfolio(rawPortfolio);
  const pairDistances: number[] = [];
  for (let left = 0; left < portfolio.candidates.length; left++) {
    for (let right = left + 1; right < portfolio.candidates.length; right++) {
      pairDistances.push(directionDistance(portfolio.candidates[left].dimensions, portfolio.candidates[right].dimensions));
    }
  }
  const diversityScore = pairDistances.length
    ? Math.round((pairDistances.reduce((sum, distance) => sum + distance, 0) / pairDistances.length) * 100)
    : 0;

  const scored = portfolio.candidates.map((candidate) => {
    const fingerprint = fingerprintDirection(candidate);
    const historyNovelty = recentFingerprints.length
      ? Math.min(...recentFingerprints.map((previous) => directionDistance(fingerprint, previous)))
      : portfolio.candidates.length > 1
        ? Math.min(...portfolio.candidates.filter((other) => other.id !== candidate.id).map((other) => directionDistance(candidate.dimensions, other.dimensions)))
        : 0;
    const utility = candidate.briefFit * 0.45
      + candidate.feasibility * 0.2
      + candidate.estimatedLikelihood * 100 * 0.15
      + historyNovelty * 100 * 0.2;
    return { candidate, utility };
  }).sort((left, right) => right.utility - left.utility);

  const selected = portfolio.candidates.find((candidate) => candidate.id === portfolio.selectedDirectionId);
  const historicalNoveltyScore = selected && recentFingerprints.length
    ? Math.round(Math.min(...recentFingerprints.map((previous) => directionDistance(selected.dimensions, previous))) * 100)
    : null;

  const warnings: string[] = [];
  if (portfolio.candidates.length < 3) warnings.push("Direction Portfolio contains fewer than three candidate interpretations.");
  if (diversityScore < 52) warnings.push("Direction candidates differ mostly in styling rather than experience structure.");
  if (historicalNoveltyScore !== null && historicalNoveltyScore < 42) {
    warnings.push("The selected direction is structurally close to a recent local result; choose a more novel topology.");
  }
  if (scored[0] && scored[0].candidate.id !== portfolio.selectedDirectionId) {
    warnings.push(`The selected direction is not the strongest quality-diversity candidate; ${scored[0].candidate.id} scored higher.`);
  }

  return {
    passed: warnings.length === 0,
    diversityScore,
    historicalNoveltyScore,
    recommendedDirectionId: scored[0]?.candidate.id ?? portfolio.selectedDirectionId,
    warnings,
  };
}

export function createFallbackDirectionPortfolio(plan: DesignPlan, analysis: BriefAnalysis): DirectionPortfolio {
  const subject = analysis.subject.replace(/\s+/g, " ").trim();
  return normalizePortfolio({
    source: "local-fallback",
    selectedDirectionId: "direction-domain-path",
    selectionRationale: "The domain-native path best preserves the supplied job while keeping implementation bounded.",
    candidates: [
      {
        id: "direction-domain-path",
        concept: `${subject} as a domain-native decision path`,
        justification: `Turns ${analysis.primaryJob.toLowerCase()} into the page structure instead of surrounding it with generic marketing sections.`,
        distinction: "Information topology carries the identity; decoration remains secondary.",
        briefFit: 90,
        feasibility: 92,
        estimatedLikelihood: 0.5,
        dimensions: {
          topology: plan.layoutConcept,
          hierarchy: "primary task then evidence then truthful decision",
          spatialRhythm: "compact working zones with one deliberate expansion",
          typographyRole: "typography labels evidence and establishes operational hierarchy",
          mediaStrategy: "approved evidence only with honest pending states",
          interactionMetaphor: "guided decision path",
          signatureMechanism: plan.signatureElement.implementation,
        },
      },
      {
        id: "direction-working-instrument",
        concept: `${subject} as a working instrument`,
        justification: "Lets the audience manipulate or inspect the core material before reading supporting explanation.",
        distinction: "An interface-led surface replaces the narrative page sequence.",
        briefFit: 80,
        feasibility: 76,
        estimatedLikelihood: 0.3,
        dimensions: {
          topology: "persistent workbench with controls and a live evidence surface",
          hierarchy: "tool state first then contextual guidance",
          spatialRhythm: "dense persistent frame with nested panels",
          typographyRole: "compact labels and data hierarchy",
          mediaStrategy: "functional diagrams and owned assets",
          interactionMetaphor: "inspect and manipulate",
          signatureMechanism: "one responsive evidence rail that changes with the active state",
        },
      },
      {
        id: "direction-annotated-sequence",
        concept: `${subject} as an annotated transformation`,
        justification: "Makes the audience understand change over time through staged evidence and explicit transitions.",
        distinction: "A temporal sequence replaces both dashboard and conventional landing-page structures.",
        briefFit: 77,
        feasibility: 88,
        estimatedLikelihood: 0.2,
        dimensions: {
          topology: "linear annotated sequence with before decision and after states",
          hierarchy: "transformation evidence first with action at the resolved end",
          spatialRhythm: "alternating compressed annotations and full-width evidence moments",
          typographyRole: "editorial captions establish pace and causality",
          mediaStrategy: "paired evidence or explicit asset placeholders",
          interactionMetaphor: "follow a transformation",
          signatureMechanism: "one continuous progress datum linking every state",
        },
      },
    ],
  });
}

export function normalizeDirectionPortfolio(portfolio: DirectionPortfolio): DirectionPortfolio {
  return normalizePortfolio(portfolio);
}
