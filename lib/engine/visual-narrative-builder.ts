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

function detectSignals(analysis: BriefAnalysis): BriefSignals {
  // Inferred audience/job/tone are hypotheses, not requests for extra content or
  // pages. In particular, a generic "choose" job must not create /compare.
  const text = analysis.rawBrief;
  return {
    comparison: /\b(?:compare|comparison|versus|spec(?:ification)?s?|prices?|weights?|binding|batch(?:es)?)\b|مقارن|مواصف|سعر|وزن|تجليد/i.test(text),
    collection: /\b(?:collections?|catalog|portfolio|library|products?|cases|case studies|projects?|browse|inventory)\b|مجموعة|كتالوج|منتجات|أعمال|تصفح|مخزون/i.test(text),
    evidence: /\b(?:evidence|proof|data|results?|methods?|materials?|provenance|research|verified|spec(?:ification)?s?)\b|دليل|بيانات|نتائج|منهج|مواد|موثق|مواصف/i.test(text),
    workflow: /\b(?:workflow|process|journey|steps?|operations?|manage|monitor|dashboard|workspace|learn|how it works)\b|عملية|رحلة|خطوة|عمليات|إدارة|مراقبة|لوحة|تعلم/i.test(text),
    action: /\b(?:order|book|reserve|contact|apply|subscribe|request|quote|checkout|buy)\b|طلب|احجز|حجز|تواصل|تقديم|اشترك|شراء/i.test(text),
    spatial: /\b(?:maps?|places?|locations?|architecture|spaces?|site|geography)\b|خريطة|مكان|موقع\s+(?:المشروع|المبنى|جغرافي)|عمارة|مساحة/i.test(text),
    expressive: /\b(?:campaign|story|culture|editorial|exhibition|fashion|art|festival)\b|حملة|قصة|ثقافة|معرض|أزياء|فن|مهرجان/i.test(text),
  };
}

function routeIntentIsNegated(text: string, position: number, label = ""): boolean {
  const context = `${text.slice(Math.max(0, position - 60), position)} ${label}`;
  return /\b(?:avoid|without|no|not|never|don't)\b[^.!;\n]{0,50}$|(?:^|[\s،؛.!?])(?:لا|بدون|تجنب|ليس|ليست)\s[^.!؛\n]{0,50}$/i.test(context);
}

export function deriveNarrativeRoutes(
  analysis: BriefAnalysis,
  _profile: ComplexityProfile,
  model: ExperienceModel,
  maxRoutes: number
): NarrativeRouteBlueprint[] {
  const text = analysis.rawBrief;
  const candidates: NarrativeRouteBlueprint[] = [
    { id: "route-primary", path: "/", purpose: `Carry the primary job through the ${model} experience.`, sceneKind: "primary" },
  ];
  // A complexity budget is a ceiling, not an obligation to manufacture empty
  // destinations. Comparing records and inspecting evidence can happen inline.
  const explicitSinglePage = [...text.matchAll(/\bsingle[ -]?page\b|\bone[ -]?page\b|صفحة\s+واحدة/gi)].some((match) => {
    return !routeIntentIsNegated(text, match.index!);
  });
  if (explicitSinglePage) return candidates;
  const requests = explicitRouteRequests(text);
  for (const request of requests) {
    if (request.path === "/" || candidates.some((route) => route.path === request.path)) continue;
    const baseId = `route-${request.path.slice(1).replaceAll("/", "-")}`;
    const id = candidates.some((route) => route.id === baseId) ? `${baseId}-${routeLabelHash(request.path)}` : baseId;
    candidates.push({
      id, path: request.path, sceneKind: routeKind(request.label),
      purpose: `Implement the explicitly requested ${request.label} page using only supplied content and truthful task outcomes.`,
    });
  }
  const limit = Number.isInteger(maxRoutes) && maxRoutes > 0 ? maxRoutes : 1;
  const omitted = candidates.slice(limit).map((route) => route.path);
  if (omitted.length) candidates[0].purpose += ` Route budget ${limit}: requested destinations ${omitted.join(", ")} are outside this generation; do not pretend those pages or links were implemented.`;
  return candidates.slice(0, limit);
}

function routeLabelHash(label: string): string {
  let hash = 2166136261;
  for (const character of label) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

function routeKind(label: string): NarrativeRouteBlueprint["sceneKind"] {
  if (/\b(?:compare|comparison)\b|مقارن/i.test(label)) return "comparison";
  if (/\b(?:collections?|catalog|products?|projects?|portfolio|work|gallery|exhibitions?|library|resources?|blog|news|case studies)\b|مجموعة|كتالوج|منتجات|المشاريع|أعمال|معرض|مكتبة/i.test(label)) return "collection";
  if (/\b(?:workflow|dashboard|workspace|tools?|experiments?|settings|account)\b|سير العمل|لوحة التحكم|مساحة العمل/i.test(label)) return "workflow";
  if (/\b(?:contact|booking|checkout|start|visit|subscribe|donate|order)\b|التواصل|الحجز|الدفع|الزيارة/i.test(label)) return "action";
  return "evidence";
}

function routePath(label: string): string {
  if (/^(?:home|homepage|index|overview|landing|الرئيسية|الصفحة الرئيسية)$/i.test(label)) return "/";
  if (/^\/[a-z0-9][a-z0-9_-]{0,47}(?:\/[a-z0-9][a-z0-9_-]{0,47}){0,3}$/i.test(label)) return label.toLowerCase();
  if (/^(?:compare|comparison|مقارنة)$/i.test(label)) return "/compare";
  const arabicPaths: Record<string, string> = { المشاريع: "projects", المنتجات: "products", الأعمال: "work", المجموعة: "collection", المعرض: "gallery", الأدلة: "evidence", البحث: "research", "من نحن": "about", "عن الشركة": "about", التواصل: "contact", الحجز: "booking", الدفع: "checkout", الزيارة: "visit", الخدمات: "services", الفريق: "team" };
  if (arabicPaths[label]) return `/${arabicPaths[label]}`;
  const slug = label.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48).replace(/-$/g, "");
  return `/${slug || `page-${routeLabelHash(label)}`}`;
}

function explicitRouteRequests(text: string): Array<{ path: string; label: string }> {
  const requests: Array<{ path: string; label: string; position: number }> = [];
  const negated = (position: number, label = "") => routeIntentIsNegated(text, position, label);
  const addLabel = (raw: string, position: number) => {
    if (negated(position, raw)) return;
    const label = raw.trim().replace(/^[\s\-*"'“”]+|[\s"'“”]+$/g, "").replace(/^\d+[.)]\s*/, "")
      .replace(/^(?:(?:build|create|design|include|want|a|an|the|and|separate|dedicated|standalone)\s+)+/i, "").trim();
    if (!label || label.length > 80 || /\b(?:website|site|with|for|that|which|should|must|can|users|buyers|compare)\s+\w/i.test(label)) return;
    const path = routePath(label);
    if (/^\/(?:api|assets|public|_next)(?:\/|$)/i.test(path)) return;
    requests.push({ path, label, position });
  };
  const addList = (list: string, position: number) => {
    for (const entry of list.split(/\s*(?:[,;،\n]|\band\b|&|\s+و(?=[\p{L}]))\s*/iu)) {
      addLabel(entry, position + list.indexOf(entry));
    }
  };
  // Literal safe frontend paths retain their names; external URLs, endpoints,
  // and asset filenames cannot become extra user-facing pages.
  for (const match of text.matchAll(/(?<![\w:/.])\/[a-z0-9][a-z0-9_-]{0,47}(?:\/[a-z0-9][a-z0-9_-]{0,47}){0,3}(?=$|[\s,;:.)\]"'])/gi)) {
    if (/^\.[a-z0-9]/i.test(text.slice(match.index! + match[0].length))) continue;
    addLabel(match[0], match.index!);
  }
  // Page-list declarations, including a list on following bullet lines.
  for (const match of text.matchAll(/(?:^|\n|[.;])\s*(?:pages|routes|صفحات|الصفحات)\s*[:：]\s*([^.!?]+?)(?=[.!?]|$)/gi)) addList(match[1], match.index! + match[0].indexOf(match[1]));
  for (const match of text.matchAll(/\b(?:with|including|include|build|create|design)\s+([^.!?\n]+?)\s+(?:pages|routes)\b/gi)) {
    const list = match[1].replace(/^.*\bwith\s+/i, "");
    addList(list, match.index! + match[0].lastIndexOf(list));
  }
  // An explicit multi-page label followed by a named list does not make the
  // artifact descriptor (e.g. "portfolio") a second /portfolio destination.
  if (/\bmulti[ -]?page\b|\bmultiple (?:pages|routes)\b|متعدد\s+الصفحات|صفحات\s+متعددة/i.test(text)) {
    for (const match of text.matchAll(/\b(?:with|including)\s+([^.!?\n]+)/gi)) addList(match[1].replace(/\s+(?:pages|routes)\b.*$/i, ""), match.index! + match[0].indexOf(match[1]));
    for (const match of text.matchAll(/(?:متعدد\s+الصفحات|صفحات\s+متعددة)\s*[:：]\s*([^.!?\n]+)/gi)) addList(match[1], match.index! + match[0].indexOf(match[1]));
  }
  for (const match of text.matchAll(/\b([\p{L}\p{N}_-]+(?:\s+[\p{L}\p{N}_-]+){0,2})\s+(?:page|screen)\b/giu)) addLabel(match[1], match.index!);
  for (const match of text.matchAll(/صفحة\s+([^.!?،\n]{1,60})/gi)) addLabel(match[1].replace(/\s+(?:مستقلة|منفصلة).*$/, ""), match.index!);
  return requests.sort((left, right) => left.position - right.position).map(({ path, label }) => ({ path, label }));
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

function primaryRoles(analysis: BriefAnalysis, plan: DesignPlan, contract: BriefEvidenceContract): NarrativeRole[] {
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

  const eligible = new Set<NarrativeRole>();
  if (signals.comparison || signals.collection || signals.workflow || (signals.action && model === "guided-conversation")) eligible.add("choice");
  if (signals.evidence || contract.records.length > 0 || contract.items.some((item) => item.kind === "quantified-fact")) eligible.add("proof");
  if (signals.collection || signals.workflow || signals.spatial || model === "spatial-map" || model === "live-canvas") eligible.add("discovery");
  if (signals.expressive) eligible.add("tension");
  // The selected direction controls the ordering of supported scene roles.
  // It must not fill every absent role just to create a five-section silhouette.
  for (const role of preferred) if (eligible.has(role) && !roles.includes(role)) roles.push(role);
  // Preserve the current three-scene contract: orientation, an actionable
  // decision/exploration, and a truthful consequence. Do not invent evidence.
  if (roles.length === 1) roles.push(roles[0] === "choice" ? "discovery" : "choice");
  return [...roles, "payoff"];
}

function routeRoles(route: NarrativeRouteBlueprint, analysis: BriefAnalysis, plan: DesignPlan, contract: BriefEvidenceContract): NarrativeRole[] {
  if (route.sceneKind === "primary") return primaryRoles(analysis, plan, contract);
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
    for (const [index, role] of routeRoles(route, analysis, plan, briefEvidence).entries()) {
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
    // Browsing, conversation, and canvas directions expose relevant local
    // branches. Those branches are scene states, not compulsory extra pages.
    if (["collection-browser", "guided-conversation", "spatial-map", "live-canvas"].includes(model)) {
      const opening = routeScenes[0];
      const destinations = routeScenes.slice(1).filter((scene) => ["choice", "discovery", "proof"].includes(scene.narrativeRole));
      if (opening) {
        for (const destination of destinations) {
          if (!opening.nextSceneIds.includes(destination.id)) opening.nextSceneIds.push(destination.id);
        }
      }
    }
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
