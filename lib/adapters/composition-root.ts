import { createAdapter } from "./llm/factory";
import { DEFAULT_MODEL, type Provider } from "../llm-adapter/types";
import type { GenerationDependencies } from "../application/run-generation-use-case";
import type { ProgressPublisherPort } from "../ports/progress";
import { PexelsAssetSourceAdapter } from "./assets/pexels-asset-source";
import { PexelsAssetDeliveryAdapter } from "./assets/pexels-asset-delivery";
import {
  staticBlocklistRepository,
  staticReferenceLibraryRepository,
} from "./storage/static-content-repositories";

export type GenerationCompositionConfig = {
  provider: Provider;
  apiKey: string;
  model?: string;
  pexelsKey?: string;
  signal?: AbortSignal;
  progress?: ProgressPublisherPort;
};

/** The single request-scoped composition root for the generation use case. */
export function createGenerationDependencies(config: GenerationCompositionConfig): GenerationDependencies {
  let resolvedModel = config.model ?? DEFAULT_MODEL[config.provider];
  const llm = createAdapter(
    config.provider,
    config.apiKey,
    config.model,
    config.signal,
    (attempt, waitMs, retryModel) => {
      resolvedModel = retryModel.replace(/^fallback:\s*/i, "");
      config.progress?.publish({
        event: "stage_retry",
        stageId: "provider-retry",
        data: { attempt, waitMs, model: retryModel },
      });
    }
  );

  return {
    llm,
    assetSource: new PexelsAssetSourceAdapter(config.pexelsKey),
    assetDelivery: new PexelsAssetDeliveryAdapter(config.signal),
    blocklistRepository: staticBlocklistRepository,
    referenceLibraryRepository: staticReferenceLibraryRepository,
    defaultModel: DEFAULT_MODEL[config.provider],
    progress: config.progress,
    resolvedModel: () => resolvedModel,
  };
}
