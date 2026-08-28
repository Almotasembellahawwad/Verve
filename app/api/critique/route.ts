import { NextRequest, NextResponse } from "next/server";
import { runCritiqueUseCase } from "@/lib/application/run-critique-use-case";
import { createAdapter } from "@/lib/adapters/llm/factory";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { errorResponse, classifyError } from "@/lib/middleware/error-handler";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const RequestSchema = z.object({
  url:        z.string().url().max(2048).optional(),
  code:       z.string().max(20000).optional(),
  screenshot: z.string().max(10000).optional(),
  apiKey:     z.string().min(1).max(500),
  provider:   z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model:      z.string().max(100).optional(),
}).refine((d) => d.url ?? d.code ?? d.screenshot, {
  message: "At least one of url, code, or screenshot is required",
});

export async function POST(req: NextRequest) {
  const rateLimited = await checkRateLimit(req, ROUTE_LIMITS["critique"]!);
  if (rateLimited) return rateLimited;

  const requestId = uuidv4();
  const slot = await acquireConcurrentSlot(req, ROUTE_LIMITS["critique"]!);
  if (typeof slot !== "function") return slot;
  const release = slot;

  try {
    const body   = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", requestId, details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { apiKey, provider, model, ...input } = parsed.data;
    const llm     = createAdapter(provider, apiKey, model);
    const critique = await runCritiqueUseCase(llm, input);
    return NextResponse.json({ critique, requestId });

  } catch (err) {
    const { code, status } = classifyError(err);
    return errorResponse(err, code, status, requestId);
  } finally {
    await release();
  }
}
