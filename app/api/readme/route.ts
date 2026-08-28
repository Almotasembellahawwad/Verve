import { NextResponse } from "next/server";
import { readDocumentUseCase } from "@/lib/application/content-use-cases";
import { FilesystemDocumentRepository } from "@/lib/adapters/storage/filesystem-document-repository";

export async function GET() {
  try {
    const content = readDocumentUseCase(new FilesystemDocumentRepository(process.cwd()), "README.md");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="VERVE_README.md"',
        "Cache-Control": "public, s-maxage=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "README not found" }, { status: 404 });
  }
}
