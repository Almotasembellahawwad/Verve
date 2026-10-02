import type { VerveProjectSpec } from "../domain/project-spec";
import { DESIGN_CONTRACT_VERSION, type DesignContract } from "../domain/design-contract";
import { DesignContractSchema } from "./design-contract-schema";
import type { DesignDirectionCandidate } from "../domain/design-direction";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return r * .2126 + g * .7152 + b * .0722;
}

/** Compile existing decisions. No model call, new palette, or independent typography choice. */
export function compileDesignContract(spec: VerveProjectSpec, direction?: DesignDirectionCandidate): DesignContract {
  const palette = spec.visualSystem.colors;
  const surface = palette.find((color) => /background|base|canvas|environment|field/i.test(color.role)) ?? palette[0];
  const contrast = (hex: string) => (Math.max(luminance(hex), luminance(surface.hex)) + .05) / (Math.min(luminance(hex), luminance(surface.hex)) + .05);
  const readable = [...palette].sort((left, right) => contrast(right.hex) - contrast(left.hex));
  const text = palette.find((color) => /text|foreground|ink|copy/i.test(color.role) && contrast(color.hex) >= 4.5) ?? readable[0];
  const raised = palette.find((color) => color !== surface && /surface|panel|raised/i.test(color.role)) ?? surface;
  const muted = palette.find((color) => /muted|secondary.*text/i.test(color.role) && contrast(color.hex) >= 4.5) ?? text;
  const accent = palette.find((color) => /accent|action|active|selection|highlight/i.test(color.role))
    ?? palette.find((color) => color !== surface && color !== text) ?? text;
  const density = direction?.descriptors.density ?? "balanced";
  const spacing = density === "dense" ? [.25, .5, .75, 1, 1.5, 2.5]
    : density === "airy" ? [.375, .75, 1.25, 2, 3.5, 6] : [.25, .5, 1, 1.5, 2.5, 4];
  const typography = spec.typographyContract;
  return DesignContractSchema.parse({
    version: DESIGN_CONTRACT_VERSION,
    identity: {
      directionId: direction?.id ?? "legacy-direction",
      concept: direction?.concept ?? spec.narrative.thesis,
      experienceModel: spec.experience.model,
      opening: direction?.descriptors.openingMode ?? "task-first",
      navigation: direction?.descriptors.navigationModel ?? spec.narrative.structure,
      signature: { name: spec.visualSystem.signature.name, mechanism: spec.visualSystem.signature.mechanism, purpose: spec.visualSystem.signature.justification },
    },
    palette: palette.map((color) => ({ ...color })),
    colorRoles: { surface: surface.hex, surfaceRaised: raised.hex, textPrimary: text.hex, textMuted: muted.hex, accent: accent.hex },
    typography: {
      display: typography?.display.stack ?? spec.visualSystem.typography.display,
      body: typography?.body.stack ?? spec.visualSystem.typography.body,
      ...(typography?.mono ? { mono: typography.mono.stack } : {}),
      ...(typography ? { profileId: typography.profileId, script: typography.script } : {}),
      policy: typography ? "bundled-contract" : "legacy-unverified",
    },
    spatial: { density, system: direction?.descriptors.spatialSystem ?? spec.narrative.artDirection.compositionGrammar, rhythm: direction?.dimensions.spatialRhythm ?? spec.narrative.artDirection.compositionGrammar, spacingRem: spacing },
    imageLanguage: spec.narrative.artDirection.imageLanguage,
    materialVocabulary: spec.narrative.artDirection.materialVocabulary,
    motion: { choreography: spec.narrative.artDirection.motionChoreography, reducedMotionRequired: true },
    sceneIds: spec.narrative.scenes.map((scene) => scene.id),
    refinement: {
      preserve: ["Verified facts", "Approved assets", "Typography families", "Color roles", "Route and navigation identity", ...spec.brand.invariants].slice(0, 40),
      sceneVariation: ["Composition", "Image framing", "Copy hierarchy", "State feedback", "Responsive transformation"],
    },
  });
}
