export const STREAM_INACTIVITY_TIMEOUT_MS = 35_000;

export class StreamInactivityError extends Error {
  constructor(timeoutMs: number) {
    super(`Generation stream produced no events for ${Math.round(timeoutMs / 1000)}s.`);
    this.name = "StreamInactivityError";
  }
}

/** Heartbeats arrive every 10s; three missed heartbeats means the stream is gone. */
export async function readWithInactivityTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs = STREAM_INACTIVITY_TIMEOUT_MS
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new StreamInactivityError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
