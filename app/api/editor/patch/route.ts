import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createAdapter } from "@/lib/adapters/llm/factory";
import { EditorPatchRequestSchema } from "@/lib/api/editor-patch-request";
import { runProjectPatchUseCase } from "@/lib/application/run-project-patch-use-case";
import { classifyError, errorResponse } from "@/lib/middleware/error-handler";
import { acquireConcurrentSlot, checkRateLimit, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(request, ROUTE_LIMITS.patch!);
  if (rateLimited) return rateLimited;
  const requestId = uuidv4();
  const parsed = EditorPatchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", requestId }, { status: 400 });

  const slot = await acquireConcurrentSlot(request, ROUTE_LIMITS.patch!);
  if (typeof slot !== "function") return slot;
  try {
    const { provider, model, apiKey, ...input } = parsed.data;
    const result = await runProjectPatchUseCase(createAdapter(provider, apiKey, model, request.signal), input);
    return NextResponse.json({ ...result, requestId });
  } catch (error) {
    const classified = classifyError(error);
    return errorResponse(error, classified.code, classified.status, requestId);
  } finally {
    await slot();
  }
}
