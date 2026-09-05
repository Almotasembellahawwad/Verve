import { NextResponse } from "next/server";
import { readHealthUseCase } from "@/lib/application/read-health-use-case";
import { VercelRuntimeConfigAdapter } from "@/lib/adapters/config/vercel-runtime-config";
import { FontsourceRuntimeHealthAdapter } from "@/lib/adapters/typography/fontsource-runtime-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const dependencies = await new FontsourceRuntimeHealthAdapter().inspect();
  const health = readHealthUseCase(new VercelRuntimeConfigAdapter(), dependencies);
  return NextResponse.json(health, {
    status: health.status === "not-ready" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
