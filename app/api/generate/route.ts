import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/engine/pipeline";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { errorResponse, classifyError } from "@/lib/middleware/error-handler";
import { v4 as uuidv4 } from "uuid";
import { serializePipelineResult } from "@/lib/api/pipeline-response";
import { GenerationRequestSchema } from "@/lib/api/generation-request";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS["generate"]!);
  if (rateLimited) return rateLimited;

  const requestId = uuidv4();
  const release   = acquireConcurrentSlot(req, ROUTE_LIMITS["generate"]!);

  try {
    const body   = await req.json();
    const parsed = GenerationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", requestId, details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { apiKey, provider = "anthropic", pexelsKey } = parsed.data;
    const result = await runPipeline({ ...parsed.data, provider, apiKey, pexelsKey });

    return NextResponse.json(serializePipelineResult(result, requestId));

  } catch (err) {
    const { code, status } = classifyError(err);
    return errorResponse(err, code, status, requestId);
  } finally {
    release();
  }
}
