type ParsedHtmlTag = {
  start: number;
  end: number;
  name: string;
  closing: boolean;
  selfClosing: boolean;
  source: string;
  attributes: ReadonlyMap<string, string | null>;
};

export type HtmlElementSlice = {
  name: string;
  openingTag: string;
  closingTag: string;
  content: string;
  source: string;
  attributes: ReadonlyMap<string, string | null>;
};

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "title", "textarea"]);
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);

function isHtmlSpace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" ||
    character === "\r" || character === "\f";
}

function isTagNameCharacter(character: string | undefined): boolean {
  return Boolean(character) && !isHtmlSpace(character) && character !== "/" &&
    character !== ">" && character !== "<" && character !== "=" &&
    character !== '"' && character !== "'";
}

function scanTagEnd(source: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let cursor = start; cursor < source.length; cursor++) {
    const character = source[cursor];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return cursor + 1;
  }
  return -1;
}

function parseAttributes(source: string, start: number, end: number): ReadonlyMap<string, string | null> {
  const attributes = new Map<string, string | null>();
  let cursor = start;

  while (cursor < end) {
    while (cursor < end && (isHtmlSpace(source[cursor]) || source[cursor] === "/")) cursor++;
    if (cursor >= end) break;

    const nameStart = cursor;
    while (
      cursor < end && !isHtmlSpace(source[cursor]) && source[cursor] !== "=" &&
      source[cursor] !== "/" && source[cursor] !== ">"
    ) cursor++;
    if (cursor === nameStart) {
      cursor++;
      continue;
    }

    const name = source.slice(nameStart, cursor).toLowerCase();
    while (cursor < end && isHtmlSpace(source[cursor])) cursor++;
    let value: string | null = null;
    if (source[cursor] === "=") {
      cursor++;
      while (cursor < end && isHtmlSpace(source[cursor])) cursor++;
      const quote = source[cursor];
      if (quote === '"' || quote === "'") {
        cursor++;
        const valueStart = cursor;
        while (cursor < end && source[cursor] !== quote) cursor++;
        value = source.slice(valueStart, cursor);
        if (source[cursor] === quote) cursor++;
      } else {
        const valueStart = cursor;
        while (cursor < end && !isHtmlSpace(source[cursor]) && source[cursor] !== ">") cursor++;
        value = source.slice(valueStart, cursor);
      }
    }
    if (!attributes.has(name)) attributes.set(name, value);
  }

  return attributes;
}

function parseTagAt(source: string, start: number): ParsedHtmlTag | null {
  if (source[start] !== "<") return null;
  let cursor = start + 1;
  let closing = false;
  if (source[cursor] === "/") {
    closing = true;
    cursor++;
  }
  if (!isTagNameCharacter(source[cursor]) || source[cursor] === "!" || source[cursor] === "?") return null;

  const nameStart = cursor;
  while (isTagNameCharacter(source[cursor])) cursor++;
  const name = source.slice(nameStart, cursor).toLowerCase();
  const end = scanTagEnd(source, cursor);
  if (end < 0) return null;

  let tail = end - 2;
  while (tail >= cursor && isHtmlSpace(source[tail])) tail--;
  return {
    start,
    end,
    name,
    closing,
    selfClosing: source[tail] === "/",
    source: source.slice(start, end),
    attributes: closing ? new Map() : parseAttributes(source, cursor, end - 1),
  };
}

function commentEnd(source: string, start: number): number {
  const end = source.indexOf("-->", start + 4);
  return end < 0 ? source.length : end + 3;
}

function nextHtmlTag(source: string, from: number): ParsedHtmlTag | null {
  let cursor = from;
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) return null;
    if (source.startsWith("<!--", start)) {
      cursor = commentEnd(source, start);
      continue;
    }
    if (source[start + 1] === "!" || source[start + 1] === "?") {
      const end = scanTagEnd(source, start + 2);
      cursor = end < 0 ? source.length : end;
      continue;
    }
    const tag = parseTagAt(source, start);
    if (tag) return tag;
    cursor = start + 1;
  }
  return null;
}

function findRawTextClose(source: string, from: number, name: string): ParsedHtmlTag | null {
  const lowerSource = source.toLowerCase();
  const needle = `</${name}`;
  let cursor = from;
  while (cursor < source.length) {
    const start = lowerSource.indexOf(needle, cursor);
    if (start < 0) return null;
    const tag = parseTagAt(source, start);
    if (tag?.closing && tag.name === name) return tag;
    cursor = start + needle.length;
  }
  return null;
}

function findMatchingClose(source: string, opening: ParsedHtmlTag): ParsedHtmlTag | null {
  if (RAW_TEXT_ELEMENTS.has(opening.name)) {
    return findRawTextClose(source, opening.end, opening.name);
  }

  let depth = 1;
  let cursor = opening.end;
  while (cursor < source.length) {
    const tag = nextHtmlTag(source, cursor);
    if (!tag) return null;
    if (!tag.closing && RAW_TEXT_ELEMENTS.has(tag.name)) {
      const rawClose = findRawTextClose(source, tag.end, tag.name);
      cursor = rawClose?.end ?? source.length;
      continue;
    }
    if (tag.name === opening.name) {
      if (tag.closing) depth--;
      else if (!tag.selfClosing && !VOID_ELEMENTS.has(tag.name)) depth++;
      if (depth === 0) return tag;
    }
    cursor = tag.end;
  }
  return null;
}

function findElementOpening(source: string, name: string, from = 0): ParsedHtmlTag | null {
  const target = name.toLowerCase();
  let cursor = from;
  while (cursor < source.length) {
    const tag = nextHtmlTag(source, cursor);
    if (!tag) return null;
    if (!tag.closing && tag.name === target) return tag;
    if (!tag.closing && RAW_TEXT_ELEMENTS.has(tag.name)) {
      const close = findRawTextClose(source, tag.end, tag.name);
      cursor = close?.end ?? source.length;
    } else {
      cursor = tag.end;
    }
  }
  return null;
}

export function rewriteHtmlElements(
  source: string,
  name: string,
  rewrite: (element: HtmlElementSlice) => string,
  options: { consumeUnclosed?: boolean } = {}
): string {
  const target = name.toLowerCase();
  let searchFrom = 0;
  let copiedThrough = 0;
  let result = "";

  while (searchFrom < source.length) {
    const opening = findElementOpening(source, target, searchFrom);
    if (!opening) break;
    const hasNoEndTag = VOID_ELEMENTS.has(target) || (opening.selfClosing && !RAW_TEXT_ELEMENTS.has(target));
    const closing = hasNoEndTag ? null : findMatchingClose(source, opening);
    if (!hasNoEndTag && !closing && !options.consumeUnclosed) {
      searchFrom = opening.end;
      continue;
    }

    const elementEnd = closing?.end ?? (hasNoEndTag ? opening.end : source.length);
    const contentEnd = closing?.start ?? elementEnd;
    const element: HtmlElementSlice = {
      name: target,
      openingTag: opening.source,
      closingTag: closing?.source ?? "",
      content: source.slice(opening.end, contentEnd),
      source: source.slice(opening.start, elementEnd),
      attributes: opening.attributes,
    };
    result += source.slice(copiedThrough, opening.start) + rewrite(element);
    copiedThrough = elementEnd;
    searchFrom = elementEnd;
  }

  return result + source.slice(copiedThrough);
}

export function removeHtmlElements(source: string, names: readonly string[], replacement = " "): string {
  return names.reduce(
    (current, name) => rewriteHtmlElements(current, name, () => replacement, { consumeUnclosed: true }),
    source
  );
}

export function removeHtmlComments(source: string, replacement = " "): string {
  let cursor = 0;
  let result = "";
  while (cursor < source.length) {
    const start = source.indexOf("<!--", cursor);
    if (start < 0) break;
    result += source.slice(cursor, start) + replacement;
    cursor = commentEnd(source, start);
  }
  return result + source.slice(cursor);
}

export function stripHtmlMarkup(source: string, replacement = " "): string {
  let cursor = 0;
  let result = "";
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) break;
    result += source.slice(cursor, start);
    if (source.startsWith("<!--", start)) {
      result += replacement;
      cursor = commentEnd(source, start);
      continue;
    }
    const end = source[start + 1] === "!" || source[start + 1] === "?"
      ? scanTagEnd(source, start + 2)
      : parseTagAt(source, start)?.end ?? -1;
    if (end < 0) {
      result += "<";
      cursor = start + 1;
      continue;
    }
    result += replacement;
    cursor = end;
  }
  return result + source.slice(cursor);
}

export function readFirstHtmlElementText(source: string, name: string): string | null {
  const opening = findElementOpening(source, name);
  if (!opening) return null;
  const closing = findMatchingClose(source, opening);
  return closing ? stripHtmlMarkup(source.slice(opening.end, closing.start), " ") : null;
}

export function hasHtmlStartTag(
  source: string,
  name: string,
  predicate: (attributes: ReadonlyMap<string, string | null>) => boolean = () => true
): boolean {
  let cursor = 0;
  const target = name.toLowerCase();
  while (cursor < source.length) {
    const opening = findElementOpening(source, target, cursor);
    if (!opening) return false;
    if (predicate(opening.attributes)) return true;
    cursor = opening.end;
  }
  return false;
}

function findHtmlEndTag(source: string, name: string): ParsedHtmlTag | null {
  const target = name.toLowerCase();
  let cursor = 0;
  while (cursor < source.length) {
    const tag = nextHtmlTag(source, cursor);
    if (!tag) break;
    if (tag.closing && tag.name === target) return tag;
    if (!tag.closing && RAW_TEXT_ELEMENTS.has(tag.name)) {
      const close = findRawTextClose(source, tag.end, tag.name);
      cursor = close?.end ?? source.length;
    } else {
      cursor = tag.end;
    }
  }
  return null;
}

export function hasHtmlEndTag(source: string, name: string): boolean {
  return findHtmlEndTag(source, name) !== null;
}

export function insertBeforeHtmlEndTag(source: string, name: string, content: string): string {
  const tag = findHtmlEndTag(source, name);
  if (tag) return source.slice(0, tag.start) + content + source.slice(tag.start);
  return `${source}\n${content}`;
}

export function escapeRawTextEndTags(source: string, name: "script" | "style"): string {
  const lowerSource = source.toLowerCase();
  const needle = `</${name}`;
  let cursor = 0;
  let result = "";
  while (cursor < source.length) {
    const start = lowerSource.indexOf(needle, cursor);
    if (start < 0) break;
    result += source.slice(cursor, start) + "<\\/" + source.slice(start + 2, start + needle.length);
    cursor = start + needle.length;
  }
  return result + source.slice(cursor);
}

export function escapeHtmlAttribute(source: string): string {
  let result = "";
  for (const character of source) {
    if (character === "&") result += "&amp;";
    else if (character === '"') result += "&quot;";
    else if (character === "<") result += "&lt;";
    else if (character === ">") result += "&gt;";
    else result += character;
  }
  return result;
}

export function decodeHtmlTextEntities(source: string): string {
  const named: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
  };
  let cursor = 0;
  let result = "";
  while (cursor < source.length) {
    const start = source.indexOf("&", cursor);
    if (start < 0) break;
    const end = source.indexOf(";", start + 1);
    if (end < 0 || end - start > 12) {
      result += source.slice(cursor, start + 1);
      cursor = start + 1;
      continue;
    }
    const entity = source.slice(start + 1, end);
    const lowerEntity = entity.toLowerCase();
    let decoded = named[lowerEntity];
    if (!decoded && lowerEntity.startsWith("#")) {
      const hexadecimal = lowerEntity.startsWith("#x");
      const digits = lowerEntity.slice(hexadecimal ? 2 : 1);
      const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
      if (digits && Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        decoded = String.fromCodePoint(codePoint);
      }
    }
    if (decoded === undefined) {
      result += source.slice(cursor, end + 1);
    } else {
      result += source.slice(cursor, start) + decoded;
    }
    cursor = end + 1;
  }
  return result + source.slice(cursor);
}
