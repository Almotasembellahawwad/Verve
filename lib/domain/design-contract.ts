export const DESIGN_CONTRACT_VERSION = 1 as const;
export const DESIGN_CONTRACT_PATH = "DESIGN-CONTRACT.json";
export const DESIGN_COLOR_ROLES = ["surface", "surfaceRaised", "textPrimary", "textMuted", "accent"] as const;
/** Shared identity and executable tokens; scene composition may vary inside this identity. */
export type DesignContract = {
  version: typeof DESIGN_CONTRACT_VERSION;
  identity: {
    directionId: string; concept: string;
    experienceModel: "narrative-scroll" | "spatial-map" | "task-workbench" | "guided-conversation" | "collection-browser" | "live-canvas";
    opening: string; navigation: string;
    signature: { name: string; mechanism: string; purpose: string };
  };
  palette: Array<{ name: string; hex: string; role: string }>;
  colorRoles: Record<(typeof DESIGN_COLOR_ROLES)[number], string>;
  typography: { display: string; body: string; mono?: string; profileId?: string; script?: "latin" | "arabic" | "mixed"; policy: "bundled-contract" | "legacy-unverified" };
  spatial: { density: "airy" | "balanced" | "dense"; system: string; rhythm: string; spacingRem: number[] };
  imageLanguage: string;
  materialVocabulary: string[];
  motion: { choreography: string; reducedMotionRequired: true };
  sceneIds: string[];
  refinement: { preserve: string[]; sceneVariation: string[] };
};

export function designContractTokens(contract: DesignContract): Record<string, string> {
  if (!DESIGN_COLOR_ROLES.every((role) => /^#[a-f0-9]{6}$/i.test(contract.colorRoles[role]))
    || contract.spatial.spacingRem.length !== 6 || !contract.spatial.spacingRem.every((value) => Number.isFinite(value) && value > 0 && value <= 16)) throw new Error("Unsafe design tokens.");
  const valid = contract;
  return {
    ...Object.fromEntries(DESIGN_COLOR_ROLES.map((role) => [
      `--verve-color-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, valid.colorRoles[role],
    ])),
    ...Object.fromEntries(valid.spatial.spacingRem.map((value, index) => [`--verve-space-${index + 1}`, `${value}rem`])),
  };
}

export function designContractCss(contract: DesignContract): string {
  return `/* Verve Design Contract v${contract.version} */\n:root {\n${Object.entries(designContractTokens(contract)).map(([name, value]) => `  ${name}: ${value};`).join("\n")}\n}\n`;
}
