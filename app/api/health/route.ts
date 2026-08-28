import { NextResponse } from "next/server";
import { readHealthUseCase } from "@/lib/application/read-health-use-case";
import { VercelRuntimeConfigAdapter } from "@/lib/adapters/config/vercel-runtime-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = readHealthUseCase(new VercelRuntimeConfigAdapter());
  return NextResponse.json(health, {
    status: health.status === "not-ready" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
