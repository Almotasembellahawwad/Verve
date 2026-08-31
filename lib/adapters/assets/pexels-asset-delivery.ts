import { createHash } from "node:crypto";
import type {
  AssetDeliveryFailure,
  AssetDeliveryPayload,
  AssetDeliveryPort,
  AssetDeliveryRequest,
} from "../../ports/assets";

/** Leaves headroom for base64 expansion inside the streamed generation receipt. */
export const MAX_DELIVERED_ASSET_BYTES = 1_200_000;
const DELIVERY_TIMEOUT_MS = 8_000;
const APPROVED_HOSTS = new Set(["images.pexels.com"]);
type DeliveryFetch = (input: URL, init: RequestInit) => Promise<Response>;

type SupportedMedia = AssetDeliveryPayload["mediaType"];

const MEDIA: Record<SupportedMedia, { extension: AssetDeliveryPayload["extension"]; signature: (bytes: Uint8Array) => boolean }> = {
  "image/jpeg": {
    extension: "jpg",
    signature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    signature: (bytes) => bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
  },
  "image/webp": {
    extension: "webp",
    signature: (bytes) => bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  },
};

function failure(code: AssetDeliveryFailure["code"]): AssetDeliveryFailure {
  return { ok: false, code };
}

function approvedUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !APPROVED_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

async function readLimitedBody(response: Response): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_DELIVERED_ASSET_BYTES) return null;
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength <= MAX_DELIVERED_ASSET_BYTES ? bytes : null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > MAX_DELIVERED_ASSET_BYTES) {
      await reader.cancel("asset body exceeded delivery limit");
      return null;
    }
    chunks.push(next.value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export class PexelsAssetDeliveryAdapter implements AssetDeliveryPort {
  constructor(
    private readonly requestSignal?: AbortSignal,
    private readonly fetchImpl: DeliveryFetch = fetch
  ) {}

  async fetchApprovedAsset(request: AssetDeliveryRequest): Promise<AssetDeliveryPayload | AssetDeliveryFailure> {
    const url = approvedUrl(request.url);
    if (!url) return failure("origin-not-approved");

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new Error("asset delivery timeout")), DELIVERY_TIMEOUT_MS);
    const signals = [this.requestSignal, request.signal, timeout.signal].filter((signal): signal is AbortSignal => Boolean(signal));
    const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);

    try {
      const response = await this.fetchImpl(url, {
        signal,
        redirect: "manual",
        headers: { Accept: "image/webp,image/png,image/jpeg" },
      });
      if (!response.ok || response.status < 200 || response.status >= 300) return failure("upstream-rejected");
      const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() as SupportedMedia | undefined;
      if (!mediaType || !(mediaType in MEDIA)) return failure("unsupported-media");
      const bytes = await readLimitedBody(response);
      if (!bytes) return failure("body-too-large");
      const descriptor = MEDIA[mediaType];
      if (!descriptor.signature(bytes)) return failure("signature-mismatch");
      return {
        ok: true,
        content: Buffer.from(bytes).toString("base64"),
        encoding: "base64",
        mediaType,
        extension: descriptor.extension,
        byteSize: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    } catch {
      if (this.requestSignal?.aborted) throw this.requestSignal.reason;
      if (request.signal?.aborted) throw request.signal.reason;
      return failure(timeout.signal.aborted ? "timeout" : "unavailable");
    } finally {
      clearTimeout(timer);
    }
  }
}
