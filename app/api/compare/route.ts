import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createAdapter } from "@/lib/adapters/llm/factory";
import { createGenerationDependencies } from "@/lib/adapters/composition-root";
import { runComparisonUseCase } from "@/lib/application/run-comparison-use-case";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { errorResponse, classifyError } from "@/lib/middleware/error-handler";

export const maxDuration = 120;

const RequestSchema = z.object({
  brief: z.string().min(10).max(5_000),
  framework: z.enum(["nextjs", "react", "html"]).default("nextjs"),
  provider: z.enum(["anthropic", "openai", "gemini", "openrouter"]).default("anthropic"),
  apiKey: z.string().min(1).max(500),
  model: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS.compare!);
  if (rateLimited) return rateLimited;
  const requestId = uuidv4();
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", requestId, details: parsed.error.issues }, { status: 400 });
  }

  const release = acquireConcurrentSlot(req, ROUTE_LIMITS.compare!);
  const { apiKey, ...input } = parsed.data;
  try {
    const result = await runComparisonUseCase(input, {
      baselineLLM: createAdapter(input.provider, apiKey, input.model),
      generation: createGenerationDependencies({ provider: input.provider, apiKey, model: input.model }),
    });
    return NextResponse.json({ ...result, requestId });
  } catch (error) {
    const { code, status } = classifyError(error);
    return errorResponse(error, code, status, requestId);
  } finally {
    release();
  }
}
