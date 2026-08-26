import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/engine/pipeline";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { errorResponse, classifyError } from "@/lib/middleware/error-handler";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { serializePipelineResult } from "@/lib/api/pipeline-response";

export const maxDuration = 300;

const RequestSchema = z.object({
  brief:        z.string().min(10).max(5000),
  existingCode: z.string().max(20000).optional(),
  framework:    z.enum(["nextjs", "react", "html"]).optional().default("nextjs"),
  apiKey:       z.string().min(1).max(500),
  provider:     z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model:        z.string().max(100).optional(),
  pexelsKey:    z.string().max(500).optional(),
  mode:         z.enum(["fast", "studio"]).optional().default("studio"),
});

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS["generate"]!);
  if (rateLimited) return rateLimited;

  const requestId = uuidv4();
  const release   = acquireConcurrentSlot(req, ROUTE_LIMITS["generate"]!);

  try {
    const body   = await req.json();
    const parsed = RequestSchema.safeParse(body);

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
