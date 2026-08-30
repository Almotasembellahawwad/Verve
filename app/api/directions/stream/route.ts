import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { DirectionRequestSchema } from "@/lib/api/generation-request";
import { createGenerationDependencies } from "@/lib/adapters/composition-root";
import { runDirectionExplorationUseCase } from "@/lib/application/run-direction-exploration-use-case";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { classifyError, logSanitizedError } from "@/lib/middleware/error-handler";

export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const limited = await checkRateLimit(req, ROUTE_LIMITS["directions-stream"]!);
  if (limited) return limited;
  const requestId = uuidv4();
  const parsed = DirectionRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(`event: error\ndata: ${JSON.stringify({ code: "INVALID_REQUEST", requestId })}\n\n`, {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  const slot = await acquireConcurrentSlot(req, ROUTE_LIMITS["directions-stream"]!);
  if (typeof slot !== "function") return slot;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const timer = setInterval(() => send("heartbeat", { stageId: "directions", requestId }), 10_000);
      send("directions:start", { requestId, mode: parsed.data.mode });
      try {
        const { apiKey, provider, model, ...input } = parsed.data;
        const dependencies = createGenerationDependencies({ provider, apiKey, model, signal: req.signal });
        const result = await runDirectionExplorationUseCase(input, dependencies);
        send("directions:complete", { requestId, ...result });
      } catch (error) {
        const { code } = classifyError(error);
        logSanitizedError(error, code, requestId);
        send("error", { code, requestId, message: "Direction exploration could not complete." });
      } finally {
        clearInterval(timer);
        await slot();
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
