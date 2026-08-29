export type DirectionDimensions = {
  topology: string;
  hierarchy: string;
  spatialRhythm: string;
  typographyRole: string;
  mediaStrategy: string;
  interactionMetaphor: string;
  signatureMechanism: string;
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
  estimatedLikelihood: number;
  dimensions: DirectionDimensions;
};

export type DirectionPortfolio = {
  source: "provider" | "local-fallback";
  candidates: DesignDirectionCandidate[];
  selectedDirectionId: string;
  selectionRationale: string;
};

export type DesignDirectionFingerprint = DirectionDimensions & {
  directionId: string;
  structure?: DesignStructureFingerprint;
};

export type DirectionDiversityAssessment = {
  passed: boolean;
  diversityScore: number;
  historicalNoveltyScore: number | null;
  recommendedDirectionId: string;
  warnings: string[];
};
