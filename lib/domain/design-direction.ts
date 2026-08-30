export const CREATIVITY_CLASSES = ["combinational", "exploratory", "transformational"] as const;
export type CreativityClass = (typeof CREATIVITY_CLASSES)[number];

export const EXPERIENCE_MODELS = [
  "narrative-scroll",
  "spatial-map",
  "task-workbench",
  "guided-conversation",
  "collection-browser",
  "live-canvas",
] as const;
export type ExperienceModel = (typeof EXPERIENCE_MODELS)[number];

export const OPENING_MODES = [
  "task-first",
  "media-first",
  "index-first",
  "question-first",
  "canvas-first",
  "story-first",
] as const;
export type DirectionOpeningMode = (typeof OPENING_MODES)[number];

export const NAVIGATION_MODELS = [
  "linear",
  "hub-and-spoke",
  "filter-and-inspect",
  "stepper",
  "spatial",
  "direct-manipulation",
] as const;
export type NavigationModel = (typeof NAVIGATION_MODELS)[number];

export type DirectionDescriptors = {
  creativityClass: CreativityClass;
  experienceModel: ExperienceModel;
  openingMode: DirectionOpeningMode;
  navigationModel: NavigationModel;
  density: "airy" | "balanced" | "dense";
  spatialSystem: string;
  mediaRole: "none" | "supporting" | "evidence" | "primary" | "interactive";
  motionRole: "none" | "feedback" | "narrative" | "spatial" | "data";
  typographyVoice: string;
  colorStrategy: string;
};

export type DirectionDimensions = {
  topology: string;
  hierarchy: string;
  spatialRhythm: string;
  typographyRole: string;
  mediaStrategy: string;
  interactionMetaphor: string;
  signatureMechanism: string;
};

export type DirectionQualityFloor = {
  briefCoverage: number;
  factualSafety: number;
  responsiveFeasibility: number;
  interactionTruth: number;
  mediaFeasibility: number;
  passed: boolean;
};

export type DesignStructureFingerprint = {
  topologyFamily:
    | "editorial-register"
    | "workbench"
    | "dashboard"
    | "timeline"
    | "comparison"
    | "spatial-canvas"
    | "catalog"
    | "form-led"
    | "narrative"
    | "unknown";
  openingMode: "viewport-hero" | "split-opening" | "compact-task" | "unknown";
  sectionRhythm: "viewport-stages" | "numbered-rows" | "panel-grid" | "mixed" | "unknown";
  traits: string[];
};

export type DesignDirectionCandidate = {
  id: string;
  concept: string;
  justification: string;
  distinction: string;
  briefFit: number;
  feasibility: number;
  /** @deprecated Retained only when reading v2 checkpoints. Never used by selection. */
  estimatedLikelihood?: number;
  descriptors: DirectionDescriptors;
  identity: {
    palette: { name: string; hex: string; role: string }[];
    displayTypeface: string;
    bodyTypeface: string;
  };
  quality: DirectionQualityFloor;
  dimensions: DirectionDimensions;
};

export type DirectionPortfolio = {
  source: "provider" | "provider-creative" | "local-fallback";
  candidates: DesignDirectionCandidate[];
  selectedDirectionId: string;
  selectionRationale: string;
};

export type DesignDirectionFingerprint = DirectionDimensions & {
  directionId: string;
  descriptors?: DirectionDescriptors;
  structure?: DesignStructureFingerprint;
};

export type DirectionDiversityAssessment = {
  passed: boolean;
  diversityScore: number;
  medianPairDistance: number;
  minimumPairDistance: number;
  distinctStructureCount: number;
  historicalNoveltyScore: number | null;
  recommendedDirectionId: string;
  warnings: string[];
};

export type DirectionBoard = {
  schemaVersion: 1;
  engineVersion: "creative-engine-v3";
  inputHash: string;
  requestedMode: "fast" | "creative" | "studio";
  effectiveMode: "fast" | "creative";
  portfolio: DirectionPortfolio;
  diversity: DirectionDiversityAssessment;
  referencePatternIds: string[];
  createdAt: string;
};

export type DirectionCheckpoint = {
  schemaVersion: 1;
  inputHash: string;
  board: DirectionBoard;
};
