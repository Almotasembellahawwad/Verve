import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CodeQL initialization and analysis share the same immutable release", () => {
  const workflow = readFileSync(new URL("../.github/workflows/codeql.yml", import.meta.url), "utf8");
  const pins = ["init", "analyze"].map((action) => {
    const matches = [...workflow.matchAll(new RegExp(`uses:\\s*github/codeql-action/${action}@([a-f0-9]{40})\\s*#\\s*(v[\\d.]+)`, "g"))];
    assert.equal(matches.length, 1, `${action} must have exactly one full-SHA release pin`);
    return { sha: matches[0][1], version: matches[0][2] };
  });
  assert.deepEqual(pins[0], pins[1], "Mixed releases cannot read each other's versioned configuration");
});

test("Dependabot groups CodeQL actions so the versioned pair updates together", () => {
  const config = readFileSync(new URL("../.github/dependabot.yml", import.meta.url), "utf8");
  const actions = config.split("- package-ecosystem: github-actions")[1];
  assert.ok(actions, "GitHub Actions updates remain enabled");
  assert.match(actions, /groups:\s*(?:#[^\n]*\n\s*)?codeql-action:\s*patterns:\s*\["github\/codeql-action\/\*"\]/);
});
