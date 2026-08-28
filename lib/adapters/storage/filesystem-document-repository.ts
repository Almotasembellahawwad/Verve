import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DocumentRepositoryPort } from "../../ports/repositories";

export class FilesystemDocumentRepository implements DocumentRepositoryPort {
  constructor(private readonly root: string) {}

  read(name: string): string {
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error("Invalid document name");
    return readFileSync(join(this.root, name), "utf8");
  }
}

