import { NextResponse } from "next/server";
import { readReferenceLibraryUseCase } from "@/lib/application/content-use-cases";
import { staticReferenceLibraryRepository } from "@/lib/adapters/storage/static-content-repositories";

export async function GET() {
  return NextResponse.json(readReferenceLibraryUseCase(staticReferenceLibraryRepository), {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
