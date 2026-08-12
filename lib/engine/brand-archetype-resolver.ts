// =========================================================
// lib/engine/brand-archetype-resolver.ts
// Module I: Brand Archetype Resolver
//
// Based on: Carl Jung's 12 Archetypes as applied to brand
// identity strategy (Carol Pearson, Margaret Mark —
// "The Hero and the Outlaw: Building Extraordinary Brands
// Through the Power of Archetypes", 2001)
//
// Pipeline position: BEFORE Plan Generator
// [01] Brief Analyzer
// [02] Asset Sourcer
// [02.5] Brand Archetype Resolver  ← THIS MODULE
// [03] Blocklist Filter
// [04] Plan Generator (receives archetype as constraint)
// =========================================================

import { getLLMAdapter } from "../llm-adapter";
import type { BriefAnalysis } from "./brief-analyzer";

// ── The 12 Archetypes ────────────────────────────────────────────────────────
export type ArchetypeId =
  | "ruler"      // Control, authority, prestige — Rolex, Mercedes, McKinsey
  | "creator"    // Innovation, craft, imagination — Adobe, LEGO, Dyson
  | "explorer"   // Adventure, freedom, discovery — Patagonia, Jeep, National Geographic
  | "sage"       // Wisdom, knowledge, truth — Google, BBC, The Economist
  | "hero"       // Courage, achievement, mastery — Nike, Adidas, FedEx
  | "magician"   // Transformation, vision, wonder — Disney, Tesla, TED
  | "lover"      // Beauty, intimacy, passion — Chanel, Ferrari, Airbnb
  | "rebel"      // Disruption, revolution, freedom from rules — Harley, Diesel, Vice
  | "innocent"   // Purity, honesty, optimism — Dove, Innocent, Patagonia (early)
  | "jester"     // Fun, humor, irreverence — M&Ms, Dollar Shave Club, Skittles
  | "everyman"   // Belonging, community, realness — IKEA, Target, Levi's
  | "caregiver"; // Nurturing, protection, service — Johnson's, Volvo, UNICEF

export type ArchetypeProfile = {
  id: ArchetypeId;
  name: string;
  coreDrive: string;        // what the brand fundamentally wants
  coreMessage: string;      // what it says to the world
  fear: string;             // what it avoids
  exampleBrands: string[];

  // Design implications — injected as constraints into plan generator
  design: {
    colorPersonality: string;    // color psychology guidance
    typographyPersonality: string; // type selection rationale
    layoutPersonality: string;   // spatial rhythm, grid approach
    toneOfVoice: string;         // copy style guide
    textureAndMaterial: string;  // surface quality, tactility
    avoidInDesign: string[];     // anti-patterns for this archetype
  };

  // Animation personality — used by Module K
  animation: {
    easingCharacter: string;     // describes the motion quality
    pacing: "slow" | "medium" | "fast" | "variable";
    entranceStyle: string;
    interactionResponse: string;
  };
};

// ── Full archetype catalog ────────────────────────────────────────────────────
export const ARCHETYPES: Record<ArchetypeId, ArchetypeProfile> = {
  ruler: {
    id: "ruler",
    name: "The Ruler",
    coreDrive: "Control, order, authority",
    coreMessage: "Power and stability can be yours.",
    fear: "Chaos, being overthrown, loss of control",
    exampleBrands: ["Rolex", "Mercedes-Benz", "McKinsey", "American Express"],
    design: {
      colorPersonality: "Deep, authoritative tones derived from the material of power: dark navy, aged bronze, charcoal, gold. NOT warm or approachable — cool and precise. Saturation restrained.",
      typographyPersonality: "Refined serif or precision sans. Tight letter-spacing in display. Never playful, never rounded. Type should feel like it was set by a typographer, not chosen from a dropdown.",
      layoutPersonality: "Strong vertical grid with clear hierarchy. Asymmetry only in fallow zones. Every element answers to a baseline. Generous whitespace signals confidence.",
      toneOfVoice: "Declarative statements. No questions. No hedging. Short, precise. 'We design. You inhabit.' Not 'We help you design your space.'",
      textureAndMaterial: "Stone, metal, fine leather. Surface quality references durability and age. No gradient unless it references actual material (patina, shadow).",
      avoidInDesign: [
        "Rounded corners — signals approachability, not authority",
        "Bright saturated colors — signals excitement, not stability",
        "Playful typography — signals jester, not ruler",
        "Cluttered layout — signals chaos, not control",
        "Drop shadows — signals depth uncertainty",
      ],
    },
    animation: {
      easingCharacter: "Slow, deliberate, precise — like a safe door closing",
      pacing: "slow",
      entranceStyle: "Fade with subtle upward translate (8px, 600ms, ease-in-out)",
      interactionResponse: "Minimal hover response — no bounce, no spring. Understated scale or opacity shift.",
    },
  },

  creator: {
    id: "creator",
    name: "The Creator",
    coreDrive: "Imagination, craft, originality",
    coreMessage: "If you can imagine it, it can be created.",
    fear: "Mediocrity, being derivative, constraint",
    exampleBrands: ["Adobe", "LEGO", "Dyson", "Apple (early)", "3M"],
    design: {
      colorPersonality: "Color derived from the subject matter or material of the work, not from a palette picker. Every color should be justifiable by reference to something real in the brief. Chromatic tension is welcome.",
      typographyPersonality: "Expressive pairing with clear purpose. Can use editorial serif with precision mono. The combination itself should feel intentional — not decorative but meaningful.",
      layoutPersonality: "Breaks the standard grid in principled ways. Asymmetry as argument, not accident. Columns don't align because the work doesn't align neatly — and that's honest.",
      toneOfVoice: "Shows rather than tells. Specific nouns over adjectives. 'Titanium case, saphire dial' not 'beautifully crafted.' The work's specificity is the persuasion.",
      textureAndMaterial: "References the materials and processes of the actual work. A ceramicist: clay texture. A film editor: grain, scratches. Honest to the craft.",
      avoidInDesign: [
        "Generic 'creative' palettes (purple, orange — the colors of creativity-as-brand)",
        "Empty decoration that references no material",
        "Perfectly centered layout — too safe, too finished",
        "Round buttons and soft shadows — signals product UX, not craft",
      ],
    },
    animation: {
      easingCharacter: "Springy, alive, slightly unpredictable — like hand-drawn motion",
      pacing: "variable",
      entranceStyle: "Staggered children with spring physics (stiffness 200, damping 20)",
      interactionResponse: "Responsive spring on hover. Cursor-following on hero elements.",
    },
  },

  explorer: {
    id: "explorer",
    name: "The Explorer",
    coreDrive: "Freedom, adventure, discovery, authenticity",
    coreMessage: "Don't fence me in.",
    fear: "Entrapment, conformity, emptiness",
    exampleBrands: ["Patagonia", "Jeep", "National Geographic", "Levi's", "REI"],
    design: {
      colorPersonality: "Colors from the natural world — specific landscapes, not general 'earthy'. Clay of Utah, slate of Scottish coast, ochre of Saharan rock. Desaturated authenticity.",
      typographyPersonality: "Type that has history — slightly imperfect, humanist, with optical weight. Not geometric perfection. Not digital-first. Feels like it was letterpress-printed once.",
      layoutPersonality: "Expansive. Bleeds to the edge. Fullbleed photography with significant negative space. The viewport is a window, not a frame.",
      toneOfVoice: "Direct, unvarnished. First-person active. 'We made this in the field.' Not 'Our team of experts crafts premium solutions.'",
      textureAndMaterial: "Raw textile, worn leather, weathered wood, cracked clay. Material should feel touched — not pristine.",
      avoidInDesign: [
        "Perfect grids — too structured for a free spirit",
        "Corporate colors (navy, grey, burgundy)",
        "Luxury textures — signals ruler, not explorer",
        "Centered text-heavy hero — needs space and image",
      ],
    },
    animation: {
      easingCharacter: "Expansive ease-out — like a horizon opening",
      pacing: "medium",
      entranceStyle: "Parallax scroll with fade, elements entering from different directions",
      interactionResponse: "Pan and zoom on images. Smooth continuous motion.",
    },
  },

  sage: {
    id: "sage",
    name: "The Sage",
    coreDrive: "Knowledge, truth, understanding",
    coreMessage: "The truth will set you free.",
    fear: "Deception, ignorance, being misled",
    exampleBrands: ["Google", "BBC", "The Economist", "Quora", "TED"],
    design: {
      colorPersonality: "Neutral, precise, data-neutral. Colors that don't bias — cool grey, clean white, deep ink. Accent color used functionally (highlighting data, not decoration).",
      typographyPersonality: "Clear hierarchy for scanning. Reading-optimized body text. Display type that signals authority without showmanship. Size relationships are logical, not aesthetic.",
      layoutPersonality: "Information-first. Grid used to organize, not constrain. Column widths derived from readability metrics (65-75 chars per line). Nothing is there unless it informs.",
      toneOfVoice: "Evidence-led. Precise. Avoids superlatives. 'Our tests show X' not 'We believe X.' Numbers preferred to adjectives.",
      textureAndMaterial: "Paper, clean glass, structured data. Tactile textures only where they reference information (ruled lines, graph paper, index card).",
      avoidInDesign: [
        "Decorative illustration without data connection",
        "Color for atmosphere — only for information",
        "Typography that prioritizes beauty over clarity",
        "Hidden navigation — information should be findable",
      ],
    },
    animation: {
      easingCharacter: "Linear or precise ease — no spring, no bounce. Motion conveys information.",
      pacing: "fast",
      entranceStyle: "Minimal — content fades in, no dramatic translation",
      interactionResponse: "Immediate feedback. No delay. Functional hover states.",
    },
  },

  hero: {
    id: "hero",
    name: "The Hero",
    coreDrive: "Courage, achievement, proving worth through difficulty",
    coreMessage: "Where there's a will, there's a way.",
    fear: "Weakness, vulnerability, failure",
    exampleBrands: ["Nike", "Adidas", "FedEx", "Duracell", "US Army"],
    design: {
      colorPersonality: "High contrast. Bold primary colors used with confidence. Black and white as a foundation with a single saturated accent that hits hard. Not subtle.",
      typographyPersonality: "Strong, extended, condensed display. Type that occupies space with confidence. Tight tracking on headings. Body text clean and efficient.",
      layoutPersonality: "Dynamic asymmetry. Diagonal energy. The layout moves. Grid breaks are purposeful — like a sprinter leaning into a turn.",
      toneOfVoice: "Active verbs. Short sentences. Commands. 'Do it.' 'Be more.' Motivational without being saccharine.",
      textureAndMaterial: "Carbon fibre, anodized metal, reinforced rubber. Performance materials. Anti-decorative.",
      avoidInDesign: [
        "Soft edges and rounded corners — signals comfort, not challenge",
        "Pastel colors — signals gentleness",
        "Long explanatory text in hero",
        "Playful illustration",
      ],
    },
    animation: {
      easingCharacter: "Powerful ease-out — fast onset, confident settle",
      pacing: "fast",
      entranceStyle: "Translate from below with strong ease-out (400ms). Impact on arrival.",
      interactionResponse: "Bold hover scale or color shift. Immediate. Confident.",
    },
  },

  magician: {
    id: "magician",
    name: "The Magician",
    coreDrive: "Transformation, vision, making dreams reality",
    coreMessage: "It can happen.",
    fear: "Negative side effects, unintended consequences",
    exampleBrands: ["Disney", "Tesla", "TED", "Dyson", "Polaroid"],
    design: {
      colorPersonality: "Unexpected combinations that feel like they shouldn't work — but do. Deep and luminous. Color that shifts with context. Not obviously 'magical' (no sparkles).",
      typographyPersonality: "Type that creates tension between familiar and strange. Can use unexpected optical sizes. Variable fonts where weight shifts mid-word.",
      layoutPersonality: "Transformation is the principle. Sections transform into each other on scroll. The viewer moves through states, not pages.",
      toneOfVoice: "Wonder without naivety. 'Imagine' not 'We offer.' Creates anticipation before the reveal.",
      textureAndMaterial: "Light itself — refractions, lens flares, gradients that reference light physics. Depth through overlay, not shadow.",
      avoidInDesign: [
        "Literal 'magic' visual metaphors (stars, sparkles)",
        "Static layout — transformation needs motion",
        "High-contrast hard edges — softness enables transformation",
        "Information-heavy landing — mystery first",
      ],
    },
    animation: {
      easingCharacter: "Cubic bezier with overshoot. Elements arrive beyond target then settle.",
      pacing: "variable",
      entranceStyle: "Transform + filter change (blur to sharp, scale from 0.9)",
      interactionResponse: "Morphing states. Cursor trails. Parallax depth.",
    },
  },

  lover: {
    id: "lover",
    name: "The Lover",
    coreDrive: "Beauty, intimacy, passion, sensory experience",
    coreMessage: "You deserve pleasure.",
    fear: "Being unwanted, loveless, out of touch",
    exampleBrands: ["Chanel", "Ferrari", "Airbnb", "Godiva", "Victoria's Secret"],
    design: {
      colorPersonality: "Rich, warm, sensory. Colors reference desire and tactile pleasure: warm ivory, blush, deep rose, amber, velvet black. Saturation that suggests warmth, not aggression.",
      typographyPersonality: "Elegant, refined. Display serif with calligraphic quality. Body text intimate — small, careful, as if whispered. Letter-spacing that breathes.",
      layoutPersonality: "Intimate scale. Close crops on photography. Space that feels like proximity, not emptiness. Asymmetry that leans in.",
      toneOfVoice: "Sensory. Second person. 'You.' Addresses desire directly. 'You'll want to stay.' Not 'Our spaces are comfortable.'",
      textureAndMaterial: "Silk, velvet, warm cashmere, polished stone. Smooth surfaces with warmth. Nothing rough or utilitarian.",
      avoidInDesign: [
        "Clinical whites and sharp edges — signals medical/sterile",
        "Bold geometric type — signals hero, not lover",
        "Data-heavy layout — signals sage, not intimacy",
        "Cool blues and greys without warmth",
      ],
    },
    animation: {
      easingCharacter: "Slow, sensual, ease-in-out with long duration",
      pacing: "slow",
      entranceStyle: "Gentle fade + subtle scale from 0.97. Unhurried.",
      interactionResponse: "Smooth, lingering transitions. Hover states that linger.",
    },
  },

  rebel: {
    id: "rebel",
    name: "The Rebel",
    coreDrive: "Disruption, revolution, freedom from convention",
    coreMessage: "Rules are made to be broken.",
    fear: "Powerlessness, conformity, being ordinary",
    exampleBrands: ["Harley-Davidson", "Diesel", "Vice", "Banksy", "Supreme"],
    design: {
      colorPersonality: "Deliberately wrong combinations that signal rule-breaking. Not color-theory-approved palettes — chromatic tension, near-clashes. Black dominant with a color that shouldn't work.",
      typographyPersonality: "Type that violates conventions. Clashing sizes, unexpected rotations, text that intrudes into images. Each typographic decision answers: 'what would the cautious designer never do?'",
      layoutPersonality: "Anti-grid. Elements that refuse to align. Collisions as design decisions. Space that feels confrontational, not comfortable.",
      toneOfVoice: "Direct, provocative, unfiltered. Short. Often incomplete sentences. Uses 'we' to mean the audience, not the brand.",
      textureAndMaterial: "Raw, unfinished, deliberately imperfect. Photocopier texture, ripped edges, spray paint. Anti-luxury.",
      avoidInDesign: [
        "Beautiful color harmony — signals acceptance of convention",
        "Clean grid layout — signals corporate",
        "Refined typography — signals politeness",
        "Whitespace as luxury — signals ruler archetype",
      ],
    },
    animation: {
      easingCharacter: "Abrupt, glitchy, stepped. Refuses smooth transitions.",
      pacing: "variable",
      entranceStyle: "Glitch effect or abrupt cut. No graceful fade.",
      interactionResponse: "Unexpected behavior. Elements that resist or over-respond to hover.",
    },
  },

  innocent: {
    id: "innocent",
    name: "The Innocent",
    coreDrive: "Purity, goodness, optimism, trust",
    coreMessage: "Life is simple. Be happy.",
    fear: "Doing something wrong, being corrupt",
    exampleBrands: ["Dove", "Innocent Drinks", "Seventh Generation", "Disney (classic)"],
    design: {
      colorPersonality: "Light, clean, honest. White as a primary. Soft naturals. Nothing sharp or aggressive. Colors of sunlight, clean water, fresh paper.",
      typographyPersonality: "Friendly, clear, slightly rounded. Type that a person could have written. Warmth without childishness.",
      layoutPersonality: "Simple, spacious, symmetrical or gently asymmetric. Nothing that requires effort to understand.",
      toneOfVoice: "Warm, direct, honest. No jargon. 'Made with real ingredients.' Simple declarations.",
      textureAndMaterial: "Paper, linen, natural wood, fresh cotton. Honest materials.",
      avoidInDesign: [
        "Dark backgrounds — signals danger or sophistication",
        "Complex information architecture",
        "Irony or ambiguity in copy",
        "Heavy textures or aged materials",
      ],
    },
    animation: {
      easingCharacter: "Gentle bounce, friendly ease. Like a smile in motion.",
      pacing: "medium",
      entranceStyle: "Soft fade with gentle upward float",
      interactionResponse: "Cheerful, quick response. Slight bounce on activation.",
    },
  },

  jester: {
    id: "jester",
    name: "The Jester",
    coreDrive: "Fun, humor, lightness, living in the moment",
    coreMessage: "You only live once.",
    fear: "Boredom, seriousness, being ordinary",
    exampleBrands: ["M&Ms", "Dollar Shave Club", "Skittles", "Old Spice", "Duolingo"],
    design: {
      colorPersonality: "Irreverent combinations. High saturation. Color used for delight, not meaning. Multiple colors coexisting without hierarchy.",
      typographyPersonality: "Playful without being childish. Unexpected weights, sizes. Type that has personality of its own — not servant of content.",
      layoutPersonality: "Dynamic, dense, energetic. Things overlap. Nothing takes itself too seriously.",
      toneOfVoice: "Punchline structure. Self-aware. Uses humor as the primary persuasion tool. Never explains the joke.",
      textureAndMaterial: "Bright plastic, party supplies, game pieces. Shiny and fun.",
      avoidInDesign: [
        "Restrained palettes — signals seriousness",
        "Long body text — kills the timing",
        "Architectural grids — signals ruler",
        "Luxury materials — signals lover or ruler",
      ],
    },
    animation: {
      easingCharacter: "Springy, bouncy, exaggerated. Over-the-top ease.",
      pacing: "fast",
      entranceStyle: "Bounce-in with overshoot. Animated characters.",
      interactionResponse: "Playful micro-interactions. Sound optional. Unexpected results.",
    },
  },

  everyman: {
    id: "everyman",
    name: "The Everyman",
    coreDrive: "Belonging, community, being real, fitting in",
    coreMessage: "Everyone deserves a place here.",
    fear: "Being left out, standing out, elitism",
    exampleBrands: ["IKEA", "Target", "Levi's", "eBay", "Amazon"],
    design: {
      colorPersonality: "Accessible, familiar. Primary colors used in their approachable form. Not luxury, not neon. The color of a clean, well-lit space.",
      typographyPersonality: "Legible above all. Friendly but not playful. The kind of type anyone can read. Size generous for accessibility.",
      layoutPersonality: "Organized, predictable, intuitive. The user should never have to think. Grid is a service, not a design statement.",
      toneOfVoice: "Friendly, clear, unpretentious. We/you language. 'For everyone.' 'Just works.'",
      textureAndMaterial: "Clean and practical. Functional surfaces. Nothing intimidating.",
      avoidInDesign: [
        "Luxury aesthetics — signals exclusion",
        "Complex navigation or hidden features",
        "Insider language or jargon",
        "Small text or low contrast",
      ],
    },
    animation: {
      easingCharacter: "Smooth, predictable, no surprises. Reliable ease.",
      pacing: "medium",
      entranceStyle: "Simple fade in. Nothing unexpected.",
      interactionResponse: "Clear, immediate, functional feedback.",
    },
  },

  caregiver: {
    id: "caregiver",
    name: "The Caregiver",
    coreDrive: "Nurturing, protection, service to others",
    coreMessage: "Love your neighbor as yourself.",
    fear: "Selfishness, ingratitude, harm to others",
    exampleBrands: ["Johnson's", "Volvo", "UNICEF", "WWF", "Huggies"],
    design: {
      colorPersonality: "Warm, gentle, reassuring. Soft blues, warm whites, gentle greens. Colors that signal safety and care. Nothing aggressive.",
      typographyPersonality: "Human, warm, easy to read. Round edges in letterforms. Generous line-height.",
      layoutPersonality: "Embracing layout — content centered, human-sized. Photography of people, relationships, care moments.",
      toneOfVoice: "Second-person care. 'We protect.' 'Because they deserve the best.' Protective language.",
      textureAndMaterial: "Soft fabric, warm wood, smooth natural materials. Human touch.",
      avoidInDesign: [
        "Aggressive or confrontational design",
        "Cold palettes or clinical finishes",
        "Complex information that causes stress",
        "Self-aggrandizing language",
      ],
    },
    animation: {
      easingCharacter: "Gentle, soft, reassuring. Slow ease-in-out.",
      pacing: "slow",
      entranceStyle: "Gentle fade with slow vertical float.",
      interactionResponse: "Soft, immediate, warm. No jarring changes.",
    },
  },
};

// ── LLM-based archetype resolution ───────────────────────────────────────────
const ARCHETYPE_SYSTEM_PROMPT = `You are a brand strategist specializing in Jungian brand archetypes.
Given a design brief, identify the PRIMARY brand archetype and optionally a SECONDARY archetype.

The 12 archetypes are: ruler, creator, explorer, sage, hero, magician, lover, rebel, innocent, jester, everyman, caregiver.

Key distinctions:
- "ruler" vs "hero": ruler = authority and stability, hero = achievement through effort
- "creator" vs "magician": creator = craft and originality, magician = transformation and vision
- "sage" vs "ruler": sage = knowledge and truth, ruler = power and control
- "lover" vs "caregiver": lover = desire and beauty, caregiver = protection and nurturing

Consider:
1. What is the brand's core tension (what problem does it solve emotionally)?
2. Who is the audience and what is their primary motivation?
3. What values would make this audience trust and desire this brand?
4. What archetype would feel WRONG for this brand — and why?

Respond ONLY in valid JSON:
{
  "primaryArchetype": "archetype_id",
  "secondaryArchetype": "archetype_id or null",
  "confidence": 0.0-1.0,
  "reasoning": "2-3 sentences explaining the choice",
  "archetypeConflict": "which archetype to avoid and why",
  "emotionalJob": "the emotional job-to-be-done this brand fulfills (Jobs-to-be-Done framing)"
}`;

export type ArchetypeResolution = {
  primaryArchetype: ArchetypeId;
  secondaryArchetype: ArchetypeId | null;
  confidence: number;
  reasoning: string;
  archetypeConflict: string;
  emotionalJob: string;        // JTBD framing
  primaryProfile: ArchetypeProfile;
  secondaryProfile: ArchetypeProfile | null;
  designConstraints: string;   // formatted for LLM injection
  animationConstraints: string; // formatted for animation module
};

export async function resolveArchetype(
  analysis: BriefAnalysis
): Promise<ArchetypeResolution> {
  const llm = getLLMAdapter();

  const prompt = `Brief to analyze:
Subject: ${analysis.subject}
Audience: ${analysis.audience}
Primary Job (functional): ${analysis.primaryJob}
Tone: ${analysis.tone}
Industry: ${analysis.industry}
Constraints: ${analysis.constraints.join(", ") || "none"}

Identify the brand archetype.`;

  const raw = await llm.complete([{ role: "user", content: prompt }], {
    systemPrompt: ARCHETYPE_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 800,
    reasoningEffort: "low", // Classification from 12 options — no deep reasoning needed
  });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Archetype resolver returned invalid JSON");

  const parsed = JSON.parse(match[0]) as {
    primaryArchetype: ArchetypeId;
    secondaryArchetype: ArchetypeId | null;
    confidence: number;
    reasoning: string;
    archetypeConflict: string;
    emotionalJob: string;
  };

  const primaryProfile   = ARCHETYPES[parsed.primaryArchetype] ?? ARCHETYPES.creator;
  const secondaryProfile = parsed.secondaryArchetype ? (ARCHETYPES[parsed.secondaryArchetype] ?? null) : null;

  // Build design constraints string for injection into plan generator
  const dc = primaryProfile.design;
  const designConstraints = `
=== BRAND ARCHETYPE: ${primaryProfile.name.toUpperCase()} ===
Emotional Job-to-be-Done: ${parsed.emotionalJob}
Reasoning: ${parsed.reasoning}

ARCHETYPE DESIGN CONSTRAINTS (treat these as hard requirements, not suggestions):

Color: ${dc.colorPersonality}

Typography: ${dc.typographyPersonality}

Layout: ${dc.layoutPersonality}

Voice/Copy: ${dc.toneOfVoice}

Texture/Material: ${dc.textureAndMaterial}

AVOID IN DESIGN (archetype violations):
${dc.avoidInDesign.map((a) => `- ${a}`).join("\n")}

ARCHETYPE CONFLICT — do NOT slide into "${parsed.archetypeConflict}"
${secondaryProfile ? `\nSECONDARY ARCHETYPE: ${secondaryProfile.name} — blend as a counterpoint, not as the primary voice.` : ""}
=== END ARCHETYPE CONSTRAINTS ===
`;

  // Build animation constraints for Module K
  const animConstraints = `
archetype: ${primaryProfile.id}
easing: ${primaryProfile.animation.easingCharacter}
pacing: ${primaryProfile.animation.pacing}
entrance: ${primaryProfile.animation.entranceStyle}
interaction: ${primaryProfile.animation.interactionResponse}
`;

  return {
    ...parsed,
    primaryProfile,
    secondaryProfile,
    designConstraints,
    animationConstraints: animConstraints,
  };
}

/** Inject archetype design constraints into the blocklist system prompt injection */
export function formatArchetypeForPlanGenerator(resolution: ArchetypeResolution): string {
  return resolution.designConstraints;
}
