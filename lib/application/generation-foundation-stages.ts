import type { AssetBundle } from "../engine/asset-sourcer";
import type { BriefAnalysis } from "../engine/brief-analyzer";
import {
  assessDirectionPortfolio,
  createFallbackDirectionPortfolio,
  enforceRecommendedDirection,
} from "../engine/direction-portfolio";
import type { DesignPlan } from "../engine/plan-generator";
import { buildVerveProjectSpec } from "../engine/project-spec-builder";
import type { BrandProfile, OwnedAssetManifest } from "../project/brand-kit";
import type { DesignDirectionFingerprint, DirectionDiversityAssessment } from "../domain/design-direction";
import type { VerveProjectSpec } from "../domain/project-spec";
import type { GenerationMode } from "../domain/generation-mode";
import { NullProgressPublisher, type ProgressPublisherPort } from "../ports/progress";
import { executePipelineStages, type PipelineStage } from "./pipeline-stage";

type GenerationFoundationContext = {
  analysis: BriefAnalysis;
  designPlan: DesignPlan;
  framework: string;
  mode?: GenerationMode;
  assetBundle: AssetBundle;
  brandProfile?: BrandProfile;
  ownedAssets: OwnedAssetManifest[];
  recentDirectionFingerprints: DesignDirectionFingerprint[];
  selectedDirectionLocked?: boolean;
  projectSpec?: VerveProjectSpec;
  directionDiversity?: DirectionDiversityAssessment;
};

const projectSpecStage: PipelineStage<GenerationFoundationContext> = {
  id: "04.2",
  name: "Visual Narrative Contract",
  module: "VerveProjectSpec + StoryGraph",
  async execute(context) {
    return {
      projectSpec: buildVerveProjectSpec({
        analysis: context.analysis,
        plan: context.designPlan,
        framework: context.framework,
        mode: context.mode,
        assetBundle: context.assetBundle,
        brandProfile: context.brandProfile,
        ownedAssets: context.ownedAssets,
      }),
    };
  },
};

const directionDiversityStage: PipelineStage<GenerationFoundationContext> = {
  id: "04.1",
  name: "Direction Diversity",
  module: "QualityDiversity",
  async execute(context) {
    const directionPortfolio = context.designPlan.directionPortfolio
      ?? createFallbackDirectionPortfolio(context.designPlan, context.analysis);
    const designPlan = { ...context.designPlan, directionPortfolio };
    const initialAssessment = assessDirectionPortfolio(directionPortfolio, context.recentDirectionFingerprints);
    const enforcedPlan = context.selectedDirectionLocked
      ? designPlan
      : enforceRecommendedDirection(designPlan, initialAssessment);
    const enforcedPortfolio = enforcedPlan.directionPortfolio ?? directionPortfolio;
    return {
      designPlan: enforcedPlan,
      directionDiversity: assessDirectionPortfolio(enforcedPortfolio, context.recentDirectionFingerprints),
    };
  },
};

export async function runGenerationFoundationStages(
  input: Omit<GenerationFoundationContext, "projectSpec" | "directionDiversity">,
  progress: ProgressPublisherPort = new NullProgressPublisher()
): Promise<{
  designPlan: DesignPlan;
  projectSpec: VerveProjectSpec;
  directionDiversity: DirectionDiversityAssessment;
}> {
  const context = await executePipelineStages<GenerationFoundationContext>(
    [directionDiversityStage, projectSpecStage],
    input,
    progress
  );
  if (!context.projectSpec || !context.directionDiversity) {
    throw new Error("Generation foundation stages did not produce their required contracts.");
  }
  return {
    designPlan: context.designPlan,
    projectSpec: context.projectSpec,
    directionDiversity: context.directionDiversity,
  };
}
