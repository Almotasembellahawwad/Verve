import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  decodeHtmlTextEntities,
  readFirstHtmlElementText,
  removeHtmlComments,
  removeHtmlElements,
  stripHtmlMarkup,
} from "./structural-html";

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]!;
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIpv4(normalized.slice(7));
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
    normalized.startsWith("fea") || normalized.startsWith("feb");
}

async function assertPublicHttpsUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Only public HTTPS URLs without embedded credentials are supported");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new Error("Local and private network URLs are not supported");
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The URL resolves to a local or private network address");
  }
  return url;
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("The page is too large to critique");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("The page is too large to critique");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export type DesignSource = { finalUrl: string; title: string; source: string; visibleText: string };

export function normalizeFetchedDesignSource(raw: string): Omit<DesignSource, "finalUrl"> {
  // This excerpt is untrusted model evidence, never renderable markup. Structural
  // removal avoids both regex bypasses and token-joining that can create new tags.
  const withoutComments = removeHtmlComments(raw, " ");
  const source = removeHtmlElements(
    withoutComments,
    ["script", "noscript", "iframe", "object", "embed"],
    " "
  ).slice(0, 14_000);
  const titleText = readFirstHtmlElementText(source, "title") ?? "Untitled page";
  const title = decodeHtmlTextEntities(titleText).replace(/\s+/g, " ").trim().slice(0, 300) || "Untitled page";
  const visibleDocument = removeHtmlElements(source, ["style", "title", "template"], " ");
  const visibleText = decodeHtmlTextEntities(stripHtmlMarkup(visibleDocument, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6_000);
  return { title, source, visibleText };
}

export async function fetchPublicDesignSource(value: string): Promise<DesignSource> {
  let url = await assertPublicHttpsUrl(value);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("URL fetch timed out")), 8_000);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: { Accept: "text/html,text/plain;q=0.9", "User-Agent": "VerveDesignCritic/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("The page redirected too many times");
      url = await assertPublicHttpsUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The page returned HTTP ${response.status}`);

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("The URL must return an HTML or plain-text page");
    }

    const raw = await readLimitedText(response);
    return { finalUrl: url.toString(), ...normalizeFetchedDesignSource(raw) };
  }

  throw new Error("Unable to fetch the page");
}
