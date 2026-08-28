import { NextRequest, NextResponse } from "next/server";
import { runGenerationUseCase } from "@/lib/application/run-generation-use-case";
import { createGenerationDependencies } from "@/lib/adapters/composition-root";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { errorResponse, classifyError } from "@/lib/middleware/error-handler";
import { v4 as uuidv4 } from "uuid";
import { serializePipelineResult } from "@/lib/api/pipeline-response";
import { GenerationRequestSchema } from "@/lib/api/generation-request";
import { StructuredLogProgressPublisher } from "@/lib/adapters/observability/structured-log-progress-publisher";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimited = await checkRateLimit(req, ROUTE_LIMITS["generate"]!);
  if (rateLimited) return rateLimited;

  const requestId = uuidv4();
  const slot = await acquireConcurrentSlot(req, ROUTE_LIMITS["generate"]!);
  if (typeof slot !== "function") return slot;
  const release = slot;

  try {
    const body   = await req.json();
    const parsed = GenerationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", requestId, details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { apiKey, provider = "anthropic", pexelsKey, ...input } = parsed.data;
    const dependencies = createGenerationDependencies({
      provider,
      apiKey,
      model: input.model,
      pexelsKey,
      progress: new StructuredLogProgressPublisher(requestId),
    });
    const result = await runGenerationUseCase({ ...input, provider }, dependencies);

    return NextResponse.json(serializePipelineResult(result, requestId));

  } catch (err) {
    const { code, status } = classifyError(err);
    return errorResponse(err, code, status, requestId);
  } finally {
    await release();
  }
}
