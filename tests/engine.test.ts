import test from "node:test";
import assert from "node:assert/strict";
import { getAllCliches, runBlocklistFilter } from "../lib/engine/blocklist-filter";
import { fixPaletteContrast } from "../lib/engine/contrast-fixer";
import { extractJSON } from "../lib/engine/llm-utils";
import { runCodeQualityLoop } from "../lib/engine/code-quality-loop";
import { PROVIDER_MODELS } from "../lib/llm-adapter/types";
import { fetchPublicDesignSource } from "../lib/security/safe-url";
import type { LLMAdapter } from "../lib/llm-adapter/types";

test("the public blocklist has truthful family and signal counts", () => {
  const data = getAllCliches();
  assert.equal(data.cliches.length, 21);
  assert.equal(data.cliches.reduce((sum, entry) => sum + entry.example_values.length, 0), 67);
});

test("blocklist scans the delivered code content", () => {
  const result = runBlocklistFilter('<section style="background: linear-gradient(#6366F1, #8B5CF6)">');
  assert.ok(result.matches.length > 0);
});

test("JSON extraction skips an earlier malformed brace pair", () => {
  assert.deepEqual(extractJSON<{ ok: boolean }>('noise {not-json} then {"ok":true}'), { ok: true });
});

test("palette correction applies one stable text token across dark surfaces", () => {
  const result = fixPaletteContrast([
    { name: "Void", hex: "#080808", role: "background" },
    { name: "Panel", hex: "#202020", role: "surface" },
    { name: "Copy", hex: "#555555", role: "text" },
  ]);
  const copy = result.fixedPalette.find((color) => color.name === "Copy");
  assert.notEqual(copy?.hex.toLowerCase(), "#555555");
  assert.equal(result.report.fixesApplied, 1);
  assert.equal(result.report.allPass, true);
  assert.ok(result.report.checked.every((check) => check.ratio >= 4.5 && check.passesAA));
});

test("code quality loop uses syntax diagnostics and accepts a valid repair", async () => {
  const fakeAdapter: LLMAdapter = {
    async complete() {
      return "export default function Demo() { return <main>Repaired</main>; }";
    },
  };
  const result = await runCodeQualityLoop(
    fakeAdapter,
    "export default function Demo() { return <main><div>Broken</main>; }",
    "",
    "react"
  );
  assert.equal(result.wasRepaired, true);
  assert.match(result.code, /<main>Repaired<\/main>/);
  assert.ok(result.issues.some((issue) => issue.includes("Syntax error") || issue.includes("Unclosed")));
});

test("provider registry contains no retired model IDs", () => {
  const ids = Object.values(PROVIDER_MODELS).flat().map((model) => model.id);
  for (const retired of [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ]) {
    assert.equal(ids.includes(retired), false);
  }
  assert.ok(ids.includes("openrouter/free"));
});

test("URL critic rejects insecure and private-network targets before fetching", async () => {
  await assert.rejects(() => fetchPublicDesignSource("http://example.com"), /public HTTPS/);
  await assert.rejects(() => fetchPublicDesignSource("https://127.0.0.1"), /private network/);
});
