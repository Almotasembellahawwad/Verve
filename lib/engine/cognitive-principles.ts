// =========================================================
// lib/engine/cognitive-principles.ts
// Scientific HCI/UX principles grounding every design decision
// Sources:
//   - Laws of UX (Jon Yablonski)
//   - Universal Principles of Design (Lidwell, Holden, Butler)
//   - Designing with the Mind in Mind (Jeff Johnson)
// =========================================================

export type PrincipleCheck = {
  principle: string;
  source: string;
  question: string;
  passCondition: string;
  failWarning: string;
};

export type CognitivePrinciple = {
  id: string;
  name: string;
  source: string;
  coreInsight: string;
  designImplication: string;
  checks: PrincipleCheck[];
  promptFragment: string; // injected into LLM system prompts
};

// ── 1. Von Restorff Effect ──────────────────────────────────────────────────
const vonRestorff: CognitivePrinciple = {
  id: "vonRestorff",
  name: "Von Restorff Effect (Isolation Effect)",
  source: "Laws of UX — Jon Yablonski / original: Hedwig von Restorff (1933)",
  coreInsight:
    "When multiple similar objects are present, the one that differs most from the rest is most likely to be remembered.",
  designImplication:
    "A Signature Element only works if it is visually isolated enough to register as distinct. " +
    "Contrast alone is not enough — it needs spacing, scale, or position separation from surrounding elements. " +
    "Critically: it must not resemble an advertisement (attention-inhibition reflex).",
  checks: [
    {
      principle: "Von Restorff",
      source: "Laws of UX",
      question: "Is the signature element visually isolated from surrounding elements?",
      passCondition:
        "The element has at least 2 of: higher contrast, larger scale, more surrounding whitespace, or different orientation than adjacent elements.",
      failWarning:
        "Signature element blends into the surrounding layout. It needs more visual separation to register as memorable.",
    },
    {
      principle: "Von Restorff",
      source: "Laws of UX",
      question: "Does the signature element resemble a banner ad or promotional content?",
      passCondition: "The element is clearly structural/content-driven, not promotional in appearance.",
      failWarning:
        "Element may trigger ad-blindness reflex. Avoid high-contrast bordered boxes with short copy — this is the visual signature of advertising.",
    },
  ],
  promptFragment: `COGNITIVE PRINCIPLE — Von Restorff Effect:
Your "signatureElement" MUST be visually isolated to register in memory. Apply isolation through at least 2 of these:
(a) Higher contrast delta than adjacent elements
(b) Scale difference (noticeably larger or smaller)  
(c) More surrounding negative space than the rest of the layout
(d) Different orientation or axis than surrounding content
Do NOT make it look like an advertisement (bordered box + short promotional copy). It must read as structure, not promotion.`,
};

// ── 2. Signal-to-Noise Ratio ────────────────────────────────────────────────
const signalNoise: CognitivePrinciple = {
  id: "signalNoise",
  name: "Signal-to-Noise Ratio",
  source: "Universal Principles of Design — Lidwell, Holden, Butler",
  coreInsight:
    "The ratio of relevant to irrelevant information in a display. Maximize signal (useful content) and minimize noise (decorative elements that carry no meaning).",
  designImplication:
    "Every decorative element that doesn't carry semantic meaning reduces the S/N ratio. " +
    "This is NOT about minimalism — it's about intentionality. A bold decorative element that reinforces " +
    "the brand tone is signal, not noise. A soft shadow that has no semantic reason is noise.",
  checks: [
    {
      principle: "Signal-to-Noise",
      source: "Universal Principles of Design",
      question: "Does each decorative element carry semantic meaning?",
      passCondition:
        "Every non-content element (texture, border, shadow, animation) has a stated reason tied to the brand tone or content.",
      failWarning:
        "Detected decorative elements without semantic justification. Each visual element must either carry meaning or be removed.",
    },
    {
      principle: "Signal-to-Noise",
      source: "Universal Principles of Design",
      question: "Is the signal-to-noise ratio above 0.65?",
      passCondition: "More than 65% of visual weight is functional/semantic content.",
      failWarning:
        "Too much visual decoration relative to semantic content. Reduce decorative noise or add more meaningful content density.",
    },
  ],
  promptFragment: `COGNITIVE PRINCIPLE — Signal-to-Noise Ratio:
For EACH decorative decision (texture, border treatment, shadow, divider, animation), state its semantic reason.
A decorative element is "signal" if it reinforces tone, communicates hierarchy, or references the subject matter.
A decorative element is "noise" if it exists only because it "looks nice."
Noise must be eliminated. Signal must be intentional.`,
};

// ── 3. Peak-End Rule ────────────────────────────────────────────────────────
const peakEnd: CognitivePrinciple = {
  id: "peakEnd",
  name: "Peak-End Rule",
  source: "Laws of UX — Jon Yablonski / original: Kahneman & Tversky",
  coreInsight:
    "People judge an experience based on how they felt at its most intense point and at its end, " +
    "not the average of every moment throughout the experience.",
  designImplication:
    "The LAST section a visitor sees (footer area, final CTA, closing statement) must be as designed " +
    "and intentional as the hero. Generic 'contact us' footers or empty link grids are a Peak-End failure. " +
    "The signature element should appear at or near the peak (scroll depth where engagement is highest).",
  checks: [
    {
      principle: "Peak-End",
      source: "Laws of UX",
      question: "Is the final section of the page as intentional as the hero?",
      passCondition:
        "The closing section (footer or final content block) has a distinctive visual treatment or memorable closing statement — not generic link grids.",
      failWarning:
        "Final section appears to be default filler. Peak-End Rule predicts this will dominate negative memory of the entire experience.",
    },
    {
      principle: "Peak-End",
      source: "Laws of UX",
      question: "Does the signature element appear at or near the scroll peak (above the fold or mid-scroll)?",
      passCondition: "Signature element is in the top 60% of page scroll depth for maximum impact registration.",
      failWarning:
        "Signature element is buried below the fold or near the end. Move it to the peak engagement zone.",
    },
  ],
  promptFragment: `COGNITIVE PRINCIPLE — Peak-End Rule:
The LAST visual element a user sees determines 50% of their memory of the entire page.
Your layout plan MUST include a distinctive closing treatment — NOT a generic footer or link grid.
The signature element should appear in the top 60% of scroll depth (peak engagement zone).
State explicitly: "The page ends with: [specific, designed closing treatment]."`,
};

// ── 4. Aesthetic-Usability Effect ───────────────────────────────────────────
const aestheticUsability: CognitivePrinciple = {
  id: "aestheticUsability",
  name: "Aesthetic-Usability Effect",
  source: "Laws of UX — Jon Yablonski / original: Kurosu & Kashimura (1995)",
  coreInsight:
    "Users often perceive aesthetically pleasing design as design that's more usable. " +
    "This causes them to overlook actual usability problems when the design looks good.",
  designImplication:
    "The more visually bold and distinctive the design, the MORE important it is to run a separate, " +
    "aesthetics-blind usability check. Beauty conceals problems. Run Usability Floor Check independently.",
  checks: [
    {
      principle: "Aesthetic-Usability",
      source: "Laws of UX",
      question: "Does ALL text meet WCAG 2.1 AA contrast (4.5:1 for body, 3:1 for large)?",
      passCondition: "All text/background combinations achieve minimum required contrast ratios.",
      failWarning:
        "Contrast failure detected. Beauty does not compensate for illegibility. Adjust values to meet WCAG 2.1 AA minimum.",
    },
    {
      principle: "Aesthetic-Usability",
      source: "Laws of UX",
      question: "Are all interactive elements (buttons, links) at least 44×44px touch target?",
      passCondition: "All interactive elements meet the minimum touch target size regardless of visual design.",
      failWarning:
        "Interactive element too small. This is a usability failure independent of aesthetic quality.",
    },
    {
      principle: "Aesthetic-Usability",
      source: "Laws of UX",
      question: "Is body text at least 16px with line-height ≥ 1.5?",
      passCondition: "Body text is legible independent of font aesthetic choice.",
      failWarning: "Body text is too small or too compressed. Legibility is non-negotiable.",
    },
  ],
  promptFragment: `COGNITIVE PRINCIPLE — Aesthetic-Usability Effect:
Your design will be evaluated on USABILITY independently of aesthetics.
For every color choice, state: (a) text-on-background contrast ratio estimate, (b) whether it meets WCAG 2.1 AA.
Body text must be min 16px, line-height ≥ 1.5. Interactive elements must be min 44×44px touch target.
Beautiful designs that fail usability are DISQUALIFIED from high scores.`,
};

// ── 5. Gutenberg Diagram ────────────────────────────────────────────────────
const gutenberg: CognitivePrinciple = {
  id: "gutenberg",
  name: "Gutenberg Diagram (Diagonal Reading Pattern)",
  source: "Universal Principles of Design — Lidwell, Holden, Butler",
  coreInsight:
    "Western readers naturally scan layouts in a diagonal from top-left (Primary Optical Area) " +
    "to bottom-right (Terminal Anchor). The top-right and bottom-left are 'fallow zones' with lower attention.",
  designImplication:
    "Breaking grid layout is encouraged — but CTAs and key messages must remain in the " +
    "Primary Optical Area (top-left) or Terminal Anchor (bottom-right). " +
    "Breaking grid in the fallow zones is safe. Breaking it at POA or TA is disorienting.",
  checks: [
    {
      principle: "Gutenberg Diagram",
      source: "Universal Principles of Design",
      question: "Are the primary headline and main CTA in the natural eye-movement path?",
      passCondition:
        "Primary headline is in the Primary Optical Area (top-left quadrant). Main CTA is in the Terminal Anchor (bottom-right of the hero section).",
      failWarning:
        "Key elements placed outside natural eye-movement path. Bold grid-breaking is in the fallow zones only — POA and TA must remain anchored.",
    },
    {
      principle: "Gutenberg Diagram",
      source: "Universal Principles of Design",
      question: "Are unconventional layout elements confined to the fallow zones?",
      passCondition: "Grid-breaking, asymmetry, and unusual placement happen in top-right or bottom-left quadrants — not at POA or TA.",
      failWarning:
        "Unconventional layout is disrupting the primary optical path. Bold choices must not interfere with the headline-to-CTA diagonal.",
    },
  ],
  promptFragment: `COGNITIVE PRINCIPLE — Gutenberg Diagram:
Western eyes scan top-left → bottom-right (Primary Optical Area → Terminal Anchor).
RULES for your layout:
1. Primary headline: TOP-LEFT zone (not centered, not right-aligned for maximum impact)
2. Main CTA: bottom-right of hero section (Terminal Anchor)
3. Bold grid-breaking, asymmetry, unusual elements: TOP-RIGHT or BOTTOM-LEFT (fallow zones) only
4. State in your layoutConcept: "Gutenberg compliance: [how POA and TA are anchored]"`,
};

// ── Exported collection ─────────────────────────────────────────────────────
export const COGNITIVE_PRINCIPLES = {
  vonRestorff,
  signalNoise,
  peakEnd,
  aestheticUsability,
  gutenberg,
} as const;

export type PrincipleId = keyof typeof COGNITIVE_PRINCIPLES;

/** Build the full cognitive grounding injection for LLM system prompts */
export function buildCognitiveGroundingPrompt(): string {
  return `
=== COGNITIVE SCIENCE GROUNDING (MANDATORY) ===
Every design decision must be defensible against the following principles.
These are not suggestions — they are evaluation criteria.

${Object.values(COGNITIVE_PRINCIPLES)
  .map((p, i) => `${i + 1}. ${p.promptFragment}`)
  .join("\n\n")}

Your JSON response MUST include a "cognitiveGrounding" object:
{
  "cognitiveGrounding": {
    "vonRestorffCompliance": "string — how the signature element achieves visual isolation",
    "gutenbergCompliance": "string — where POA and TA are in the layout, where grid-breaking happens",
    "signalNoiseRatio": number (0.0-1.0 — estimated ratio of semantic to decorative elements),
    "peakEndDesign": "string — what the closing section looks like (NOT a generic footer)",
    "usabilityBaseline": "string — contrast estimates for primary text/bg pairs, touch target confirmation"
  }
}
=== END COGNITIVE GROUNDING ===
`;
}

/** Evaluate a completed design plan against all principles */
export function evaluateCognitiveCompliance(cognitiveGrounding: {
  vonRestorffCompliance: string;
  gutenbergCompliance: string;
  signalNoiseRatio: number;
  peakEndDesign: string;
  usabilityBaseline: string;
}): {
  passed: boolean;
  score: number; // 0–25 (5 per principle)
  failures: string[];
} {
  const failures: string[] = [];
  let score = 0;

  // Von Restorff
  if (cognitiveGrounding.vonRestorffCompliance?.length > 20) score += 5;
  else failures.push("Von Restorff: Signature element isolation not described");

  // Gutenberg
  if (cognitiveGrounding.gutenbergCompliance?.includes("POA") ||
      cognitiveGrounding.gutenbergCompliance?.length > 30) score += 5;
  else failures.push("Gutenberg: Eye-path compliance not addressed");

  // Signal-to-Noise
  const snr = cognitiveGrounding.signalNoiseRatio ?? 0;
  if (snr >= 0.65) score += 5;
  else if (snr >= 0.5) { score += 3; failures.push(`Signal-Noise: Ratio ${snr.toFixed(2)} below optimal 0.65 threshold`); }
  else failures.push(`Signal-Noise: Ratio ${snr.toFixed(2)} is too low — too much decorative noise`);

  // Peak-End
  if (cognitiveGrounding.peakEndDesign?.length > 20 &&
      !cognitiveGrounding.peakEndDesign.toLowerCase().includes("generic")) score += 5;
  else failures.push("Peak-End: Closing section not distinctively designed");

  // Usability Floor
  if (cognitiveGrounding.usabilityBaseline?.length > 20) score += 5;
  else failures.push("Aesthetic-Usability: Accessibility baseline not stated");

  return { passed: failures.length === 0, score, failures };
}
