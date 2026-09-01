export const VERVE_PROJECT_SPEC_VERSION = 2 as const;
export const VISUAL_NARRATIVE_VERSION = 1 as const;
export const ASSET_DIRECTION_VERSION = 1 as const;

export type VerveProjectFramework = "nextjs" | "react" | "html";
export type ComplexityProfile = "focused" | "balanced" | "systemic";
export type ExperienceModel = "narrative-scroll" | "spatial-map" | "task-workbench" | "guided-conversation" | "collection-browser" | "live-canvas";

export type ProjectIntentSpec = {
  subject: string;
  audience: string;
  primaryJob: string;
  tone: string;
  industry: string;
  constraints: string[];
};

export type ProjectFact = {
  id: string;
  value: string;
  source: "brief" | "brand-kit";
  mutable: boolean;
};

export type ExperienceRegionRole = "orientation" | "task" | "evidence" | "collection" | "comparison" | "story" | "action" | "support";

export type NarrativeRole = "hook" | "tension" | "discovery" | "proof" | "choice" | "payoff";
export type NarrativeStructure = "linear" | "branching" | "spatial" | "cyclical";
export type VisualMedium = "typography" | "photography" | "illustration" | "data" | "diagram" | "interface" | "spatial" | "generative";
export type VisualLayer = "type" | "media" | "data" | "shape" | "motion" | "interaction";
export type SceneInformationShape = "orientation-signal" | "record-browser" | "comparison-matrix" | "evidence-ledger" | "guided-decision" | "action-outcome";

export type AssetLicense = "user-owned" | "pexels-license" | "programmatic-original" | "not-applicable";
/** External-media need. `not-applicable` means the scene is fulfilled programmatically, not visually empty. */
export type AssetRequirement = "required" | "supporting" | "avoid" | "not-applicable";
export type AssetSourcePolicy = "approved-only" | "programmatic-only" | "approved-or-programmatic" | "no-visual-asset";
export type AssetNarrativeFunction = "orientation" | "material-context" | "exploration" | "evidence" | "comparison" | "state-feedback";

export type DirectedAsset = {
  id: string;
  url: string;
  alt: string;
  source: "owned" | "pexels";
  license: AssetLicense;
  credit: string;
  sourcePageUrl?: string;
};

export type SceneAssetDirection = {
  sceneId: string;
  requirement: AssetRequirement;
  narrativeFunction: AssetNarrativeFunction;
  expectedLayers: VisualLayer[];
  preferredMedium: VisualMedium;
  sourcePolicy: AssetSourcePolicy;
  selectedAssetIds: string[];
  framing: {
    scale: "environment" | "object" | "detail" | "interface";
    aspectRatio: "adaptive" | "3:2" | "4:3" | "1:1";
    focalAnchor: "center" | "leading" | "trailing" | "subject-led";
    cropBehavior: string;
  };
  visualPurpose: string;
  altIntent: string;
  fallback: string;
};

export type AssetDirectionContract = {
  version: typeof ASSET_DIRECTION_VERSION;
  catalog: DirectedAsset[];
  identityAssetIds: string[];
  sceneDirections: SceneAssetDirection[];
  unusedAssetIds: string[];
  globalRules: string[];
};

export type StoryScene = {
  id: string;
  routeId: string;
  narrativeRole: NarrativeRole;
  regionRole: ExperienceRegionRole;
  audienceQuestion: string;
  purpose: string;
  focalObject: string;
  evidence: string[];
  /** Exact references into briefEvidence; absent on older ProjectSpec v2 checkpoints. */
  evidenceIds?: string[];
  informationShape?: SceneInformationShape;
  action?: string;
  visibleConsequence?: string;
  medium: VisualMedium;
  nextSceneIds: string[];
};

export type ArtDirectionContract = {
  compositionGrammar: string;
  materialVocabulary: string[];
  imageLanguage: string;
  typographyVoice: string;
  motionChoreography: string;
  interactionMetaphor: string;
  detailDensity: "restrained" | "layered" | "immersive";
  forbiddenFallbacks: string[];
};

export type VisualRichnessBudget = {
  strategy: "global-clarity-local-detail";
  targetSceneCount: number;
  minimumFunctionalLayers: number;
  requiredLayers: VisualLayer[];
  minimumMeaningfulStates: number;
  maximumSimultaneousFocalPoints: number;
  rationale: string;
};

export type VisualNarrativeContract = {
  version: typeof VISUAL_NARRATIVE_VERSION;
  thesis: string;
  emotionalTension: string;
  structure: NarrativeStructure;
  scenes: StoryScene[];
  artDirection: ArtDirectionContract;
  richness: VisualRichnessBudget;
};

export type ExperienceRegion = {
  id: string;
  routeId: string;
  parentId?: string;
  role: ExperienceRegionRole;
  purpose: string;
  layoutRole: "anchor" | "primary" | "secondary" | "overlay" | "transition";
  componentIds: string[];
};

/** Compatibility alias for extensions built against ProjectSpec v1. */
export type ExperienceSection = ExperienceRegion;

export type ExperienceRoute = {
  id: string;
  path: string;
  purpose: string;
  regionIds: string[];
};

export type ProjectComponentKind = "navigation" | "section" | "content" | "media" | "action" | "form" | "data" | "canvas" | "control";

export type ProjectComponentSpec = {
  id: string;
  routeId: string;
  regionId: string;
  /** Compatibility field; equal to regionId. */
  sectionId: string;
  kind: ProjectComponentKind;
  responsibility: string;
  children: string[];
};

export type InteractionImplementation = "navigation" | "local-state" | "external-link" | "form-adapter" | "direct-manipulation" | "filter";

export type InteractionState = {
  id: string;
  label: string;
  description: string;
};

export type InteractionContract = {
  id: string;
  componentId: string;
  trigger: string;
  outcome: string;
  implementation: InteractionImplementation;
  requiresExternalAdapter: boolean;
  states: InteractionState[];
};

export type ResponsiveViewportContract = {
  width: 360 | 768 | 1440;
  label: "mobile" | "tablet" | "desktop";
  requirements: string[];
  composition: string;
};

export type FirstViewportSignal = "primary-object" | "decision-evidence" | "primary-action";

/** A functional opening contract that deliberately makes no claim about visual scale. */
export type FirstViewportContract = {
  policyVersion: 1;
  policy: "task-bearing-opening";
  presentation: "any-scale";
  requiredSignals: FirstViewportSignal[];
  minimumTaskSignals: number;
  primaryAction: string;
  maximumActionDistanceViewports: number;
  rationale: string;
};

export type VerveProjectSpec = {
  schemaVersion: typeof VERVE_PROJECT_SPEC_VERSION;
  framework: VerveProjectFramework;
  intent: ProjectIntentSpec;
  complexity: {
    profile: ComplexityProfile;
    reason: string;
    maxRoutes: number;
    maxSourceFiles: number;
  };
  facts: {
    policy: "brief-is-source-of-truth";
    items: ProjectFact[];
  };
  /** Deterministic, source-bound content inventory; absent on older ProjectSpec v2 checkpoints. */
  briefEvidence?: import("./brief-evidence").BriefEvidenceContract;
  narrative: VisualNarrativeContract;
  assetDirection: AssetDirectionContract;
  /** Added compatibly in ProjectSpec v2; older checkpoints may omit it. */
  typographyContract?: import("./typography").TypographyContract;
  experience: {
    model: ExperienceModel;
    route: string;
    firstViewport: FirstViewportContract;
    sections: ExperienceRegion[];
    routes: ExperienceRoute[];
    regions: ExperienceRegion[];
  };
  components: ProjectComponentSpec[];
  interactions: InteractionContract[];
  responsive: {
    viewports: ResponsiveViewportContract[];
    reducedMotionRequired: true;
  };
  visualSystem: {
    colors: { name: string; hex: string; role: string }[];
    typography: { display: string; body: string; rationale: string };
    signature: { name: string; mechanism: string; justification: string };
    depth: {
      surfaceLayers: number;
      mediaLayer: boolean;
      shapeLayer: boolean;
      motionLayer: boolean;
      dataLayer: boolean;
      rationale: string;
    };
    variationAxes: string[];
  };
  media: {
    policy: "required" | "recommended" | "optional" | "avoid";
    minimumAssets: number;
    approvedAssetPaths: string[];
  };
  brand: {
    invariants: string[];
    noveltyLevers: string[];
  };
};

export type ProjectSpecValidation = { valid: boolean; issues: string[] };

export function validateVisualNarrativeContract(contract: VisualNarrativeContract): string[] {
  const issues: string[] = [];
  const sceneIds = new Set(contract.scenes.map((scene) => scene.id));
  if (contract.version !== VISUAL_NARRATIVE_VERSION) issues.push("Unsupported visual narrative version.");
  if (contract.scenes.length < 3) issues.push("The visual narrative requires at least three purposeful scenes.");
  if (sceneIds.size !== contract.scenes.length) issues.push("Story scene IDs must be unique.");
  if (!contract.scenes.some((scene) => scene.narrativeRole === "payoff")) issues.push("The visual narrative requires a payoff scene.");
  if (contract.richness.targetSceneCount !== contract.scenes.length) issues.push("The richness budget must match the authored scene count.");
  if (contract.richness.minimumFunctionalLayers < 2) issues.push("Visual richness requires at least two functional layers.");
  if (new Set(contract.richness.requiredLayers).size !== contract.richness.requiredLayers.length) issues.push("Required visual layers must be unique.");
  if (!contract.richness.requiredLayers.includes("type") || !contract.richness.requiredLayers.includes("interaction")) issues.push("Type and interaction are mandatory functional layers.");
  if (contract.artDirection.forbiddenFallbacks.length < 2) issues.push("Art direction must name at least two forbidden generic fallbacks.");
  for (const scene of contract.scenes) {
    if (!scene.audienceQuestion.trim()) issues.push(`${scene.id} has no audience question.`);
    if (!scene.purpose.trim()) issues.push(`${scene.id} has no narrative purpose.`);
    if (!scene.focalObject.trim()) issues.push(`${scene.id} has no focal object.`);
    if (scene.narrativeRole === "payoff" && (!scene.action || !scene.visibleConsequence)) issues.push(`${scene.id} must declare a truthful action and visible consequence.`);
    for (const nextId of scene.nextSceneIds) if (!sceneIds.has(nextId)) issues.push(`${scene.id} references unknown scene ${nextId}.`);
  }
  return issues;
}

export function validateAssetDirectionContract(contract: AssetDirectionContract, narrative: VisualNarrativeContract): string[] {
  const issues: string[] = [];
  const sceneIds = new Set(narrative.scenes.map((scene) => scene.id));
  const directedSceneIds = new Set(contract.sceneDirections.map((direction) => direction.sceneId));
  const assetIds = new Set(contract.catalog.map((asset) => asset.id));
  if (contract.version !== ASSET_DIRECTION_VERSION) issues.push("Unsupported asset direction version.");
  if (directedSceneIds.size !== contract.sceneDirections.length) issues.push("Scene asset directions must be unique.");
  if (contract.sceneDirections.length !== narrative.scenes.length) issues.push("Every story scene requires one asset direction.");
  for (const sceneId of sceneIds) if (!directedSceneIds.has(sceneId)) issues.push(`${sceneId} has no asset direction.`);
  for (const asset of contract.catalog) {
    if (!asset.url.trim()) issues.push(`${asset.id} has no approved asset URL.`);
    if (asset.license === "not-applicable" || asset.license === "programmatic-original") issues.push(`${asset.id} has no external-asset license record.`);
    if (!asset.credit.trim()) issues.push(`${asset.id} has no ownership or attribution record.`);
  }
  for (const direction of contract.sceneDirections) {
    if (!sceneIds.has(direction.sceneId)) issues.push(`Asset direction references unknown scene ${direction.sceneId}.`);
    if (!direction.expectedLayers.includes("type")) issues.push(`${direction.sceneId} must preserve the type layer.`);
    if (new Set(direction.expectedLayers).size !== direction.expectedLayers.length) issues.push(`${direction.sceneId} repeats an expected visual layer.`);
    if (!direction.visualPurpose.trim()) issues.push(`${direction.sceneId} has no visual purpose.`);
    for (const assetId of direction.selectedAssetIds) if (!assetIds.has(assetId)) issues.push(`${direction.sceneId} references unknown asset ${assetId}.`);
    if (direction.sourcePolicy === "programmatic-only" && direction.selectedAssetIds.length > 0) issues.push(`${direction.sceneId} assigns an external asset to a programmatic-only scene.`);
    if (direction.requirement === "avoid" && direction.selectedAssetIds.length > 0) issues.push(`${direction.sceneId} assigns media even though its asset requirement is avoid.`);
  }
  for (const assetId of [...contract.identityAssetIds, ...contract.unusedAssetIds]) if (!assetIds.has(assetId)) issues.push(`Asset direction references unknown catalog asset ${assetId}.`);
  return issues;
}

export function validateVerveProjectSpec(spec: VerveProjectSpec): ProjectSpecValidation {
  const issues: string[] = [];
  const routeIds = new Set(spec.experience.routes.map((route) => route.id));
  const regionIds = new Set(spec.experience.regions.map((region) => region.id));
  const componentIds = new Set(spec.components.map((component) => component.id));

  if (spec.schemaVersion !== VERVE_PROJECT_SPEC_VERSION) issues.push("Unsupported project specification version.");
  if (spec.experience.routes.length < 1 || spec.experience.routes.length > spec.complexity.maxRoutes) issues.push("Route count exceeds the complexity budget.");
  if (spec.experience.regions.length < 3) issues.push("The experience graph requires at least three purposeful regions.");
  if (routeIds.size !== spec.experience.routes.length) issues.push("Experience route IDs must be unique.");
  if (regionIds.size !== spec.experience.regions.length) issues.push("Experience region IDs must be unique.");
  if (componentIds.size !== spec.components.length) issues.push("Component IDs must be unique.");
  if (spec.briefEvidence) {
    if (spec.briefEvidence.version !== 1 || spec.briefEvidence.sourcePolicy !== "verbatim-brief-spans-only") issues.push("Unsupported brief evidence contract.");
    const evidenceIds = new Set(spec.briefEvidence.items.map((item) => item.id));
    if (evidenceIds.size !== spec.briefEvidence.items.length) issues.push("Brief evidence item IDs must be unique.");
    for (const record of spec.briefEvidence.records) if (!evidenceIds.has(record.evidenceId)) issues.push(`${record.id} references unknown brief evidence.`);
    for (const dimension of spec.briefEvidence.comparisonDimensions) if (!evidenceIds.has(dimension.evidenceId)) issues.push(`${dimension.id} references unknown brief evidence.`);
    for (const pattern of spec.briefEvidence.prohibitedPatterns) if (!evidenceIds.has(pattern.evidenceId)) issues.push(`${pattern.id} references unknown brief evidence.`);
    for (const scene of spec.narrative.scenes) for (const evidenceId of scene.evidenceIds ?? []) if (!evidenceIds.has(evidenceId)) issues.push(`${scene.id} references unknown brief evidence ${evidenceId}.`);
  }
  if (spec.visualSystem.colors.length < 3) issues.push("The visual system requires at least three color tokens.");
  if (spec.typographyContract) {
    if (spec.typographyContract.version !== 1) issues.push("Unsupported typography contract version.");
    if (spec.typographyContract.files.length < 1) issues.push("The typography contract requires at least one bundled font file.");
    const fileIds = new Set(spec.typographyContract.files.map((file) => file.id));
    for (const assignment of [spec.typographyContract.display, spec.typographyContract.body, spec.typographyContract.mono].filter(Boolean)) {
      for (const fileId of assignment!.fileIds) if (!fileIds.has(fileId)) issues.push(`Typography assignment references unknown file ${fileId}.`);
    }
  }
  if (spec.visualSystem.depth.surfaceLayers < 1) issues.push("The visual depth contract requires at least one surface layer.");
  if (spec.experience.firstViewport.policy !== "task-bearing-opening") issues.push("The first viewport must use the task-bearing opening policy.");
  if (spec.experience.firstViewport.presentation !== "any-scale") issues.push("The first viewport must not prohibit a composition solely because of its scale.");
  if (spec.experience.firstViewport.minimumTaskSignals < 2) issues.push("The first viewport requires at least two task signals.");
  if (!spec.experience.firstViewport.requiredSignals.includes("primary-action")) issues.push("The first viewport must declare a primary action signal.");
  issues.push(...validateVisualNarrativeContract(spec.narrative));
  issues.push(...validateAssetDirectionContract(spec.assetDirection, spec.narrative));

  const narrativeRouteIds = new Set(spec.narrative.scenes.map((scene) => scene.routeId));
  for (const routeId of narrativeRouteIds) if (!routeIds.has(routeId)) issues.push(`Visual narrative references unknown route ${routeId}.`);
  for (const region of spec.experience.regions) {
    if (!spec.narrative.scenes.some((scene) => scene.id === region.id)) issues.push(`${region.id} has no corresponding story scene.`);
  }

  for (const route of spec.experience.routes) {
    if (!route.path.startsWith("/")) issues.push(`${route.id} must use an absolute route path.`);
    if (route.regionIds.length === 0) issues.push(`${route.id} has no purposeful regions.`);
    for (const regionId of route.regionIds) if (!regionIds.has(regionId)) issues.push(`${route.id} references unknown region ${regionId}.`);
  }
  for (const region of spec.experience.regions) {
    if (!routeIds.has(region.routeId)) issues.push(`${region.id} references unknown route ${region.routeId}.`);
    if (region.parentId && !regionIds.has(region.parentId)) issues.push(`${region.id} references unknown parent ${region.parentId}.`);
    if (!region.purpose.trim()) issues.push(`${region.id} has no purpose.`);
    for (const componentId of region.componentIds) if (!componentIds.has(componentId)) issues.push(`${region.id} references unknown component ${componentId}.`);
  }
  for (const component of spec.components) {
    if (!routeIds.has(component.routeId)) issues.push(`${component.id} references unknown route ${component.routeId}.`);
    if (!regionIds.has(component.regionId)) issues.push(`${component.id} references unknown region ${component.regionId}.`);
    for (const childId of component.children) if (!componentIds.has(childId)) issues.push(`${component.id} references unknown child ${childId}.`);
  }
  for (const interaction of spec.interactions) {
    if (!componentIds.has(interaction.componentId)) issues.push(`${interaction.id} references unknown component ${interaction.componentId}.`);
    if (interaction.implementation === "form-adapter" && !interaction.requiresExternalAdapter) issues.push(`${interaction.id} must disclose its external form adapter requirement.`);
    if (interaction.states.length < 2) issues.push(`${interaction.id} must document initial and outcome states.`);
  }
  const meaningfulStateCount = spec.interactions.reduce((sum, interaction) => sum + interaction.states.length, 0);
  if (meaningfulStateCount < spec.narrative.richness.minimumMeaningfulStates) issues.push("Interaction states do not meet the visual richness budget.");
  const widths = new Set(spec.responsive.viewports.map((viewport) => viewport.width));
  for (const width of [360, 768, 1440] as const) if (!widths.has(width)) issues.push(`Responsive evidence is missing the ${width}px viewport contract.`);
  return { valid: issues.length === 0, issues };
}
