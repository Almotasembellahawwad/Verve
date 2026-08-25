import { NextRequest } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { runPipeline } from "@/lib/engine/pipeline";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { classifyError, logSanitizedError } from "@/lib/middleware/error-handler";
import { serializePipelineResult } from "@/lib/api/pipeline-response";

export const maxDuration = 300;

const RequestSchema = z.object({
  brief: z.string().min(10).max(5000),
  existingCode: z.string().max(20000).optional(),
  framework: z.enum(["nextjs", "react", "html"]).optional().default("nextjs"),
  apiKey: z.string().min(1).max(500),
  provider: z.enum(["anthropic", "openai", "gemini", "openrouter"]).optional().default("anthropic"),
  model: z.string().max(100).optional(),
  pexelsKey: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const rateLimited = checkRateLimit(req, ROUTE_LIMITS["generate-stream"]!);
  if (rateLimited) return rateLimited;

  const requestId = uuidv4();
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "INVALID_REQUEST", requestId })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "INVALID_REQUEST", requestId })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const release = acquireConcurrentSlot(req, ROUTE_LIMITS["generate-stream"]!);
  const encoder = new TextEncoder();
  let eventSeq = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown, stageId?: string) => {
        try {
          const id = stageId ?? String(++eventSeq);
          controller.enqueue(encoder.encode(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // The client disconnected before the current stage completed.
        }
      };

      try {
        const result = await runPipeline({
          ...parsed.data,
          signal: req.signal,
          onEvent: ({ event, data, stageId }) => send(event, data, stageId),
        });

        send("result", serializePipelineResult(result, requestId), "result");
      } catch (err) {
        const { code } = classifyError(err);
        logSanitizedError(err, code, requestId);
        send("error", { code, requestId });
      } finally {
        release();
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
