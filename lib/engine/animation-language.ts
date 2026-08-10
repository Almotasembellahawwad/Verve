// =========================================================
// lib/engine/animation-language.ts
// Module K: Animation Language System
//
// Based on: Temporal design principles — animation as a
// design token, not an afterthought.
//
// Reference:
//   - Disney's 12 Principles of Animation (Ollie Johnston,
//     Frank Thomas — "The Illusion of Life", 1981)
//   - Val Head — "Designing Interface Animation" (2016)
//   - Rachel Nabors — "Web Animation at Work" (2015)
//
// Pipeline position: After Archetype Resolver, injected into
// both Plan Generator and Code Generator.
// =========================================================

import type { ArchetypeId, ArchetypeResolution } from "./brand-archetype-resolver";

// ── Core animation token types ────────────────────────────────────────────────
export type EasingCurve = {
  name: string;
  css: string;         // cubic-bezier(x1,y1,x2,y2) or named
  description: string;
};

export type DurationScale = {
  instant:    number;  // ms — state confirmations
  fast:       number;  // ms — micro-interactions
  medium:     number;  // ms — element transitions
  slow:       number;  // ms — page-level transitions
  dramatic:   number;  // ms — hero/signature animations
};

export type EntranceAnimation = {
  name: string;
  cssKeyframes: string;      // @keyframes definition
  defaultDuration: number;
  defaultEasing: string;
  staggerDelay: number;      // ms between children
  description: string;
};

export type AnimationLanguage = {
  archetypeId: ArchetypeId;

  // Primary easing — used for most transitions
  primaryEasing: EasingCurve;
  // Secondary easing — used for interactive responses
  interactionEasing: EasingCurve;

  // Duration scale
  durations: DurationScale;

  // Entrance animation for page elements
  entrance: EntranceAnimation;

  // CSS custom properties injection string
  cssTokens: string;

  // CSS @keyframes injection string
  keyframes: string;

  // Utility classes string (inject into <style>)
  utilityClasses: string;

  // Code generator hint — describes animation philosophy
  codeGenHint: string;
};

// ── Easing library ────────────────────────────────────────────────────────────
const EASINGS: Record<string, EasingCurve> = {
  // Authority / precision
  ruler_ease: {
    name: "ruler-ease",
    css: "cubic-bezier(0.25, 0.1, 0.25, 1.0)",
    description: "Deliberate, controlled. Nothing reckless.",
  },
  // Spring / craft
  creator_spring: {
    name: "creator-spring",
    css: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    description: "Springy with slight overshoot — alive, handcrafted quality.",
  },
  // Expansive / horizon
  explorer_open: {
    name: "explorer-open",
    css: "cubic-bezier(0.0, 0.0, 0.2, 1)",
    description: "Fast onset, long settle — like a landscape opening.",
  },
  // Precise / immediate
  sage_linear: {
    name: "sage-linear",
    css: "cubic-bezier(0.4, 0.0, 0.6, 1)",
    description: "Symmetric, information-neutral. Motion conveys state, not emotion.",
  },
  // Powerful / impact
  hero_impact: {
    name: "hero-impact",
    css: "cubic-bezier(0.0, 0.0, 0.2, 1)",
    description: "Fast, decisive, confident. Arrives with purpose.",
  },
  // Transformative / magical
  magician_morph: {
    name: "magician-morph",
    css: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    description: "Overshoot and settle — transformation complete.",
  },
  // Sensual / slow
  lover_linger: {
    name: "lover-linger",
    css: "cubic-bezier(0.76, 0, 0.24, 1)",
    description: "Slow at both ends, unhurried. Motion as pleasure.",
  },
  // Abrupt / punk
  rebel_cut: {
    name: "rebel-cut",
    css: "steps(4, end)",
    description: "Stepped, anti-smooth. Refuses the convention of ease.",
  },
  // Friendly / gentle
  innocent_float: {
    name: "innocent-float",
    css: "cubic-bezier(0.34, 1.4, 0.64, 1)",
    description: "Light bounce. Happy, gentle arrival.",
  },
  // Bouncy / fun
  jester_bounce: {
    name: "jester-bounce",
    css: "cubic-bezier(0.34, 1.8, 0.64, 1)",
    description: "Big overshoot. Playful, energetic, can't sit still.",
  },
  // Reliable / simple
  everyman_smooth: {
    name: "everyman-smooth",
    css: "ease",
    description: "Simple, predictable, reliable. No surprises.",
  },
  // Gentle / soft
  caregiver_soft: {
    name: "caregiver-soft",
    css: "cubic-bezier(0.76, 0, 0.24, 1)",
    description: "Gentle deceleration. Safe, unhurried.",
  },
};

// ── Archetype → animation config map ─────────────────────────────────────────
function buildLanguage(archetypeId: ArchetypeId): AnimationLanguage {
  const configs: Record<
    ArchetypeId,
    {
      primary: string;
      interaction: string;
      durations: DurationScale;
      entranceName: string;
      entranceDuration: number;
      entranceStagger: number;
      keyframesName: string;
      codeGenHint: string;
    }
  > = {
    ruler: {
      primary: "ruler_ease",
      interaction: "ruler_ease",
      durations: { instant: 80, fast: 200, medium: 450, slow: 700, dramatic: 1000 },
      entranceName: "fadeRise",
      entranceDuration: 600,
      entranceStagger: 80,
      keyframesName: "fadeRise",
      codeGenHint:
        "Use animation sparingly. Every motion must be intentional. Prefer opacity transitions over translate. Never animate multiple properties simultaneously unless they form a single gesture. Default duration: 450ms.",
    },
    creator: {
      primary: "creator_spring",
      interaction: "creator_spring",
      durations: { instant: 60, fast: 180, medium: 380, slow: 600, dramatic: 900 },
      entranceName: "springUp",
      entranceDuration: 500,
      entranceStagger: 60,
      keyframesName: "springUp",
      codeGenHint:
        "Animation should feel alive. Use spring physics where available. Stagger children on entrance. Allow subtle cursor-following on hero elements using JS. Each animation should feel like it was drawn by hand.",
    },
    explorer: {
      primary: "explorer_open",
      interaction: "explorer_open",
      durations: { instant: 100, fast: 220, medium: 480, slow: 750, dramatic: 1200 },
      entranceName: "horizonOpen",
      entranceDuration: 700,
      entranceStagger: 100,
      keyframesName: "horizonOpen",
      codeGenHint:
        "Motion should feel expansive. Use parallax scroll for hero images. Translate elements from their natural direction of origin (left rail elements enter from left, bottom content rises up). Duration on the longer end.",
    },
    sage: {
      primary: "sage_linear",
      interaction: "sage_linear",
      durations: { instant: 50, fast: 150, medium: 280, slow: 450, dramatic: 600 },
      entranceName: "fadeIn",
      entranceDuration: 350,
      entranceStagger: 40,
      keyframesName: "fadeIn",
      codeGenHint:
        "Minimal animation. Only animate when it conveys information (loading state, data update, navigation). No decorative motion. If in doubt, don't animate. Duration short and purposeful.",
    },
    hero: {
      primary: "hero_impact",
      interaction: "hero_impact",
      durations: { instant: 60, fast: 160, medium: 320, slow: 500, dramatic: 800 },
      entranceName: "powerDrive",
      entranceDuration: 400,
      entranceStagger: 50,
      keyframesName: "powerDrive",
      codeGenHint:
        "Animation should feel powerful and decisive. Fast ease-out — arrives quickly, settles firmly. Use scale on hover for CTAs (1.02). Hero typography entrance should be bold — large translate from below, fast.",
    },
    magician: {
      primary: "magician_morph",
      interaction: "magician_morph",
      durations: { instant: 100, fast: 250, medium: 500, slow: 800, dramatic: 1400 },
      entranceName: "morphReveal",
      entranceDuration: 700,
      entranceStagger: 90,
      keyframesName: "morphReveal",
      codeGenHint:
        "Use filter transitions (blur: 8px → 0) combined with scale (0.92 → 1) for reveals. This creates a transformation quality. Scroll-triggered animations that transform sections into each other. Long durations for dramatic effect.",
    },
    lover: {
      primary: "lover_linger",
      interaction: "lover_linger",
      durations: { instant: 100, fast: 250, medium: 550, slow: 900, dramatic: 1400 },
      entranceName: "silkFade",
      entranceDuration: 800,
      entranceStagger: 120,
      keyframesName: "silkFade",
      codeGenHint:
        "Unhurried motion. Images should pan slowly (Ken Burns: scale 1.0→1.05 over 8s on hover). Hover states linger — use longer transition durations than usual (400ms). Motion should feel like silk, not glass.",
    },
    rebel: {
      primary: "rebel_cut",
      interaction: "rebel_cut",
      durations: { instant: 40, fast: 100, medium: 200, slow: 350, dramatic: 600 },
      entranceName: "glitchIn",
      entranceDuration: 300,
      entranceStagger: 30,
      keyframesName: "glitchIn",
      codeGenHint:
        "Use stepped animation (steps(4, end)) for abrupt motion. Add glitch effect on hover (brief translate ±2px on X, color channel shift). Refuse smooth ease. Short durations. Some elements should animate with no transition at all.",
    },
    innocent: {
      primary: "innocent_float",
      interaction: "innocent_float",
      durations: { instant: 80, fast: 200, medium: 400, slow: 650, dramatic: 900 },
      entranceName: "floatUp",
      entranceDuration: 500,
      entranceStagger: 70,
      keyframesName: "floatUp",
      codeGenHint:
        "Gentle float-up on entrance. Slight bounce on CTAs. Nothing jarring. Hover should feel like a smile — immediate but soft. Keep animation simple and friendly.",
    },
    jester: {
      primary: "jester_bounce",
      interaction: "jester_bounce",
      durations: { instant: 60, fast: 160, medium: 340, slow: 550, dramatic: 800 },
      entranceName: "bounceIn",
      entranceDuration: 450,
      entranceStagger: 40,
      keyframesName: "bounceIn",
      codeGenHint:
        "Generous overshoot on all animations. Elements should bounce on arrival. CTAs should wobble on hover. Can use @keyframes with multiple stops for bouncing effect. Keep it fun — if it feels too serious, add more bounce.",
    },
    everyman: {
      primary: "everyman_smooth",
      interaction: "everyman_smooth",
      durations: { instant: 80, fast: 180, medium: 350, slow: 550, dramatic: 800 },
      entranceName: "simpleFade",
      entranceDuration: 400,
      entranceStagger: 60,
      keyframesName: "simpleFade",
      codeGenHint:
        "Keep it simple and reliable. Standard fade or slide transitions. Nothing unexpected. Duration in the middle range. The goal is clarity and predictability, not delight.",
    },
    caregiver: {
      primary: "caregiver_soft",
      interaction: "caregiver_soft",
      durations: { instant: 100, fast: 220, medium: 500, slow: 800, dramatic: 1200 },
      entranceName: "gentleRise",
      entranceDuration: 600,
      entranceStagger: 90,
      keyframesName: "gentleRise",
      codeGenHint:
        "Soft, reassuring motion. Slow fade-in with gentle upward float. Hover states warm and immediate. Never jarring. Motion should feel like an embrace, not a performance.",
    },
  };

  const cfg = configs[archetypeId] ?? configs.creator;
  const primary = EASINGS[cfg.primary] ?? EASINGS.everyman_smooth;
  const interaction = EASINGS[cfg.interaction] ?? primary;

  // Build @keyframes
  const keyframesMap: Record<string, string> = {
    fadeRise:    `@keyframes fadeRise    { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`,
    springUp:    `@keyframes springUp    { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }`,
    horizonOpen: `@keyframes horizonOpen { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }`,
    fadeIn:      `@keyframes fadeIn      { from { opacity: 0; } to { opacity: 1; } }`,
    powerDrive:  `@keyframes powerDrive  { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }`,
    morphReveal: `@keyframes morphReveal { from { opacity: 0; transform: scale(0.92); filter: blur(8px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }`,
    silkFade:    `@keyframes silkFade    { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`,
    glitchIn:    `@keyframes glitchIn    { 0% { opacity: 0; transform: translateX(-4px); } 25% { opacity: 1; transform: translateX(2px); } 50% { transform: translateX(-1px); } 100% { opacity: 1; transform: translateX(0); } }`,
    floatUp:     `@keyframes floatUp     { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`,
    bounceIn:    `@keyframes bounceIn    { 0% { opacity: 0; transform: translateY(24px) scale(0.9); } 70% { transform: translateY(-6px) scale(1.02); } 100% { opacity: 1; transform: translateY(0) scale(1); } }`,
    simpleFade:  `@keyframes simpleFade  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`,
    gentleRise:  `@keyframes gentleRise  { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`,
  };

  const kfName = cfg.keyframesName as keyof typeof keyframesMap;
  const keyframes = keyframesMap[kfName] ?? keyframesMap.fadeIn;

  // CSS custom properties
  const cssTokens = `
  /* ── Module K: Animation Language (${archetypeId}) ── */
  --ease-primary:     ${primary.css};
  --ease-interaction: ${interaction.css};
  --dur-instant:      ${cfg.durations.instant}ms;
  --dur-fast:         ${cfg.durations.fast}ms;
  --dur-medium:       ${cfg.durations.medium}ms;
  --dur-slow:         ${cfg.durations.slow}ms;
  --dur-dramatic:     ${cfg.durations.dramatic}ms;
  --anim-stagger:     ${cfg.entranceStagger}ms;`;

  // Utility classes
  const utilityClasses = `
/* ── Scroll reveal (archetype: ${archetypeId}) ── */
.reveal {
  opacity: 0;
  animation: none;
}
.reveal.visible {
  animation: ${kfName} var(--dur-${cfg.durations.medium < 400 ? "medium" : "slow"}) var(--ease-primary) forwards;
}
.reveal.visible:nth-child(1) { animation-delay: calc(0 * var(--anim-stagger)); }
.reveal.visible:nth-child(2) { animation-delay: calc(1 * var(--anim-stagger)); }
.reveal.visible:nth-child(3) { animation-delay: calc(2 * var(--anim-stagger)); }
.reveal.visible:nth-child(4) { animation-delay: calc(3 * var(--anim-stagger)); }
.reveal.visible:nth-child(5) { animation-delay: calc(4 * var(--anim-stagger)); }
.reveal.visible:nth-child(6) { animation-delay: calc(5 * var(--anim-stagger)); }

/* Interactive transitions */
a, button, [role="button"] {
  transition: all var(--dur-fast) var(--ease-interaction);
}`;

  const entranceDuration = cfg.entranceDuration;

  const entrance: EntranceAnimation = {
    name: cfg.entranceName,
    cssKeyframes: keyframes,
    defaultDuration: entranceDuration,
    defaultEasing: primary.css,
    staggerDelay: cfg.entranceStagger,
    description: primary.description,
  };

  return {
    archetypeId,
    primaryEasing: primary,
    interactionEasing: interaction,
    durations: cfg.durations,
    entrance,
    cssTokens,
    keyframes,
    utilityClasses,
    codeGenHint: cfg.codeGenHint,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────
export function buildAnimationLanguage(resolution: ArchetypeResolution): AnimationLanguage {
  return buildLanguage(resolution.primaryArchetype);
}

/** Format animation language for injection into code generator prompt */
export function formatAnimationForCodeGen(lang: AnimationLanguage): string {
  return `
=== ANIMATION LANGUAGE SYSTEM (Module K — Archetype: ${lang.archetypeId}) ===
Philosophy: ${lang.primaryEasing.description}

${lang.codeGenHint}

CSS Custom Properties to inject into :root {}:
${lang.cssTokens}

@keyframes to add to <style>:
${lang.keyframes}

Duration Reference:
  Instant (state confirm):  ${lang.durations.instant}ms
  Fast (micro-interaction): ${lang.durations.fast}ms
  Medium (element enter):   ${lang.durations.medium}ms
  Slow (section enter):     ${lang.durations.slow}ms
  Dramatic (hero/signature):${lang.durations.dramatic}ms

Stagger delay between children: ${lang.entrance.staggerDelay}ms
Primary easing: ${lang.primaryEasing.css}
Interaction easing: ${lang.interactionEasing.css}
=== END ANIMATION LANGUAGE ===
`;
}
