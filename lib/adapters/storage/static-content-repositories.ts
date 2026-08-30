import clicheRaw from "../../../data/cliches.json";
import referenceRaw from "../../../data/reference-library.json";
import type { BlocklistRepositoryPort, ClicheData, ReferenceEntry, ReferenceLibraryRepositoryPort } from "../../ports/repositories";

type ReferenceLibraryV2Source = {
  version: string;
  languageCoverage: Array<"latin" | "arabic">;
  experienceModels: Array<{ id: string; mechanic: string }>;
  domains: Array<{
    id: string;
    principle: string;
    mechanics: string[];
    fixationRisk: string;
    source: { title: string; url: string; license: string };
  }>;
};

const referenceSource = referenceRaw as ReferenceLibraryV2Source;

function buildReferenceLibraryV2(): ReferenceEntry[] {
  return referenceSource.domains.flatMap((domain) => referenceSource.experienceModels.map((experienceModel, modelIndex) => ({
    id: `v2-${domain.id}-${experienceModel.id}`,
    name: `${domain.id} / ${experienceModel.id} transferable pattern`,
    industry: domain.id,
    mood: modelIndex % 2 === 0 ? ["expressive", "clear"] : ["specific", "interactive"],
    what_makes_it_work: `${domain.principle} ${experienceModel.mechanic}`,
    specific_techniques: [...domain.mechanics, experienceModel.mechanic],
    color_palette: [],
    tags: [domain.id, experienceModel.id, "transferable-principle"],
    domainTags: [domain.id],
    experienceModels: [experienceModel.id],
    transferablePrinciples: [domain.principle, experienceModel.mechanic],
    mechanics: [...domain.mechanics],
    fixationRisks: [domain.fixationRisk],
    languageCoverage: [...referenceSource.languageCoverage],
    source: domain.source,
  })));
}

export class StaticBlocklistRepository implements BlocklistRepositoryPort {
  get(): ClicheData { return clicheRaw as ClicheData; }
}

export class StaticReferenceLibraryRepository implements ReferenceLibraryRepositoryPort {
  list(): ReferenceEntry[] {
    return buildReferenceLibraryV2();
  }
}

export const staticBlocklistRepository = new StaticBlocklistRepository();
export const staticReferenceLibraryRepository = new StaticReferenceLibraryRepository();
