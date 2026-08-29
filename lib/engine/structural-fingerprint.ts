import type { DesignStructureFingerprint } from "../domain/design-direction";

type FamilyRule = {
  family: DesignStructureFingerprint["topologyFamily"];
  expressions: RegExp[];
};

const FAMILY_RULES: FamilyRule[] = [
  {
    family: "editorial-register",
    expressions: [
      /\b(?:ledger|register|dossier|case path|case margin|evidence index|record index|numbered rows?|folio)\b/i,
      /\b(?:vertical|side)\s+(?:rail|index|margin|datum)\b/i,
      /writing-mode\s*:\s*vertical/i,
    ],
  },
  {
    family: "workbench",
    expressions: [/\b(?:workbench|workspace|control surface|tool surface|inspect and manipulate|persistent panels?)\b/i],
  },
  {
    family: "dashboard",
    expressions: [/\b(?:dashboard|metric grid|kpi|analytics panel|command center|data console)\b/i],
  },
  {
    family: "timeline",
    expressions: [/\b(?:timeline|chronology|temporal sequence|progress track|step-by-step journey)\b/i],
  },
  {
    family: "comparison",
    expressions: [/\b(?:comparison field|comparison matrix|before and after|versus|side-by-side evidence)\b/i],
  },
  {
    family: "spatial-canvas",
    expressions: [/\b(?:spatial plan|plan canvas|map surface|coordinate field|floor plan|diagram canvas)\b/i],
  },
  {
    family: "catalog",
    expressions: [/\b(?:catalog|collection browser|inventory|product grid|gallery index|filterable collection)\b/i],
  },
  {
    family: "form-led",
    expressions: [/\b(?:consultation request|application flow|intake flow|booking flow|questionnaire|form-led)\b/i],
  },
  {
    family: "narrative",
    expressions: [/\b(?:narrative|story sequence|chapter|essay|manifesto|editorial journey)\b/i],
  },
];

function countMatches(source: string, expressions: RegExp[]): number {
  return expressions.reduce((score, expression) => score + (expression.test(source) ? 1 : 0), 0);
}

function topologyFamily(source: string): DesignStructureFingerprint["topologyFamily"] {
  const scored = FAMILY_RULES
    .map((rule) => ({ family: rule.family, score: countMatches(source, rule.expressions) }))
    .sort((left, right) => right.score - left.score);
  return scored[0]?.score ? scored[0].family : "unknown";
}

function openingMode(source: string): DesignStructureFingerprint["openingMode"] {
  if (/min-height\s*:\s*(?:calc\(100v|[89]\dvh|100vh)|viewport[- ]filling|full[- ]viewport hero/i.test(source)) {
    return "viewport-hero";
  }
  if (/hero[-_ ]grid|two unequal columns|split[- ](?:hero|opening)|grid-template-columns\s*:[^;]*(?:7fr|repeat\(12)/i.test(source)) {
    return "split-opening";
  }
  if (/compact (?:task|service|utility|opening)|primary task first|tool state first/i.test(source)) {
    return "compact-task";
  }
  return "unknown";
}

function sectionRhythm(source: string): DesignStructureFingerprint["sectionRhythm"] {
  const viewportStages = (source.match(/min-height\s*:\s*(?:8\d|9\d|100)vh/gi)?.length ?? 0) >= 2;
  if (viewportStages || /repeated (?:full-)?viewport|viewport stages/i.test(source)) return "viewport-stages";
  if (/numbered rows?|numbered index|\b0[1-4]\b[\s\S]{0,120}\b0[2-5]\b|counter-reset/i.test(source)) return "numbered-rows";
  if (/nested panels?|panel grid|card grid|dense persistent frame/i.test(source)) return "panel-grid";
  if (/alternating|mixed rhythm|compressed[\s\S]{0,80}(?:expanded|full-width)/i.test(source)) return "mixed";
  return "unknown";
}

function structuralTraits(source: string): string[] {
  const traits: Array<[string, RegExp]> = [
    ["oversized-heading", /(?:hero\s+)?h1[\s\S]{0,500}font-size\s*:\s*clamp\([^)]*(?:[5-9](?:\.\d+)?vw|1[0-9](?:\.\d+)?vw|[7-9]\dpx)|huge (?:sans )?headline|oversized heading/i],
    ["vertical-rail", /writing-mode\s*:\s*vertical|vertical (?:rail|index|margin|datum)|case-margin|evidence-rail/i],
    ["numbered-index", /numbered (?:rows?|index|stages?)|counter-reset|class(?:Name)?=["'][^"']*(?:number|index)[^"']*["']|>\s*0[1-4]\s*</i],
    ["editorial-rules", /border-(?:top|bottom)\s*:[^;]*1px|ruled line|document grid|editorial rules?/i],
    ["dark-closing-panel", /(?:closing|contact|folio|footer)[\s\S]{0,500}background\s*:\s*(?:#(?:0[0-9a-f]{5}|1[0-9a-f]{5}|2[0-9a-f]{5})|var\([^)]*(?:ink|dark|graphite))/i],
    ["single-accent", /single (?:action )?accent|one (?:bright )?accent/i],
    ["twelve-column-grid", /grid-template-columns\s*:\s*repeat\(12/i],
    ["sticky-or-persistent-rail", /position\s*:\s*sticky|persistent (?:rail|index|panel)/i],
    ["full-width-interrupt", /full-width (?:evidence|image|moment|interrupt)|width\s*:\s*100vw/i],
    ["dense-panels", /nested panels?|dense persistent frame|dashboard|workbench/i],
  ];
  return traits.filter(([, expression]) => expression.test(source)).map(([trait]) => trait).sort();
}

export function inferDesignStructure(source: string): DesignStructureFingerprint {
  return {
    topologyFamily: topologyFamily(source),
    openingMode: openingMode(source),
    sectionRhythm: sectionRhythm(source),
    traits: structuralTraits(source),
  };
}

export function mergeDesignStructures(
  described: DesignStructureFingerprint,
  delivered?: DesignStructureFingerprint
): DesignStructureFingerprint {
  if (!delivered) return described;
  return {
    topologyFamily: delivered.topologyFamily === "unknown" ? described.topologyFamily : delivered.topologyFamily,
    openingMode: delivered.openingMode === "unknown" ? described.openingMode : delivered.openingMode,
    sectionRhythm: delivered.sectionRhythm === "unknown" ? described.sectionRhythm : delivered.sectionRhythm,
    traits: [...new Set([...described.traits, ...delivered.traits])].sort(),
  };
}

function setDistance(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = [...a].filter((value) => b.has(value)).length;
  const union = new Set([...a, ...b]).size;
  return union ? 1 - intersection / union : 0;
}

function categoryDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (left === "unknown" || right === "unknown") return 0.5;
  return 1;
}

export function designStructureDistance(
  left: DesignStructureFingerprint,
  right: DesignStructureFingerprint
): number {
  return Number((
    categoryDistance(left.topologyFamily, right.topologyFamily) * 0.45
    + categoryDistance(left.openingMode, right.openingMode) * 0.2
    + categoryDistance(left.sectionRhythm, right.sectionRhythm) * 0.15
    + setDistance(left.traits, right.traits) * 0.2
  ).toFixed(3));
}
