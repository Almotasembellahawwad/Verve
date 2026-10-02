import type { VerveProjectSpec } from "../domain/project-spec";
import { DESIGN_CONTRACT_VERSION, type DesignContract } from "../domain/design-contract";
import { DesignContractSchema } from "./design-contract-schema";
import type { DesignDirectionCandidate } from "../domain/design-direction";
import { resolveDesignColorRoles } from "./design-color-roles";

/** Compile existing decisions. No model call, new palette, or independent typography choice. */
export function compileDesignContract(spec: VerveProjectSpec, direction?: DesignDirectionCandidate): DesignContract {
  const palette = spec.visualSystem.colors;
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
    colorRoles: resolveDesignColorRoles(palette),
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
