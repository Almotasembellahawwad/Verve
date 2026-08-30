export type RestraintVerdict = "disciplined" | "restrained-further" | "over-designed";

export type RestraintResult = {
  verdict: RestraintVerdict;
  boldestElement: string;
  reasoning: string;
  suggestion: string | null;
  restraintScore: number;
  richnessScore: number;
  meaningfulLayers: string[];
};

type DesignPlanInput = {
  colorPalette: { name: string; hex: string; role: string }[];
  typePairing: { display: string; body: string; rationale: string };
  signatureElement: { name: string; description: string; justification: string };
  layoutConcept: string;
  referencesSampled: string[];
};

const LAYER_SIGNALS = [
  { id: "media", pattern: /photo|image|video|media|photograph|صورة|صور|فيديو/i },
  { id: "data", pattern: /data|chart|metric|evidence|comparison|map|بيانات|مقارنة|خريطة/i },
  { id: "interaction", pattern: /interact|control|filter|drag|select|step|canvas|تفاعل|تحكم|تصفية|خطوة/i },
  { id: "shape", pattern: /shape|geometry|spatial|diagram|illustration|شكل|هندس|مخطط|رسم/i },
  { id: "surface", pattern: /surface|layer|depth|texture|material|سطح|طبقة|عمق|ملمس|مادة/i },
  { id: "motion", pattern: /motion|transition|animate|movement|حركة|انتقال/i },
] as const;

const TECHNIQUE_SIGNALS = ["gradient", "parallax", "neon", "glass", "3d", "particle", "texture", "animation", "blur", "shadow"];

function purposeful(text: string): boolean {
  return /because|so that|supports?|reveals?|clarifies?|lets? the|helps?|therefore|لأن|كي|حتى|يساعد|يكشف|يوضح|يدعم/i.test(text);
}

export function runRestraintCheck(plan: DesignPlanInput): RestraintResult {
  const planText = [plan.layoutConcept, plan.signatureElement.description, plan.signatureElement.justification, plan.typePairing.rationale, ...plan.colorPalette.map((color) => `${color.name} ${color.role}`)].join(" ");
  const meaningfulLayers = LAYER_SIGNALS.filter((signal) => signal.pattern.test(planText)).map((signal) => signal.id);
  const mentionedTechniques = TECHNIQUE_SIGNALS.filter((technique) => new RegExp(technique, "i").test(planText));
  const signaturePurposeful = purposeful(`${plan.signatureElement.description} ${plan.signatureElement.justification}`)
    && plan.signatureElement.justification.trim().split(/\s+/).length >= 12;
  const layoutPurposeful = purposeful(plan.layoutConcept) || /task|job|evidence|decision|audience|مهمة|دليل|قرار|جمهور/i.test(plan.layoutConcept);
  const competingTechniques = Math.max(0, mentionedTechniques.length - (signaturePurposeful ? 2 : 1));
  const excessivePalette = Math.max(0, plan.colorPalette.length - 8);
  const richnessScore = Math.max(0, Math.min(100, 30 + meaningfulLayers.length * 14 + (layoutPurposeful ? 14 : 0)));
  const restraintScore = Math.max(0, Math.min(100,
    62
    + (signaturePurposeful ? 18 : -12)
    + (layoutPurposeful ? 12 : -10)
    - competingTechniques * 10
    - excessivePalette * 5
  ));
  const boldestElement = plan.signatureElement.name || mentionedTechniques[0] || "signature element";
  let verdict: RestraintVerdict = restraintScore >= 70 ? "disciplined" : restraintScore >= 45 ? "restrained-further" : "over-designed";
  let suggestion: string | null = null;
  if (richnessScore < 58 && verdict === "disciplined") {
    verdict = "restrained-further";
    suggestion = "The composition is coherent but under-developed. Add a meaningful media, data, interaction, shape, or surface layer derived from the brief rather than another typographic section.";
  } else if (!signaturePurposeful) {
    suggestion = "Tie the signature mechanism to a specific audience decision or remove it; visual novelty alone is not a structural role.";
  } else if (competingTechniques > 0) {
    suggestion = `Keep ${boldestElement} as the focal mechanism and reduce techniques that do not change understanding or action.`;
  }
  const reasoning = richnessScore < 58
    ? `The plan is restrained but has only ${meaningfulLayers.length} meaningful non-typographic layer${meaningfulLayers.length === 1 ? "" : "s"}. Restraint must not collapse the brief into a sparse editorial page.`
    : signaturePurposeful
      ? `${boldestElement} has a stated functional role. Techniques such as gradients, 3D, texture, or motion are evaluated by necessity and competition, never penalized by style name alone.`
      : `${boldestElement} is visually described but its contribution to the audience's job is not yet explicit.`;
  return { verdict, boldestElement, reasoning, suggestion, restraintScore, richnessScore, meaningfulLayers };
}

export function restraintGrade(score: number): string {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}
