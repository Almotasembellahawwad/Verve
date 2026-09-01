import type {
  ComplexityProfile,
  ExperienceModel,
  ExperienceRegionRole,
  NarrativeRole,
  NarrativeStructure,
  SceneInformationShape,
  StoryScene,
  VisualLayer,
  VisualMedium,
  VisualNarrativeContract,
} from "../domain/project-spec";
import { VISUAL_NARRATIVE_VERSION } from "../domain/project-spec";
import type { BriefEvidenceContract, BriefEvidenceItem } from "../domain/brief-evidence";
import type { BriefAnalysis } from "./brief-analyzer";
import type { AssetBundle } from "./asset-sourcer";
import type { DesignPlan } from "./plan-generator";
import { buildCompositionGenome } from "./composition-genome";

export type NarrativeRouteBlueprint = {
  id: string;
  path: string;
  purpose: string;
  sceneKind: "primary" | "comparison" | "collection" | "evidence" | "workflow" | "action";
};

type BriefSignals = {
  comparison: boolean;
  collection: boolean;
  evidence: boolean;
  workflow: boolean;
  action: boolean;
  spatial: boolean;
  expressive: boolean;
};

function briefText(analysis: BriefAnalysis): string {
  return `${analysis.subject} ${analysis.audience} ${analysis.primaryJob} ${analysis.tone} ${analysis.industry} ${analysis.constraints.join(" ")} ${analysis.rawBrief}`;
}

function detectSignals(analysis: BriefAnalysis): BriefSignals {
  const text = briefText(analysis);
  return {
    comparison: /compare|comparison|versus|spec(?:ification)?s?|price|weight|binding|batch|choose|decision|مقارن|مواصف|سعر|وزن|تجليد|اختيار/i.test(text),
    collection: /collection|catalog|portfolio|library|products?|cases?|projects?|browse|inventory|مجموعة|كتالوج|منتجات|أعمال|تصفح|مخزون/i.test(text),
    evidence: /evidence|proof|data|results?|method|material|provenance|research|verified|spec(?:ification)?s?|دليل|بيانات|نتائج|منهج|مواد|موثق|مواصف/i.test(text),
    workflow: /workflow|process|journey|step|operations?|manage|monitor|dashboard|workspace|learn|how it works|عملية|رحلة|خطوة|عمليات|إدارة|مراقبة|لوحة|تعلم/i.test(text),
    action: /order|book|reserve|contact|apply|subscribe|request|quote|checkout|buy|طلب|احجز|حجز|تواصل|تقديم|اشترك|شراء/i.test(text),
    spatial: /map|place|location|architecture|space|site|geography|خريطة|مكان|موقع|عمارة|مساحة/i.test(text),
    expressive: /campaign|story|culture|editorial|exhibition|fashion|art|festival|حملة|قصة|ثقافة|معرض|أزياء|فن|مهرجان/i.test(text),
  };
}

export function deriveNarrativeRoutes(
  analysis: BriefAnalysis,
  profile: ComplexityProfile,
  model: ExperienceModel,
  maxRoutes: number
): NarrativeRouteBlueprint[] {
  const signals = detectSignals(analysis);
  const candidates: NarrativeRouteBlueprint[] = [
    { id: "route-primary", path: "/", purpose: `Carry the primary job through the ${model} experience.`, sceneKind: "primary" },
  ];
  if (signals.comparison) candidates.push({ id: "route-compare", path: "/compare", purpose: "Compare the brief's verified differences in a dedicated decision surface.", sceneKind: "comparison" });
  if (signals.collection) candidates.push({ id: "route-collection", path: "/collection", purpose: "Browse the supplied collection without flattening its meaningful differences.", sceneKind: "collection" });
  if (signals.evidence) candidates.push({ id: "route-evidence", path: "/evidence", purpose: "Inspect provenance, specifications, or evidence supplied by the brief.", sceneKind: "evidence" });
  if (signals.workflow) candidates.push({ id: "route-workflow", path: "/workflow", purpose: "Work through the task as a visible sequence of meaningful states.", sceneKind: "workflow" });
  if (signals.action) candidates.push({ id: "route-start", path: "/start", purpose: "Complete the primary action with an honest, inspectable outcome.", sceneKind: "action" });

  const target = profile === "focused" ? 1 : profile === "balanced" ? 2 : maxRoutes;
  const fallbacks: NarrativeRouteBlueprint[] = model === "task-workbench" || model === "live-canvas"
    ? [
        { id: "route-workflow", path: "/workflow", purpose: "Preserve working context while the audience completes the primary task.", sceneKind: "workflow" },
        { id: "route-evidence", path: "/evidence", purpose: "Inspect only evidence already supplied by the brief.", sceneKind: "evidence" },
        { id: "route-start", path: "/start", purpose: "Resolve the next action without implying an unavailable backend.", sceneKind: "action" },
      ]
    : [
        { id: "route-collection", path: "/collection", purpose: "Explore the supplied subject through a distinct supporting context.", sceneKind: "collection" },
        { id: "route-evidence", path: "/evidence", purpose: "Inspect only evidence already supplied by the brief.", sceneKind: "evidence" },
        { id: "route-start", path: "/start", purpose: "Resolve the next action without implying an unavailable backend.", sceneKind: "action" },
      ];
  for (const fallback of fallbacks) {
    if (candidates.length >= target) break;
    if (!candidates.some((route) => route.id === fallback.id)) candidates.push(fallback);
  }
  return candidates.slice(0, Math.min(target, maxRoutes));
}

function openingRole(plan: DesignPlan): NarrativeRole {
  const direction = selectedDirection(plan);
  switch (direction?.descriptors.openingMode) {
    case "task-first": return "choice";
    case "index-first": return "discovery";
    case "question-first": return "tension";
    case "canvas-first": return "discovery";
    case "story-first": return "tension";
    default: return "hook";
  }
}

function selectedDirection(plan: DesignPlan) {
  const portfolio = plan.directionPortfolio;
  return portfolio?.candidates.find((candidate) => candidate.id === portfolio.selectedDirectionId) ?? portfolio?.candidates[0];
}

function primaryRoles(analysis: BriefAnalysis, plan: DesignPlan, profile: ComplexityProfile): NarrativeRole[] {
  const signals = detectSignals(analysis);
  const model = selectedDirection(plan)?.descriptors.experienceModel;
  const roles: NarrativeRole[] = [openingRole(plan)];
  const preferred: NarrativeRole[] = model === "task-workbench"
    ? ["choice", "proof", "discovery", "tension"]
    : model === "spatial-map"
      ? ["discovery", "proof", "choice", "tension"]
      : model === "narrative-scroll"
        ? ["tension", "discovery", "proof", "choice"]
        : model === "guided-conversation"
          ? ["tension", "choice", "discovery", "proof"]
          : model === "collection-browser"
            ? ["discovery", "choice", "proof", "tension"]
            : ["discovery", "choice", "tension", "proof"];

  if (signals.comparison) roles.push("choice");
  if (signals.evidence) roles.push("proof");
  if (signals.collection || signals.workflow || signals.spatial) roles.push("discovery");
  if (signals.expressive || analysis.constraints.length > 0) roles.push("tension");
  for (const role of preferred) if (!roles.includes(role)) roles.push(role);
  const desiredBeforePayoff = profile === "focused" ? 3 : profile === "balanced" ? 4 : 5;
  return [...roles.filter((role, index) => roles.indexOf(role) === index).slice(0, desiredBeforePayoff), "payoff"];
}

function routeRoles(route: NarrativeRouteBlueprint, analysis: BriefAnalysis, plan: DesignPlan, profile: ComplexityProfile): NarrativeRole[] {
  if (route.sceneKind === "primary") return primaryRoles(analysis, plan, profile);
  const byKind: Record<NarrativeRouteBlueprint["sceneKind"], NarrativeRole[]> = {
    primary: [],
    comparison: ["choice", "proof", "payoff"],
    collection: ["discovery", "choice", "proof"],
    evidence: ["proof", "discovery", "payoff"],
    workflow: ["discovery", "choice", "payoff"],
    action: ["tension", "choice", "payoff"],
  };
  return byKind[route.sceneKind];
}

function regionRoleFor(role: NarrativeRole, model: ExperienceModel): ExperienceRegionRole {
  if (role === "hook") return "orientation";
  if (role === "tension") return "story";
  if (role === "proof") return "evidence";
  if (role === "choice") return model === "guided-conversation" || model === "live-canvas" ? "task" : "comparison";
  if (role === "payoff") return "action";
  return model === "task-workbench" || model === "live-canvas" ? "task" : "collection";
}

function mediumFor(role: NarrativeRole, model: ExperienceModel, assetBundle: AssetBundle, signals: BriefSignals): VisualMedium {
  const photographyExpected = assetBundle.mediaRequirement.level === "required"
    || (assetBundle.mediaRequirement.level !== "avoid" && assetBundle.photos.length > 0);
  if (role === "proof") return signals.comparison || signals.workflow ? "data" : photographyExpected ? "photography" : "diagram";
  if (role === "choice") return model === "spatial-map" ? "spatial" : model === "live-canvas" ? "generative" : "interface";
  if (role === "discovery") return model === "spatial-map" ? "spatial" : model === "live-canvas" ? "generative" : model === "collection-browser" && photographyExpected ? "photography" : "diagram";
  if (role === "payoff") return "interface";
  if (role === "tension") return photographyExpected ? "photography" : "illustration";
  return photographyExpected ? "photography" : "typography";
}

function evidenceOf(
  contract: BriefEvidenceContract,
  kinds: BriefEvidenceItem["kind"][],
  limit: number
): BriefEvidenceItem[] {
  return contract.items.filter((item) => kinds.includes(item.kind)).slice(0, limit);
}

function recordSummaries(contract: BriefEvidenceContract, limit = 3): string[] {
  return contract.records.slice(0, limit).map((record) => {
    const attributes = record.attributes.map((attribute) => `${attribute.label}: ${attribute.value}`).join("; ");
    return attributes ? `${record.label} — ${attributes}` : record.label;
  });
}

function informationShape(role: NarrativeRole, contract: BriefEvidenceContract): SceneInformationShape {
  if (role === "hook" || role === "tension") return "orientation-signal";
  if (role === "discovery") return contract.records.length ? "record-browser" : "evidence-ledger";
  if (role === "proof") return "evidence-ledger";
  if (role === "choice") return contract.comparisonDimensions.length ? "comparison-matrix" : "guided-decision";
  return "action-outcome";
}

function sceneCopy(
  role: NarrativeRole,
  analysis: BriefAnalysis,
  contract: BriefEvidenceContract
): Pick<StoryScene, "audienceQuestion" | "purpose" | "focalObject" | "evidence" | "evidenceIds" | "informationShape" | "action" | "visibleConsequence"> {
  const records = recordSummaries(contract);
  const facts = evidenceOf(contract, ["record", "quantified-fact", "collection-expectation"], 5);
  const dimensions = contract.comparisonDimensions.map((dimension) => dimension.label);
  const shape = informationShape(role, contract);
  switch (role) {
    case "hook": return {
      audienceQuestion: "What is this, and can it help me now?",
      purpose: `Make ${analysis.subject} immediately legible while keeping the primary job in view.`,
      focalObject: contract.collectionExpectation
        ? `${contract.collectionExpectation.expectedCount} ${contract.collectionExpectation.label}`
        : analysis.subject,
      evidence: facts.length ? facts.slice(0, 2).map((item) => item.text) : ["Subject, audience, and constraints explicitly supplied by the brief"],
      evidenceIds: facts.slice(0, 2).map((item) => item.id),
      informationShape: shape,
    };
    case "tension": return {
      audienceQuestion: "What decision or uncertainty must I resolve?",
      purpose: "Turn the audience's real uncertainty into a visible design tension, not a decorative slogan.",
      focalObject: analysis.primaryJob,
      evidence: contract.gaps.length
        ? contract.gaps.map((gap) => gap.message)
        : facts.length
          ? facts.slice(0, 2).map((item) => item.text)
          : ["Audience need and explicit constraints from the brief"],
      evidenceIds: facts.slice(0, 2).map((item) => item.id),
      informationShape: shape,
    };
    case "discovery": return {
      audienceQuestion: "What can I inspect, navigate, or understand here?",
      purpose: "Reveal the subject through a domain-native exploration mechanism.",
      focalObject: contract.records.length ? "The verified record collection" : `Inspectable ${analysis.industry} material`,
      evidence: records.length
        ? records
        : facts.length
          ? facts.slice(0, 3).map((item) => item.text)
          : ["Only items, categories, or process details explicitly present in the brief"],
      evidenceIds: contract.records.slice(0, 3).map((record) => record.evidenceId),
      informationShape: shape,
      action: "Explore or focus a supplied item",
      visibleConsequence: "The selected context becomes visibly distinct without losing orientation",
    };
    case "proof": return {
      audienceQuestion: "What verified evidence supports my decision?",
      purpose: "Make supplied specifications, provenance, or evidence inspectable and comparable.",
      focalObject: "Verified decision evidence",
      evidence: facts.length ? [...recordSummaries(contract, 5), ...facts.map((item) => item.text)].filter((value, index, values) => values.indexOf(value) === index).slice(0, 6) : ["Brief facts and approved assets only", "Explicit missing-evidence labels when source material is absent"],
      evidenceIds: facts.map((item) => item.id),
      informationShape: shape,
      action: "Inspect the evidence behind a choice",
      visibleConsequence: "Evidence detail or provenance becomes visible in context",
    };
    case "choice": return {
      audienceQuestion: "How do the available paths differ, and which one fits?",
      purpose: `Let ${analysis.audience} act on meaningful differences instead of scanning generic feature cards.`,
      focalObject: dimensions.length ? `${dimensions.join(" / ")} comparison` : "The primary decision surface",
      evidence: dimensions.length || records.length || contract.gaps.length
        ? [...dimensions.map((dimension) => `Compare by ${dimension}`), ...records, ...contract.gaps.map((gap) => gap.message)].slice(0, 8)
        : ["Differences and criteria explicitly supplied by the brief"],
      evidenceIds: [...contract.comparisonDimensions.map((dimension) => dimension.evidenceId), ...contract.records.map((record) => record.evidenceId)].filter((value, index, values) => values.indexOf(value) === index),
      informationShape: shape,
      action: analysis.primaryJob,
      visibleConsequence: "The chosen option, filter, or path changes the visible working state",
    };
    case "payoff": return {
      audienceQuestion: "What happens when I take the next step?",
      purpose: "Resolve the experience with a truthful action and a visible, non-fabricated outcome.",
      focalObject: "Primary action and its consequence",
      evidence: [...contract.gaps.map((gap) => gap.message), "Connection status and next-step requirements are disclosed"].slice(0, 4),
      evidenceIds: contract.collectionExpectation ? [contract.collectionExpectation.evidenceId] : [],
      informationShape: shape,
      action: analysis.primaryJob,
      visibleConsequence: "A real route, local state, or clearly disclosed unconnected adapter responds",
    };
  }
}

function narrativeStructure(model: ExperienceModel, routeCount: number): NarrativeStructure {
  if (model === "spatial-map" || model === "live-canvas") return "spatial";
  if (routeCount > 1 || model === "collection-browser" || model === "guided-conversation") return "branching";
  return model === "narrative-scroll" ? "linear" : "cyclical";
}

export function buildVisualNarrativeContract(input: {
  analysis: BriefAnalysis;
  plan: DesignPlan;
  profile: ComplexityProfile;
  routes: NarrativeRouteBlueprint[];
  assetBundle: AssetBundle;
  briefEvidence: BriefEvidenceContract;
}): VisualNarrativeContract {
  const { analysis, plan, profile, routes, assetBundle, briefEvidence } = input;
  const direction = selectedDirection(plan);
  const model: ExperienceModel = direction?.descriptors.experienceModel ?? "guided-conversation";
  const signals = detectSignals(analysis);
  const scenes: StoryScene[] = [];

  for (const route of routes) {
    for (const [index, role] of routeRoles(route, analysis, plan, profile).entries()) {
      const id = `scene-${route.id.replace(/^route-/, "")}-${role}-${index + 1}`;
      scenes.push({
        id,
        routeId: route.id,
        narrativeRole: role,
        regionRole: regionRoleFor(role, model),
        ...sceneCopy(role, analysis, briefEvidence),
        medium: mediumFor(role, model, assetBundle, signals),
        nextSceneIds: [],
      });
    }
  }

  for (const route of routes) {
    const routeScenes = scenes.filter((scene) => scene.routeId === route.id);
    routeScenes.forEach((scene, index) => {
      if (routeScenes[index + 1]) scene.nextSceneIds.push(routeScenes[index + 1].id);
    });
  }
  if (routes.length > 1) {
    const primaryOpening = scenes.find((scene) => scene.routeId === routes[0].id);
    for (const route of routes.slice(1)) {
      const branchOpening = scenes.find((scene) => scene.routeId === route.id);
      if (primaryOpening && branchOpening && !primaryOpening.nextSceneIds.includes(branchOpening.id)) primaryOpening.nextSceneIds.push(branchOpening.id);
    }
  }

  const requiredLayers: VisualLayer[] = ["type", "interaction"];
  if (scenes.some((scene) => scene.medium === "photography" || scene.medium === "illustration")) requiredLayers.push("media");
  if (scenes.some((scene) => scene.medium === "data")) requiredLayers.push("data");
  if (scenes.some((scene) => ["diagram", "spatial", "generative"].includes(scene.medium))) requiredLayers.push("shape");
  if (direction?.descriptors.motionRole && direction.descriptors.motionRole !== "none") requiredLayers.push("motion");

  const detailDensity = direction?.descriptors.density === "dense" || profile === "systemic"
    ? "immersive"
    : direction?.descriptors.density === "airy" && profile === "focused"
      ? briefEvidence.density === "rich" ? "layered" : "restrained"
      : "layered";
  const approvedMedia = assetBundle.photos.length > 0;
  const materialVocabulary = [
    ...plan.colorPalette.slice(0, 3).map((color) => `${color.role}: ${color.name}`),
    `signature mechanism: ${plan.signatureElement.name}`,
    ...briefEvidence.records.flatMap((record) => record.attributes.map((attribute) => `${attribute.label}: ${attribute.value}`)).slice(0, 6),
    ...assetBundle.mediaRequirement.suggestedSubjects.slice(0, 2).map((subject) => `approved subject language: ${subject}`),
  ];
  const compositionDensity = direction?.descriptors.density === "airy"
    ? "sparse" as const
    : direction?.descriptors.density === "dense" || profile === "systemic"
      ? "dense" as const
      : "balanced" as const;
  const compositionGenome = buildCompositionGenome({
    scenes,
    model,
    density: compositionDensity,
    seed: `${analysis.subject}:${direction?.id ?? model}:${direction?.descriptors.openingMode ?? "task-first"}`,
  });

  return {
    version: VISUAL_NARRATIVE_VERSION,
    thesis: `Transform ${analysis.primaryJob} into the organizing visual and interactive idea for ${analysis.subject}${briefEvidence.comparisonDimensions.length ? ` through ${briefEvidence.comparisonDimensions.map((dimension) => dimension.label).join(", ")}` : ""}.`,
    emotionalTension: `Balance ${analysis.tone} with the audience's need to make a confident, evidence-aware decision.`,
    structure: narrativeStructure(model, routes.length),
    scenes,
    artDirection: {
      compositionGrammar: `${direction?.descriptors.spatialSystem ?? model}; ${direction?.dimensions.topology ?? "brief-derived topology"}; preserve one dominant focal relationship per scene.`,
      materialVocabulary,
      imageLanguage: approvedMedia
        ? `${direction?.dimensions.mediaStrategy ?? "Use approved media as evidence"}; every image must have a declared narrative role.`
        : "Build with type, data, interface, diagram, and honest labeled asset slots; do not counterfeit photography with anonymous texture.",
      typographyVoice: direction?.descriptors.typographyVoice ?? plan.typePairing.rationale,
      motionChoreography: direction?.descriptors.motionRole === "none"
        ? "Use only immediate state feedback and preserve reduced-motion equivalence."
        : `${direction?.descriptors.motionRole ?? "feedback"} motion reveals state or spatial consequence; it never loops as ambient decoration.`,
      interactionMetaphor: direction?.dimensions.interactionMetaphor ?? "Inspect, choose, and reveal consequences in context.",
      detailDensity,
      forbiddenFallbacks: [
        "Generic hero, feature-card grid, testimonial strip, and CTA sequence",
        "Retired editorial register of giant type, numbered ledger rows, image interruption, and dark folio close",
        ...briefEvidence.prohibitedPatterns.map((pattern) => pattern.text),
        ...analysis.constraints.slice(0, 2),
      ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 12),
    },
    compositionGenome,
    richness: {
      strategy: "global-clarity-local-detail",
      targetSceneCount: scenes.length,
      minimumFunctionalLayers: requiredLayers.length,
      requiredLayers,
      minimumMeaningfulStates: profile === "focused" ? 3 : profile === "balanced" ? 6 : 10,
      maximumSimultaneousFocalPoints: profile === "systemic" ? 2 : 1,
      rationale: "Keep the global composition legible while concentrating texture, evidence, responsive behavior, and interaction detail around each scene's focal object.",
    },
  };
}
