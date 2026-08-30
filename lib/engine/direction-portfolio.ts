import type {
  DesignDirectionCandidate,
  DesignDirectionFingerprint,
  DirectionDescriptors,
  DirectionDiversityAssessment,
  DirectionDimensions,
  DirectionPortfolio,
} from "../domain/design-direction";
import type { BriefAnalysis } from "./brief-analyzer";
import type { DesignPlan } from "./plan-generator";
import {
  designStructureDistance,
  inferDesignStructure,
  mergeDesignStructures,
} from "./structural-fingerprint";

const DIMENSION_KEYS: (keyof DirectionDimensions)[] = [
  "topology",
  "hierarchy",
  "spatialRhythm",
  "typographyRole",
  "mediaStrategy",
  "interactionMetaphor",
  "signatureMechanism",
];

const DESCRIPTOR_KEYS: (keyof DirectionDescriptors)[] = [
  "creativityClass",
  "experienceModel",
  "openingMode",
  "navigationModel",
  "density",
  "spatialSystem",
  "mediaRole",
  "motionRole",
  "typographyVoice",
  "colorStrategy",
];

const DEFAULT_DESCRIPTOR_PORTFOLIO: DirectionDescriptors[] = [
  { creativityClass: "combinational", experienceModel: "guided-conversation", openingMode: "question-first", navigationModel: "stepper", density: "balanced", spatialSystem: "progressive decision chambers", mediaRole: "supporting", motionRole: "feedback", typographyVoice: "humanist and conversational", colorStrategy: "warm field with a cool decision color" },
  { creativityClass: "combinational", experienceModel: "spatial-map", openingMode: "media-first", navigationModel: "spatial", density: "balanced", spatialSystem: "zoomable atlas with anchored annotations", mediaRole: "primary", motionRole: "spatial", typographyVoice: "measured cartographic labels", colorStrategy: "material neutrals with survey marks" },
  { creativityClass: "exploratory", experienceModel: "task-workbench", openingMode: "task-first", navigationModel: "hub-and-spoke", density: "dense", spatialSystem: "persistent instrument frame", mediaRole: "evidence", motionRole: "data", typographyVoice: "compact operational hierarchy", colorStrategy: "dark instrument surface with luminous status" },
  { creativityClass: "exploratory", experienceModel: "collection-browser", openingMode: "index-first", navigationModel: "filter-and-inspect", density: "dense", spatialSystem: "adaptive collection mosaic", mediaRole: "primary", motionRole: "feedback", typographyVoice: "catalog labels with expressive item titles", colorStrategy: "category-led chromatic families" },
  { creativityClass: "transformational", experienceModel: "live-canvas", openingMode: "canvas-first", navigationModel: "direct-manipulation", density: "balanced", spatialSystem: "reactive field around one manipulable object", mediaRole: "interactive", motionRole: "spatial", typographyVoice: "quiet interface labels around a visual core", colorStrategy: "environmental field that responds to state" },
  { creativityClass: "transformational", experienceModel: "narrative-scroll", openingMode: "story-first", navigationModel: "linear", density: "airy", spatialSystem: "episodic sequence with changing scale and direction", mediaRole: "evidence", motionRole: "narrative", typographyVoice: "voice-led display with documentary captions", colorStrategy: "chapter-specific color states" },
];

const DEFAULT_IDENTITIES = [
  { palette: [{ name: "Apricot", hex: "#F5A46C", role: "conversation field" }, { name: "Deep Teal", hex: "#073B3A", role: "decision text" }, { name: "Milk", hex: "#FFF8E9", role: "reading surface" }, { name: "Blue Note", hex: "#3366FF", role: "active state" }], displayTypeface: "Trebuchet MS, sans-serif", bodyTypeface: "Arial, sans-serif" },
  { palette: [{ name: "Limestone", hex: "#E8E0D1", role: "map surface" }, { name: "Plan Ink", hex: "#242A23", role: "annotation" }, { name: "Cobalt", hex: "#2454D7", role: "survey mark" }, { name: "Moss", hex: "#667A58", role: "material layer" }], displayTypeface: "Arial Narrow, Arial, sans-serif", bodyTypeface: "Georgia, serif" },
  { palette: [{ name: "Instrument", hex: "#091013", role: "work surface" }, { name: "Phosphor", hex: "#B7F34B", role: "live status" }, { name: "Ice", hex: "#D7F8FF", role: "primary data" }, { name: "Steel", hex: "#56656C", role: "inactive state" }], displayTypeface: "IBM Plex Mono, Consolas, monospace", bodyTypeface: "Arial, sans-serif" },
  { palette: [{ name: "Sun", hex: "#FFCB3D", role: "collection family" }, { name: "Iris", hex: "#7357FF", role: "selection" }, { name: "Leaf", hex: "#3BBD78", role: "filter family" }, { name: "Ink", hex: "#17131D", role: "type and outline" }], displayTypeface: "Arial Black, Arial, sans-serif", bodyTypeface: "Verdana, sans-serif" },
  { palette: [{ name: "Night", hex: "#151021", role: "environment" }, { name: "Pulse", hex: "#FF4FA1", role: "responsive object" }, { name: "Mist", hex: "#E9E2FF", role: "instruction" }, { name: "Volt", hex: "#C7FF45", role: "active handle" }], displayTypeface: "Century Gothic, sans-serif", bodyTypeface: "Arial, sans-serif" },
  { palette: [{ name: "Paper", hex: "#F4EBDD", role: "chapter field" }, { name: "Wine", hex: "#6E1839", role: "voice" }, { name: "Sky", hex: "#73B9DB", role: "turning point" }, { name: "Coal", hex: "#25211F", role: "caption" }], displayTypeface: "Georgia, serif", bodyTypeface: "Trebuchet MS, sans-serif" },
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

const HOUSE_STYLE_FINGERPRINTS: DesignDirectionFingerprint[] = [{
  directionId: "verve-house-editorial-register",
  topology: "editorial evidence register with a vertical rail numbered records and a dark closing folio",
  hierarchy: "large opening thesis indexed evidence rows terminal action panel",
  spatialRhythm: "split opening ruled numbered rows and one full width interruption",
  typographyRole: "oversized sans thesis with compact uppercase metadata and italic serif counterpoint",
  mediaStrategy: "one full width evidence image between document sections",
  interactionMetaphor: "inspect a numbered dossier",
  signatureMechanism: "vertical datum beside a twelve column opening",
  descriptors: {
    creativityClass: "combinational",
    experienceModel: "narrative-scroll",
    openingMode: "story-first",
    navigationModel: "linear",
    density: "airy",
    spatialSystem: "editorial register",
    mediaRole: "supporting",
    motionRole: "narrative",
    typographyVoice: "oversized sans with italic serif accent",
    colorStrategy: "monochrome with one bright accent",
  },
  structure: {
    topologyFamily: "editorial-register",
    openingMode: "split-opening",
    sectionRhythm: "numbered-rows",
    traits: ["dark-closing-panel", "editorial-rules", "full-width-interrupt", "numbered-index", "oversized-heading", "twelve-column-grid", "vertical-rail"],
  },
}];

function dimensionsText(value: Pick<DesignDirectionFingerprint, keyof DirectionDimensions>): string {
  return DIMENSION_KEYS.map((key) => value[key]).join("\n");
}

function structureOf(value: DesignDirectionFingerprint | DesignDirectionCandidate["dimensions"]) {
  return "structure" in value && value.structure
    ? value.structure
    : inferDesignStructure(dimensionsText(value));
}

function descriptorsOf(value: { descriptors?: DirectionDescriptors }, index = 0): DirectionDescriptors {
  return value.descriptors ?? DEFAULT_DESCRIPTOR_PORTFOLIO[index % DEFAULT_DESCRIPTOR_PORTFOLIO.length];
}

export function fingerprintDirection(candidate: DesignDirectionCandidate, deliveredCode?: string): DesignDirectionFingerprint {
  const described = inferDesignStructure(dimensionsText(candidate.dimensions));
  const structure = mergeDesignStructures(described, deliveredCode ? inferDesignStructure(deliveredCode) : undefined);
  return { directionId: candidate.id, ...candidate.dimensions, descriptors: candidate.descriptors, structure };
}

export function directionDistance(
  left: Pick<DesignDirectionFingerprint, keyof DirectionDimensions> & { descriptors?: DirectionDescriptors },
  right: Pick<DesignDirectionFingerprint, keyof DirectionDimensions> & { descriptors?: DirectionDescriptors }
): number {
  const semantic = DIMENSION_KEYS.reduce((sum, key) => sum + textDistance(left[key], right[key]), 0) / DIMENSION_KEYS.length;
  const structural = designStructureDistance(structureOf(left), structureOf(right));
  const a = descriptorsOf(left);
  const b = descriptorsOf(right);
  const descriptor = DESCRIPTOR_KEYS.reduce((sum, key) => sum + (a[key] === b[key] ? 0 : 1), 0) / DESCRIPTOR_KEYS.length;
  return Number((semantic * 0.25 + structural * 0.3 + descriptor * 0.45).toFixed(3));
}

function normalizeCandidate(candidate: DesignDirectionCandidate, index: number): DesignDirectionCandidate {
  const { estimatedLikelihood: _legacyLikelihood, ...currentCandidate } = candidate;
  void _legacyLikelihood;
  const briefFit = Math.max(0, Math.min(100, candidate.briefFit));
  const feasibility = Math.max(0, Math.min(100, candidate.feasibility));
  const descriptors = descriptorsOf(candidate, index);
  const quality = candidate.quality ?? {
    briefCoverage: briefFit,
    factualSafety: 88,
    responsiveFeasibility: feasibility,
    interactionTruth: feasibility,
    mediaFeasibility: feasibility,
    passed: briefFit >= 65 && feasibility >= 65,
  };
  const identity = candidate.identity ?? DEFAULT_IDENTITIES[index % DEFAULT_IDENTITIES.length];
  const passed = quality.briefCoverage >= 65
    && quality.factualSafety >= 70
    && quality.responsiveFeasibility >= 60
    && quality.interactionTruth >= 70
    && quality.mediaFeasibility >= 55;
  return {
    ...currentCandidate,
    id: candidate.id.trim() || `direction-${index + 1}`,
    briefFit,
    feasibility,
    descriptors,
    identity,
    quality: { ...quality, passed },
  };
}

function distanceValue(candidate: DesignDirectionCandidate) {
  return { ...candidate.dimensions, descriptors: candidate.descriptors };
}

function normalizePortfolio(portfolio: DirectionPortfolio): DirectionPortfolio {
  const candidates = portfolio.candidates.slice(0, 6).map(normalizeCandidate);
  const selectedDirectionId = candidates.some((candidate) => candidate.id === portfolio.selectedDirectionId)
    ? portfolio.selectedDirectionId
    : candidates[0]?.id ?? "direction-1";
  return { ...portfolio, candidates, selectedDirectionId };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function assessDirectionPortfolio(rawPortfolio: DirectionPortfolio, recentFingerprints: DesignDirectionFingerprint[] = []): DirectionDiversityAssessment {
  const portfolio = normalizePortfolio(rawPortfolio);
  const pairDistances: number[] = [];
  for (let left = 0; left < portfolio.candidates.length; left++) {
    for (let right = left + 1; right < portfolio.candidates.length; right++) {
      pairDistances.push(directionDistance(distanceValue(portfolio.candidates[left]), distanceValue(portfolio.candidates[right])));
    }
  }
  const medianPairDistance = Number(median(pairDistances).toFixed(3));
  const minimumPairDistance = Number((pairDistances.length ? Math.min(...pairDistances) : 0).toFixed(3));
  const diversityScore = Math.round(medianPairDistance * 100);
  const distinctStructureCount = new Set(portfolio.candidates.map(({ descriptors }) =>
    `${descriptors.experienceModel}/${descriptors.openingMode}/${descriptors.navigationModel}`
  )).size;

  const qualified = portfolio.candidates.filter((candidate) => candidate.quality.passed);
  const pool = qualified.length ? qualified : portfolio.candidates;
  const scored = pool.map((candidate) => {
    const fingerprint = fingerprintDirection(candidate);
    const archive = [...recentFingerprints, ...HOUSE_STYLE_FINGERPRINTS];
    const archiveNovelty = archive.length
      ? Math.min(...archive.map((previous) => directionDistance(fingerprint, previous)))
      : 1;
    const siblingNovelty = portfolio.candidates.length > 1
      ? Math.min(...portfolio.candidates.filter((other) => other.id !== candidate.id).map((other) => directionDistance(distanceValue(candidate), distanceValue(other))))
      : 0;
    return { candidate, archiveNovelty, siblingNovelty };
  }).sort((left, right) =>
    right.archiveNovelty - left.archiveNovelty
    || right.siblingNovelty - left.siblingNovelty
    || right.candidate.briefFit - left.candidate.briefFit
    || right.candidate.feasibility - left.candidate.feasibility
  );

  const selected = portfolio.candidates.find((candidate) => candidate.id === portfolio.selectedDirectionId);
  const historicalNoveltyScore = selected && recentFingerprints.length
    ? Math.round(Math.min(...recentFingerprints.map((previous) => directionDistance(distanceValue(selected), previous))) * 100)
    : null;
  const warnings: string[] = [];
  if (portfolio.candidates.length < 6) warnings.push("Direction Board contains fewer than six candidate interpretations.");
  if (distinctStructureCount < 5) warnings.push("Direction Board contains fewer than five distinct experience structures.");
  if (medianPairDistance < 0.55) warnings.push("Median direction distance is below the Creative Engine v3 diversity floor.");
  if (minimumPairDistance < 0.3) warnings.push("At least two directions are near-duplicates rather than meaningful alternatives.");
  if (selected && !selected.quality.passed) warnings.push("The selected direction does not pass the deterministic quality floor.");
  if (historicalNoveltyScore !== null && historicalNoveltyScore < 45) warnings.push("The selected direction is structurally close to a recent local result.");

  return {
    passed: warnings.length === 0,
    diversityScore,
    medianPairDistance,
    minimumPairDistance,
    distinctStructureCount,
    historicalNoveltyScore,
    recommendedDirectionId: scored[0]?.candidate.id ?? portfolio.selectedDirectionId,
    warnings,
  };
}

export function applySelectedDirection(plan: DesignPlan, directionId: string, rationale = "Selected from the Creative Engine direction board."): DesignPlan {
  const portfolio = plan.directionPortfolio ? normalizePortfolio(plan.directionPortfolio) : undefined;
  if (!portfolio) return plan;
  const selected = portfolio.candidates.find((candidate) => candidate.id === directionId);
  if (!selected) return plan;
  return {
    ...plan,
    colorPalette: selected.identity.palette.map((color) => ({ ...color })),
    typePairing: {
      display: selected.identity.displayTypeface,
      body: selected.identity.bodyTypeface,
      rationale: `${selected.descriptors.typographyVoice}. The pairing belongs to the selected direction rather than a previous provider choice.`,
    },
    layoutConcept: [
      `ENFORCED DIRECTION / SELECTED DIRECTION: ${selected.concept}`,
      `Experience model: ${selected.descriptors.experienceModel}`,
      `Opening: ${selected.descriptors.openingMode}`,
      `Navigation: ${selected.descriptors.navigationModel}`,
      `Topology: ${selected.dimensions.topology}`,
      `Hierarchy: ${selected.dimensions.hierarchy}`,
      `Spatial system: ${selected.descriptors.spatialSystem}`,
      `Rhythm: ${selected.dimensions.spatialRhythm}`,
      `Media: ${selected.dimensions.mediaStrategy}`,
      `Motion: ${selected.descriptors.motionRole}`,
      `Interaction: ${selected.dimensions.interactionMetaphor}`,
    ].join("\n"),
    signatureElement: {
      name: selected.concept.slice(0, 80),
      description: selected.distinction,
      implementation: selected.dimensions.signatureMechanism,
      justification: selected.justification,
    },
    cognitiveGrounding: {
      ...plan.cognitiveGrounding,
      vonRestorffCompliance: `The ${selected.dimensions.signatureMechanism} is the isolated recognition mechanism for this direction.`,
      gutenbergCompliance: `The ${selected.descriptors.openingMode} opening and ${selected.descriptors.navigationModel} navigation establish a brief-specific reading path.`,
      peakEndDesign: `Resolve the ${selected.descriptors.experienceModel} at the truthful completion of the primary job.`,
    },
    directionPortfolio: {
      ...portfolio,
      selectedDirectionId: selected.id,
      selectionRationale: rationale,
    },
  };
}

export function enforceRecommendedDirection(plan: DesignPlan, assessment: DirectionDiversityAssessment): DesignPlan {
  if (!plan.directionPortfolio || assessment.recommendedDirectionId === plan.directionPortfolio.selectedDirectionId) return plan;
  const recommended = plan.directionPortfolio.candidates.find((candidate) => candidate.id === assessment.recommendedDirectionId);
  return recommended
    ? applySelectedDirection(plan, recommended.id, `Verve selected the quality-qualified direction with the greatest archive novelty: ${recommended.justification}`)
    : plan;
}

function fallbackCandidate(
  index: number,
  analysis: BriefAnalysis,
  plan: DesignPlan,
  concept: string,
  topology: string,
  distinction: string,
  signature: string
): DesignDirectionCandidate {
  const descriptor = DEFAULT_DESCRIPTOR_PORTFOLIO[index];
  return normalizeCandidate({
    id: `direction-${descriptor.experienceModel}`,
    concept,
    justification: `Transforms ${analysis.primaryJob.toLowerCase()} into a ${descriptor.experienceModel} instead of wrapping it in a generic marketing sequence.`,
    distinction,
    briefFit: index === 0 ? 92 : 78 + ((index * 3) % 13),
    feasibility: descriptor.experienceModel === "live-canvas" ? 72 : 84,
    descriptors: descriptor,
    identity: DEFAULT_IDENTITIES[index],
    quality: { briefCoverage: index === 0 ? 92 : 80, factualSafety: 92, responsiveFeasibility: 82, interactionTruth: 86, mediaFeasibility: 78, passed: true },
    dimensions: {
      topology,
      hierarchy: `${descriptor.openingMode} prioritizes the primary job before contextual explanation`,
      spatialRhythm: descriptor.spatialSystem,
      typographyRole: descriptor.typographyVoice,
      mediaStrategy: `${descriptor.mediaRole} media with explicit truthful empty states`,
      interactionMetaphor: descriptor.navigationModel,
      signatureMechanism: signature,
    },
  }, index);
}

export function createFallbackDirectionPortfolio(plan: DesignPlan, analysis: BriefAnalysis): DirectionPortfolio {
  const subject = analysis.subject.replace(/\s+/g, " ").trim();
  const candidates = [
    fallbackCandidate(0, analysis, plan, `${subject} as a guided decision room`, "A sequence of consequential questions reveals only the evidence needed for the current decision.", "The experience is remembered as a conversation, not a page.", "A responsive decision trail that persists across steps"),
    fallbackCandidate(1, analysis, plan, `${subject} as an evidence atlas`, "Material is arranged on a navigable spatial field with anchored context and scale changes.", "Place and relationships become the information architecture.", "An annotated coordinate field tied to real content"),
    fallbackCandidate(2, analysis, plan, `${subject} as a working instrument`, "The core task lives in a persistent work surface with controllable states and evidence panels.", "Users do the job before reading the pitch.", "A live evidence surface that changes with task state"),
    fallbackCandidate(3, analysis, plan, `${subject} as a living collection`, "Items, cases, or services form a filterable collection with inspection states rather than stacked sections.", "Variety is organized through browsing behavior.", "A category field that visibly reorganizes the collection"),
    fallbackCandidate(4, analysis, plan, `${subject} as a manipulable canvas`, "One domain object can be directly manipulated to reveal consequences, comparisons, or choices.", "The central interaction carries the identity.", "A responsive domain object with visible cause and effect"),
    fallbackCandidate(5, analysis, plan, `${subject} as a changing documentary`, plan.layoutConcept || "An episodic story changes composition, scale, and color when the audience reaches each consequential state.", "The sequence changes visual language with the meaning, avoiding repeated panels.", plan.signatureElement.implementation || "A chapter transition derived from the subject matter"),
  ];
  const portfolio: DirectionPortfolio = {
    source: "local-fallback",
    candidates,
    selectedDirectionId: candidates[0].id,
    selectionRationale: "The first quality-qualified fallback direction is closest to the primary job; the selector may replace it using archive novelty.",
  };
  const assessment = assessDirectionPortfolio(portfolio);
  return { ...portfolio, selectedDirectionId: assessment.recommendedDirectionId };
}

export function normalizeDirectionPortfolio(portfolio: DirectionPortfolio): DirectionPortfolio {
  return normalizePortfolio(portfolio);
}
