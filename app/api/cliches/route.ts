import { NextResponse } from "next/server";
import { readBlocklistUseCase } from "@/lib/application/content-use-cases";
import { staticBlocklistRepository } from "@/lib/adapters/storage/static-content-repositories";

export async function GET() {
  return NextResponse.json(readBlocklistUseCase(staticBlocklistRepository), {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
