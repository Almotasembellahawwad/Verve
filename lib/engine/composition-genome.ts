import {
  COMPOSITION_GENOME_VERSION,
  type CompositionContinuity,
  type CompositionDensity,
  type CompositionGenes,
  type CompositionGenomeContract,
  type CompositionMobileTransform,
  type CompositionStructure,
  type ExperienceModel,
  type SceneInformationShape,
  type StoryScene,
  type VisualMedium,
} from "../domain/project-spec";

export const COMPOSITION_AXIS_WEIGHTS: CompositionGenomeContract["axisWeights"] = {
  structure: 0.28,
  focalPosition: 0.16,
  flow: 0.14,
  overlap: 0.1,
  depth: 0.12,
  density: 0.08,
  mediaFrame: 0.12,
};

const BASE_GENES: Record<CompositionStructure, CompositionGenes> = {
  "single-object-stage": { structure: "single-object-stage", focalPosition: "center", flow: "vertical", overlap: "none", depth: "layered", density: "sparse", mediaFrame: "inset" },
  "split-stage": { structure: "split-stage", focalPosition: "leading", flow: "horizontal", overlap: "contained", depth: "layered", density: "balanced", mediaFrame: "full-bleed" },
  "rail-canvas": { structure: "rail-canvas", focalPosition: "trailing", flow: "horizontal", overlap: "none", depth: "flat", density: "dense", mediaFrame: "strip" },
  "layered-field": { structure: "layered-field", focalPosition: "edge", flow: "freeform", overlap: "cross-boundary", depth: "immersive", density: "balanced", mediaFrame: "fragmented" },
  "modular-matrix": { structure: "modular-matrix", focalPosition: "distributed", flow: "alternating", overlap: "none", depth: "flat", density: "dense", mediaFrame: "inset" },
  "radial-map": { structure: "radial-map", focalPosition: "center", flow: "radial", overlap: "contained", depth: "immersive", density: "balanced", mediaFrame: "constellation" },
  "editorial-spine": { structure: "editorial-spine", focalPosition: "leading", flow: "vertical", overlap: "cross-boundary", depth: "layered", density: "balanced", mediaFrame: "strip" },
  "mosaic-browser": { structure: "mosaic-browser", focalPosition: "distributed", flow: "freeform", overlap: "contained", depth: "layered", density: "dense", mediaFrame: "fragmented" },
};

const MODEL_AFFINITY: Record<ExperienceModel, CompositionStructure[]> = {
  "narrative-scroll": ["editorial-spine", "layered-field", "single-object-stage", "split-stage"],
  "spatial-map": ["radial-map", "layered-field", "rail-canvas", "mosaic-browser"],
  "task-workbench": ["rail-canvas", "modular-matrix", "split-stage", "editorial-spine"],
  "guided-conversation": ["split-stage", "rail-canvas", "single-object-stage", "layered-field"],
  "collection-browser": ["mosaic-browser", "modular-matrix", "radial-map", "rail-canvas"],
  "live-canvas": ["layered-field", "radial-map", "rail-canvas", "single-object-stage"],
};

const SHAPE_AFFINITY: Record<SceneInformationShape, CompositionStructure[]> = {
  "orientation-signal": ["single-object-stage", "split-stage", "layered-field", "editorial-spine"],
  "record-browser": ["mosaic-browser", "rail-canvas", "modular-matrix", "radial-map"],
  "comparison-matrix": ["modular-matrix", "rail-canvas", "split-stage", "editorial-spine"],
  "evidence-ledger": ["editorial-spine", "rail-canvas", "modular-matrix", "split-stage"],
  "guided-decision": ["rail-canvas", "split-stage", "radial-map", "single-object-stage"],
  "action-outcome": ["single-object-stage", "layered-field", "split-stage", "radial-map"],
};

const MEDIUM_AFFINITY: Record<VisualMedium, CompositionStructure[]> = {
  typography: ["editorial-spine", "single-object-stage", "layered-field"],
  photography: ["split-stage", "mosaic-browser", "layered-field"],
  illustration: ["layered-field", "split-stage", "single-object-stage"],
  data: ["modular-matrix", "rail-canvas", "editorial-spine"],
  diagram: ["radial-map", "rail-canvas", "modular-matrix"],
  interface: ["rail-canvas", "split-stage", "modular-matrix"],
  spatial: ["radial-map", "layered-field", "rail-canvas"],
  generative: ["layered-field", "radial-map", "single-object-stage"],
};

const STRUCTURES = Object.keys(BASE_GENES) as CompositionStructure[];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function compositionGenomeDistance(left: CompositionGenes, right: CompositionGenes): number {
  const axes = Object.keys(COMPOSITION_AXIS_WEIGHTS) as (keyof CompositionGenes)[];
  const distance = axes.reduce((sum, axis) => sum + (left[axis] === right[axis] ? 0 : COMPOSITION_AXIS_WEIGHTS[axis]), 0);
  return Number(Math.min(1, distance).toFixed(3));
}

export type CompositionGenomeRealization = {
  passed: boolean;
  coverage: number;
  expected: number;
  marked: number;
  issues: string[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagCarriesGenome(tag: string, sceneId: string, genes: CompositionGenes): boolean {
  const exact = (name: string, value: string) => new RegExp(`${escapeRegExp(name)}\\s*=\\s*["']${escapeRegExp(value)}["']`, "i").test(tag);
  return exact("data-verve-scene", sceneId)
    && exact("data-verve-composition", genes.structure)
    && exact("data-verve-flow", genes.flow)
    && exact("data-verve-depth", genes.depth);
}

export function inspectCompositionGenomeSource(code: string, contract?: CompositionGenomeContract): CompositionGenomeRealization {
  if (!contract) return { passed: true, coverage: 1, expected: 0, marked: 0, issues: [] };
  const tags = code.match(/<[a-z][^>]{0,2000}>/gi) ?? [];
  const missing = contract.assignments.filter((assignment) => !tags.some((tag) => tagCarriesGenome(tag, assignment.sceneId, assignment.genes)));
  const marked = contract.assignments.length - missing.length;
  const coverage = contract.assignments.length ? marked / contract.assignments.length : 1;
  const issues = missing.length === 0
    ? []
    : [`Composition Genome Gate: ${marked}/${contract.assignments.length} scene roots carry their exact genes on the same element. Missing assignments: ${missing.map((assignment) => `${assignment.sceneId} => ${assignment.genes.structure} / ${assignment.genes.flow} / ${assignment.genes.depth}`).join("; ")}`];
  return { passed: issues.length === 0, coverage: Number(coverage.toFixed(3)), expected: contract.assignments.length, marked, issues };
}

function rankScore(structure: CompositionStructure, preferences: CompositionStructure[]): number {
  const index = preferences.indexOf(structure);
  return index < 0 ? 0 : (preferences.length - index) / preferences.length;
}

function fitScore(structure: CompositionStructure, scene: StoryScene, model: ExperienceModel): number {
  const shape = scene.informationShape ?? "orientation-signal";
  return rankScore(structure, MODEL_AFFINITY[model]) * 0.34
    + rankScore(structure, SHAPE_AFFINITY[shape]) * 0.4
    + rankScore(structure, MEDIUM_AFFINITY[scene.medium]) * 0.26;
}

function withDensity(genes: CompositionGenes, density: CompositionDensity, scene: StoryScene, index: number): CompositionGenes {
  const expressiveDepth = ["photography", "illustration", "spatial", "generative"].includes(scene.medium);
  return {
    ...genes,
    density: scene.narrativeRole === "payoff" ? "sparse" : density,
    depth: expressiveDepth && genes.depth === "flat" ? "layered" : genes.depth,
    focalPosition: index % 2 === 1 && genes.focalPosition === "leading" ? "trailing" : genes.focalPosition,
  };
}

function continuityFor(scene: StoryScene): CompositionContinuity {
  if (scene.narrativeRole === "payoff") return "resolve";
  if (scene.narrativeRole === "hook" || scene.narrativeRole === "tension") return "escalate";
  return scene.narrativeRole === "proof" ? "echo" : "contrast";
}

function mobileTransformFor(structure: CompositionStructure): CompositionMobileTransform {
  if (structure === "rail-canvas" || structure === "modular-matrix") return "focus-and-drawer";
  if (structure === "radial-map") return "pan-and-focus";
  if (structure === "layered-field" || structure === "editorial-spine") return "stacked-overlap-preserved";
  if (structure === "mosaic-browser") return "sequenced-cards";
  return "single-column-reorder";
}

function pairDistances(assignments: CompositionGenomeContract["assignments"]): number[] {
  const distances: number[] = [];
  for (let left = 0; left < assignments.length; left++) {
    for (let right = left + 1; right < assignments.length; right++) distances.push(compositionGenomeDistance(assignments[left].genes, assignments[right].genes));
  }
  return distances;
}

export function buildCompositionGenome(input: {
  scenes: StoryScene[];
  model: ExperienceModel;
  density: CompositionDensity;
  seed: string;
}): CompositionGenomeContract {
  const assignments: CompositionGenomeContract["assignments"] = [];
  const previousByRoute = new Map<string, CompositionGenomeContract["assignments"][number]>();

  input.scenes.forEach((scene, index) => {
    const candidates = STRUCTURES.map((structure) => {
      const genes = withDensity(BASE_GENES[structure], input.density, scene, index);
      const routePrevious = previousByRoute.get(scene.routeId);
      const priorDistances = assignments.map((assignment) => compositionGenomeDistance(genes, assignment.genes));
      const diversity = priorDistances.length ? Math.min(...priorDistances) : 1;
      const adjacentDistance = routePrevious ? compositionGenomeDistance(genes, routePrevious.genes) : 1;
      const stableJitter = (stableHash(`${input.seed}:${scene.id}:${structure}`) % 1000) / 1000;
      const score = fitScore(structure, scene, input.model) * 0.6 + Math.min(diversity, adjacentDistance) * 0.37 + stableJitter * 0.03;
      return { structure, genes, score, adjacentDistance };
    });
    const diverseCandidates = candidates.filter((candidate) => candidate.adjacentDistance >= 0.3);
    const viableCandidates = diverseCandidates.length ? diverseCandidates : candidates;
    const requiredStructuralBreadth = Math.min(3, input.scenes.length);
    const usedStructures = new Set(assignments.map((assignment) => assignment.genes.structure));
    const breadthCandidates = usedStructures.size < requiredStructuralBreadth
      ? viableCandidates.filter((candidate) => !usedStructures.has(candidate.structure))
      : viableCandidates;
    const selected = (breadthCandidates.length ? breadthCandidates : viableCandidates).sort((left, right) => right.score - left.score || left.structure.localeCompare(right.structure))[0];
    const previous = previousByRoute.get(scene.routeId);
    const assignment = {
      sceneId: scene.id,
      genes: selected.genes,
      continuity: continuityFor(scene),
      mobileTransform: mobileTransformFor(selected.structure),
      distanceFromPrevious: previous ? compositionGenomeDistance(previous.genes, selected.genes) : null,
      rationale: `${scene.informationShape ?? "orientation-signal"} in a ${input.model} experience uses ${selected.structure}; ${continuityFor(scene)} continuity preserves the story while changing spatial expression.`,
    } as const;
    assignments.push(assignment);
    previousByRoute.set(scene.routeId, assignment);
  });

  const pairwise = pairDistances(assignments);
  const adjacent = assignments.flatMap((assignment) => assignment.distanceFromPrevious === null ? [] : [assignment.distanceFromPrevious]);
  return {
    version: COMPOSITION_GENOME_VERSION,
    selectionPolicy: "fitness-constrained-maximin",
    axisWeights: { ...COMPOSITION_AXIS_WEIGHTS },
    assignments,
    distinctStructures: new Set(assignments.map((assignment) => assignment.genes.structure)).size,
    minimumAdjacentDistance: Number((adjacent.length ? Math.min(...adjacent) : 1).toFixed(3)),
    meanPairDistance: Number((pairwise.length ? pairwise.reduce((sum, value) => sum + value, 0) / pairwise.length : 1).toFixed(3)),
  };
}
