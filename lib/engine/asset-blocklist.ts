// =========================================================
// lib/engine/asset-blocklist.ts
// Asset Cliché Blocklist — parallel to the design cliché blocklist
// Filters Pexels photo results against known stock photo clichés
// =========================================================

export type AssetCliche = {
  id: string;
  keywords: string[];      // keywords that trigger this cliché detection
  description: string;
  severity: "high" | "medium";
  avoidReason: string;
};

// ── Photo clichés ────────────────────────────────────────────────────────────
export const PHOTO_CLICHES: AssetCliche[] = [
  {
    id: "handshake",
    keywords: ["handshake", "business handshake", "agreement", "deal", "partnership hands"],
    description: "Business handshake photo",
    severity: "high",
    avoidReason: "Most overused B2B stock photo. Immediately signals generic corporate content.",
  },
  {
    id: "diverse-team-laptop",
    keywords: ["diverse team", "team meeting", "office team", "colleagues laptop", "multicultural office"],
    description: "Diverse team gathered around a laptop",
    severity: "high",
    avoidReason:
      "Second most overused stock photo. The forced diversity + laptop combo is instantly recognizable as stock photography.",
  },
  {
    id: "overhead-coffee",
    keywords: ["flat lay coffee", "overhead desk", "coffee notebook overhead", "workspace flat lay", "desk top view"],
    description: "Overhead/flat-lay desk with coffee and notebook",
    severity: "high",
    avoidReason: "Ubiquitous 'creative professional' cliché. Seen in every lifestyle/creative brand.",
  },
  {
    id: "pointing-screen",
    keywords: ["pointing screen", "man screen", "woman screen pointing", "touching screen data"],
    description: "Person pointing at or touching a transparent data screen",
    severity: "high",
    avoidReason: "Technology marketing cliché from the 2010s. No real person interacts with screens this way.",
  },
  {
    id: "suit-whiteboard",
    keywords: ["businessman whiteboard", "man suit whiteboard", "executive presentation", "business writing board"],
    description: "Business person in suit at a whiteboard",
    severity: "high",
    avoidReason: "Corporate presentation cliché. Communicates 'generic enterprise software' instantly.",
  },
  {
    id: "lightbulb-idea",
    keywords: ["lightbulb idea", "innovation lightbulb", "bright idea", "creative lightbulb"],
    description: "Lightbulb representing an idea",
    severity: "high",
    avoidReason: "The oldest visual metaphor for innovation. Universally overused.",
  },
  {
    id: "puzzle-piece",
    keywords: ["puzzle piece", "jigsaw solution", "puzzle business", "missing piece"],
    description: "Puzzle pieces as metaphor for solution",
    severity: "medium",
    avoidReason: "Generic 'solution' metaphor. Adds no specificity to any brand.",
  },
  {
    id: "rocket-launch",
    keywords: ["rocket launch startup", "startup rocket", "business rocket", "rocket growth"],
    description: "Rocket or rocket launch as growth/startup metaphor",
    severity: "medium",
    avoidReason: "Startup cliché. Every third SaaS landing page uses this.",
  },
  {
    id: "magnifier-search",
    keywords: ["magnifying glass search", "businessman magnifier", "search concept"],
    description: "Magnifying glass as search/insight metaphor",
    severity: "medium",
    avoidReason: "Overused 'research' and 'insights' visual metaphor.",
  },
  {
    id: "stock-smile-headshot",
    keywords: ["professional headshot white background", "business portrait white", "smiling professional"],
    description: "Overly posed professional headshot on white background",
    severity: "medium",
    avoidReason: "Stock headshot look. Feels inauthentic.",
  },
  {
    id: "growth-arrow",
    keywords: ["arrow growth", "rising arrow", "upward trend", "success arrow", "growth chart"],
    description: "Upward arrow representing growth",
    severity: "medium",
    avoidReason: "Completely generic. Every financial/business tool uses this.",
  },
  {
    id: "globe-network",
    keywords: ["globe network", "world map connections", "global network", "earth connections"],
    description: "Globe with network connections overlay",
    severity: "medium",
    avoidReason: "Tech company cliché for 'global reach'. Ubiquitous in enterprise software.",
  },
];

// ── Scoring function ─────────────────────────────────────────────────────────
export function scorePhotoAgainstBlocklist(
  photoDescription: string,
  photoTags: string[]
): { isCliche: boolean; clicheId?: string; severity?: "high" | "medium" } {
  const haystack = [photoDescription, ...photoTags].join(" ").toLowerCase();

  for (const cliche of PHOTO_CLICHES) {
    for (const keyword of cliche.keywords) {
      if (haystack.includes(keyword.toLowerCase())) {
        return { isCliche: true, clicheId: cliche.id, severity: cliche.severity };
      }
    }
  }

  return { isCliche: false };
}

// ── Contextual icon selection ─────────────────────────────────────────────────
// Maps industry/tone keywords to appropriate Lucide icon names
export const CONTEXTUAL_ICONS: Record<string, string[]> = {
  // Industries
  finance:     ["TrendingUp", "BarChart2", "DollarSign", "PieChart", "Shield"],
  technology:  ["Code2", "Terminal", "Cpu", "Wifi", "Zap"],
  healthcare:  ["Heart", "Activity", "Stethoscope", "Shield", "Clipboard"],
  legal:       ["Scale", "FileText", "Shield", "Book", "Landmark"],
  education:   ["BookOpen", "GraduationCap", "Brain", "Lightbulb", "Users"],
  ecommerce:   ["ShoppingBag", "Package", "Star", "CreditCard", "Truck"],
  saas:        ["Layers", "Settings", "Zap", "BarChart2", "Lock"],
  creative:    ["Palette", "Pen", "Film", "Music", "Camera"],
  environment: ["Leaf", "Sun", "Wind", "Droplets", "TreePine"],
  // Tones
  data:        ["BarChart2", "LineChart", "Database", "Table", "Hash"],
  security:    ["Lock", "Shield", "Key", "Eye", "ShieldCheck"],
  speed:       ["Zap", "Timer", "Gauge", "ArrowRight", "Rocket"],
  trust:       ["Shield", "CheckCircle", "Award", "ThumbsUp", "Star"],
  precision:   ["Target", "Crosshair", "Sliders", "Ruler", "ScanLine"],
};

export function getContextualIcons(industry: string, tone: string): string[] {
  const icons = new Set<string>();
  const haystack = `${industry} ${tone}`.toLowerCase();

  Object.entries(CONTEXTUAL_ICONS).forEach(([key, names]) => {
    if (haystack.includes(key)) {
      names.slice(0, 3).forEach((n) => icons.add(n));
    }
  });

  // Default fallback
  if (icons.size === 0) {
    ["CheckCircle", "Zap", "Star", "ArrowRight", "Shield"].forEach((n) => icons.add(n));
  }

  return Array.from(icons).slice(0, 6);
}
