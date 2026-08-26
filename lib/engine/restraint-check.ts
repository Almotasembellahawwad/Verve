// lib/engine/restraint-check.ts
// Module N -- Restraint Check
//
// Dieter Rams principle: "Less, but better."
// After the design plan is generated, this module asks one focused question:
//
//   "If we removed the single boldest element from this plan,
//    would the design become stronger or weaker?"
//
// If the answer is "stronger" -- the element is decorative noise, not signal.
// Real boldness is knowing when to stop.
//
// This is a deterministic analysis (no LLM call) based on the plan structure.
// A future enhancement could use an LLM call for richer reasoning.

export type RestraintVerdict = "disciplined" | "restrained-further" | "over-designed";

export type RestraintResult = {
  verdict: RestraintVerdict;
  boldestElement: string;
  reasoning: string;
  suggestion: string | null;
  restraintScore: number; // 0-100, higher = more disciplined restraint
};

type DesignPlanInput = {
  colorPalette: { name: string; hex: string; role: string }[];
  typePairing: { display: string; body: string; rationale: string };
  signatureElement: { name: string; description: string; justification: string };
  layoutConcept: string;
  referencesSampled: string[];
};

// Signals that suggest over-design (accumulated boldness without purpose)
const OVER_DESIGN_SIGNALS = [
  { pattern: /gradient/i,        penalty: 15, label: "gradient (adds visual noise without semantic meaning)" },
  { pattern: /parallax/i,        penalty: 12, label: "parallax (motion for motion's sake)" },
  { pattern: /neon/i,            penalty: 10, label: "neon colors (high contrast without hierarchy)" },
  { pattern: /glassmorphism/i,   penalty: 18, label: "glassmorphism (currently overused, will date quickly)" },
  { pattern: /blob|organic shape/i, penalty: 10, label: "blob/organic shapes (decorative, no structural role)" },
  { pattern: /3d|three.?dimensional/i, penalty: 8, label: "3D elements (high implementation cost, often gimmicky)" },
  { pattern: /animated.*background|background.*anim/i, penalty: 20, label: "animated background (distracts from content)" },
  { pattern: /multiple.*animation|animation.*multiple/i, penalty: 15, label: "multiple competing animations" },
  { pattern: /confetti|particle/i, penalty: 25, label: "particles/confetti (almost never purposeful)" },
];

// Signals that indicate true discipline -- bold but purposeful
const DISCIPLINE_SIGNALS = [
  { pattern: /editorial/i,      bonus: 10 },
  { pattern: /white.?space|negative.?space/i, bonus: 12 },
  { pattern: /monochrom/i,      bonus: 8  },
  { pattern: /typograph/i,      bonus: 6  },
  { pattern: /grid/i,           bonus: 5  },
  { pattern: /restraint|minimal/i, bonus: 10 },
  { pattern: /single.*color|one.*color|limited.*palette/i, bonus: 8 },
];

export function runRestraintCheck(plan: DesignPlanInput): RestraintResult {
  const planText = [
    plan.layoutConcept,
    plan.signatureElement.description,
    plan.signatureElement.justification,
    plan.typePairing.rationale,
    ...plan.colorPalette.map((c) => `${c.name} ${c.role}`),
  ].join(" ").toLowerCase();

  let penaltyTotal = 0;
  let bonusTotal = 0;
  const flaggedSignals: string[] = [];

  // Check over-design signals
  for (const signal of OVER_DESIGN_SIGNALS) {
    if (signal.pattern.test(planText)) {
      penaltyTotal += signal.penalty;
      flaggedSignals.push(signal.label);
    }
  }

  // Check discipline signals
  for (const signal of DISCIPLINE_SIGNALS) {
    if (signal.pattern.test(planText)) {
      bonusTotal += signal.bonus;
    }
  }

  // Check palette complexity
  const paletteCount = plan.colorPalette.length;
  if (paletteCount > 5) penaltyTotal += (paletteCount - 5) * 8;
  if (paletteCount <= 3) bonusTotal += 10;

  // Raw restraint score
  const raw = Math.max(0, Math.min(100, 80 - penaltyTotal + bonusTotal));

  // Identify the "boldest element" (what would be removed first)
  const boldestElement = identifyBoldestElement(plan, flaggedSignals);
  const boldestSubject = /^the\b/i.test(boldestElement) ? boldestElement : `the ${boldestElement}`;

  // Verdict
  let verdict: RestraintVerdict;
  let reasoning: string;
  let suggestion: string | null = null;

  if (raw >= 70) {
    verdict = "disciplined";
    reasoning = `The plan demonstrates genuine restraint. ${boldestSubject} is purposeful and has a clear structural role, not purely decorative. Removing it would weaken the design, not strengthen it. This is the Rams test passed.`;
  } else if (raw >= 45) {
    verdict = "restrained-further";
    const primary = flaggedSignals[0];
    reasoning = `The plan is close to disciplined but carries some decorative weight. ${primary ? `The '${primary}' element in particular` : "The signature element"} could be questioned: does it serve the communication goal, or is it boldness for its own sake?`;
    suggestion = primary
      ? `Consider removing or reducing '${primary}'. Ask: if this element didn't exist, would the brief's job still be accomplished? If yes, remove it.`
      : `The signature element is strong but the overall plan has accumulated complexity. Simplify one non-essential decision.`;
  } else {
    verdict = "over-designed";
    reasoning = `The plan has accumulated multiple bold elements that compete for attention. ${flaggedSignals.slice(0, 2).join(", ")} are present simultaneously. True boldness is a single clear decision — everything else is noise.`;
    suggestion = `Remove ${flaggedSignals[0] ?? "the most decorative element"} entirely. Rams rule: "when in doubt, leave it out." A design with one bold decision is stronger than one with five.`;
  }

  return {
    verdict,
    boldestElement,
    reasoning,
    suggestion,
    restraintScore: raw,
  };
}

function identifyBoldestElement(plan: DesignPlanInput, flaggedSignals: string[]): string {
  // If we flagged something specific, that's the boldest element
  if (flaggedSignals.length > 0) {
    return flaggedSignals[0].split("(")[0].trim();
  }

  // Otherwise the signature element is by definition the boldest
  return plan.signatureElement.name || "signature element";
}

// Restraint grade
export function restraintGrade(score: number): string {
  if (score >= 85) return "S"; // Exemplary restraint
  if (score >= 70) return "A"; // Disciplined
  if (score >= 55) return "B"; // Mostly disciplined
  if (score >= 40) return "C"; // Could be simplified
  return "D";                  // Over-designed
}
