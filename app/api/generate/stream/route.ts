import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { runGenerationUseCase } from "@/lib/application/run-generation-use-case";
import { createGenerationDependencies } from "@/lib/adapters/composition-root";
import { CallbackProgressPublisher } from "@/lib/adapters/progress/callback-progress-publisher";
import { checkRateLimit, acquireConcurrentSlot, ROUTE_LIMITS } from "@/lib/middleware/rate-limit";
import { classifyError, logSanitizedError } from "@/lib/middleware/error-handler";
import { serializePipelineResult } from "@/lib/api/pipeline-response";
import { asPipelineCheckpoint, createGenerationRecovery } from "@/lib/application/generation-recovery";
import { GenerationRequestSchema } from "@/lib/api/generation-request";

export const maxDuration = 300;

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

  const parsed = GenerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "INVALID_REQUEST", requestId })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const release = acquireConcurrentSlot(req, ROUTE_LIMITS["generate-stream"]!);
  const encoder = new TextEncoder();
  let eventSeq = 0;
  const streamAbort = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      let stageStartedAt = startedAt;
      let currentStage = "boot";
      let latestCheckpoint = parsed.data.checkpoint;
      const overallCtrl = new AbortController();
      const overallTimer = setTimeout(
        () => overallCtrl.abort(new Error("Pipeline timed out after 240s")),
        240_000
      );
      const pipelineSignal = AbortSignal.any([req.signal, streamAbort.signal, overallCtrl.signal]);
      const send = (event: string, data: unknown, stageId?: string) => {
        try {
          const id = stageId ?? String(++eventSeq);
          controller.enqueue(encoder.encode(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // The client disconnected before the current stage completed.
        }
      };

      // Some providers and reverse proxies can stay silent for long model
      // calls. Heartbeats prove the stream is alive and prevent a blank UI.
      const heartbeat = setInterval(() => {
        const now = Date.now();
        send("heartbeat", {
          stageId: currentStage,
          stageElapsedMs: now - stageStartedAt,
          totalElapsedMs: now - startedAt,
        });
      }, 10_000);

      send("connected", { requestId, mode: parsed.data.mode });

      try {
        const progress = new CallbackProgressPublisher(({ event, data, stageId }) => {
            if (event === "stage_start" && typeof data.id === "string") {
              currentStage = data.id;
              stageStartedAt = Date.now();
            }
            if (event === "checkpoint") {
              latestCheckpoint = asPipelineCheckpoint(data.checkpoint) ?? latestCheckpoint;
            }
            send(event, data, stageId);
        });
        const { apiKey, provider, pexelsKey, ...input } = parsed.data;
        const dependencies = createGenerationDependencies({
          provider,
          apiKey,
          model: input.model,
          pexelsKey,
          signal: pipelineSignal,
          progress,
        });
        const result = await runGenerationUseCase(
          { ...input, provider, signal: pipelineSignal },
          dependencies
        );

        send("result", serializePipelineResult(result, requestId), "result");
      } catch (err) {
        const { code } = classifyError(err);
        logSanitizedError(err, code, requestId);
        const message = code === "TIMEOUT"
          ? "The provider exceeded the time budget for this stage. A recovery draft was preserved."
          : code === "RATE_LIMITED"
            ? "The provider is rate-limited. A recovery draft was preserved; retry in Fast mode or switch models."
            : code === "PROVIDER_ERROR"
              ? "The model stopped or returned an incomplete response. A recovery draft was preserved."
              : "The pipeline could not finish this stage. A recovery draft was preserved.";
        send("stage_error", { code, requestId, stageId: currentStage, message }, `${currentStage}-error`);
        send("recovery", {
          code,
          requestId,
          failedStage: currentStage,
          message,
          project: createGenerationRecovery(parsed.data.brief, parsed.data.framework, currentStage),
          ...(latestCheckpoint ? { checkpoint: latestCheckpoint } : {}),
        }, "recovery");
      } finally {
        clearInterval(heartbeat);
        clearTimeout(overallTimer);
        release();
        try {
          controller.close();
        } catch {
          // The browser may have cancelled the stream while the provider was
          // unwinding. The request-scoped adapter has already received abort.
        }
      }
    },
    cancel(reason) {
      if (!streamAbort.signal.aborted) {
        streamAbort.abort(reason instanceof Error ? reason : new Error("Generation stream cancelled by client"));
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
