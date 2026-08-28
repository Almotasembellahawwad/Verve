export const GENERATION_MODES = ["fast", "studio"] as const;

export type GenerationMode = (typeof GENERATION_MODES)[number];

/** Fast is the honest default for first-pass exploration and free routed capacity. */
export const DEFAULT_GENERATION_MODE: GenerationMode = "fast";
