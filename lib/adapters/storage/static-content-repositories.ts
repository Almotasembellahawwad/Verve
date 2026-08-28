import clicheRaw from "../../../data/cliches.json";
import referenceRaw from "../../../data/reference-library.json";
import type { BlocklistRepositoryPort, ClicheData, ReferenceEntry, ReferenceLibraryRepositoryPort } from "../../ports/repositories";

export class StaticBlocklistRepository implements BlocklistRepositoryPort {
  get(): ClicheData { return clicheRaw as ClicheData; }
}

export class StaticReferenceLibraryRepository implements ReferenceLibraryRepositoryPort {
  list(): ReferenceEntry[] { return (referenceRaw as { entries: ReferenceEntry[] }).entries; }
}

export const staticBlocklistRepository = new StaticBlocklistRepository();
export const staticReferenceLibraryRepository = new StaticReferenceLibraryRepository();

