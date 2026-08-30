export const GENERATION_MODES = ["fast", "creative", "studio"] as const;

export type GenerationMode = (typeof GENERATION_MODES)[number];
export type EffectiveGenerationMode = "fast" | "creative";

/** Fast is the honest default for first-pass exploration and free routed capacity. */
export const DEFAULT_GENERATION_MODE: GenerationMode = "fast";

/** Studio is a backwards-compatible request alias for Creative. */
export function effectiveGenerationMode(mode: GenerationMode): EffectiveGenerationMode {
  return mode === "fast" ? "fast" : "creative";
}
