import type { PublicDemoId } from "./public-demo-gallery";

export const EXAMPLE_STORIES: Record<PublicDemoId, {
  opening: string;
  categoryDefault: string;
  decision: string;
  audienceMoment: string;
}> = {
  architecture: {
    opening: "What if an architecture practice began with what must remain—not what it wants to add?",
    categoryDefault: "Architecture portfolios usually lead with immaculate renders, prestige language, and finished objects. The decision method disappears behind the image grid.",
    decision: "Move proof from image quality to decision quality. Coordinates, retention registers, and a survey-first method make adaptive reuse an intellectual position.",
    audienceMoment: "A developer arrives expecting a portfolio and leaves understanding how Reframe decides whether a building should change at all.",
  },
  cairo: {
    opening: "What if a restaurant identity felt like a place before a single photograph arrived?",
    categoryDefault: "Hospitality templates depend on food photography, fashionable serif type, and a reservation button floating above generic promises.",
    decision: "Let language, menu provenance, Arabic reading order, and one solar table-mark create the place. Photography can deepen the world later without inventing it.",
    audienceMoment: "A guest moves from atmosphere to dishes to story to visit details in the same rhythm they would discover the restaurant itself.",
  },
  carbon: {
    opening: "What if carbon software looked accountable before it looked sustainable?",
    categoryDefault: "Climate SaaS repeatedly reaches for leaf icons, green gradients, optimistic impact claims, and dashboard cards detached from each number’s source.",
    decision: "Put source, owner, status, and action before the marketing claim. Acid color marks operational state—not virtue.",
    audienceMoment: "An operator sees where a number came from, who owns the exception, and what must happen next before reading any marketing claim.",
  },
};
