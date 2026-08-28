import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createAdapter } from "@/lib/adapters/llm/factory";
import { runPatchUseCase } from "@/lib/application/run-patch-use-case";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { errorResponse } from "@/lib/middleware/error-handler";

const PatchSchema = z.object({
  currentCode: z.string().min(50).max(80_000),
  instruction: z.string().min(3).max(2_000),
  designPlan: z.string().max(10_000).optional(),
  brief: z.string().max(1_000).optional(),
  framework: z.enum(["nextjs", "react", "html"]).optional().default("html"),
  provider: z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model: z.string().max(100).optional(),
  apiKey: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS.patch!);
  if (rateLimited) return rateLimited;
  const requestId = uuidv4();
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", requestId }, { status: 400 });
  }

  const release = acquireConcurrentSlot(req, ROUTE_LIMITS.patch!);
  const { provider, apiKey, model, ...input } = parsed.data;
  try {
    const code = await runPatchUseCase(createAdapter(provider, apiKey, model), input);
    return NextResponse.json({ code, requestId });
  } catch (error) {
    return errorResponse(error, "GENERATION_FAILED", 500, requestId);
  } finally {
    release();
  }
}
