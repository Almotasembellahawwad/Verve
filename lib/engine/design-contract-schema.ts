import { z } from "zod";
import { DESIGN_CONTRACT_VERSION, type DesignContract } from "../domain/design-contract";

const Text = z.string().min(1).max(5000);
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const DesignContractSchema: z.ZodType<DesignContract> = z.object({
  version: z.literal(DESIGN_CONTRACT_VERSION),
  identity: z.object({
    directionId: Text, concept: Text,
    experienceModel: z.enum(["narrative-scroll", "spatial-map", "task-workbench", "guided-conversation", "collection-browser", "live-canvas"]),
    opening: Text, navigation: Text,
    signature: z.object({ name: Text, mechanism: Text, purpose: Text }),
  }),
  palette: z.array(z.object({ name: Text, hex: Hex, role: Text })).min(3).max(8),
  colorRoles: z.object({ surface: Hex, surfaceRaised: Hex, textPrimary: Hex, textMuted: Hex, accent: Hex }),
  typography: z.object({ display: Text, body: Text, mono: Text.optional(), profileId: Text.optional(), script: z.enum(["latin", "arabic", "mixed"]).optional(), policy: z.enum(["bundled-contract", "legacy-unverified"]) }),
  spatial: z.object({ density: z.enum(["airy", "balanced", "dense"]), system: Text, rhythm: Text, spacingRem: z.array(z.number().positive().max(16)).length(6) }),
  imageLanguage: Text,
  materialVocabulary: z.array(Text).max(20),
  motion: z.object({ choreography: Text, reducedMotionRequired: z.literal(true) }),
  sceneIds: z.array(Text).min(1).max(40),
  refinement: z.object({ preserve: z.array(Text).min(1).max(40), sceneVariation: z.array(Text).min(1).max(10) }),
}).strict().superRefine((contract, context) => {
  const colors = new Set(contract.palette.map((color) => color.hex.toLowerCase()));
  if (Object.values(contract.colorRoles).some((hex) => !colors.has(hex.toLowerCase()))) context.addIssue({ code: "custom", message: "Color roles must refer to the selected palette." });
  if (contract.spatial.spacingRem.some((value, index, values) => index > 0 && value <= values[index - 1])) context.addIssue({ code: "custom", message: "Spacing tokens must form an increasing scale." });
  if (new Set(contract.sceneIds).size !== contract.sceneIds.length) context.addIssue({ code: "custom", message: "Scene IDs must be unique." });
});
