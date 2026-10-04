import test, { before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ESLint } from "eslint";

const projectRequire = createRequire(import.meta.url);
const pluginEntry = projectRequire.resolve("@next/eslint-plugin-next");
const pluginRequire = createRequire(pluginEntry);
const repositoryRoot = resolve(import.meta.dirname, "..");
const guardUrl = pathToFileURL(join(repositoryRoot, "tools", "next-lint-glob.mjs")).href;
let installGuard: (projectRequire: NodeRequire) => void;
before(async () => {
  installGuard = (await import(guardUrl)).default;
  installGuard(projectRequire);
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "verve-next-lint-"));
  for (const name of ["one", "two", "space dir"]) {
    mkdirSync(join(root, "apps", name, "app"), { recursive: true });
    writeFileSync(join(root, "apps", name, "app", "page.tsx"), "export default function Page() { return null; }");
  }
  writeFileSync(join(root, "apps", "not-a-directory"), "fixture");
  return root;
}

test("Next lint's scoped glob replacement removes the vulnerable packages, not the audit gate", () => {
  const manifest = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(repositoryRoot, "package-lock.json"), "utf8"));
  assert.deepEqual(manifest.overrides, {
    "@next/eslint-plugin-next@16.3.7": { "fast-glob": "npm:tinyglobby@0.2.17" },
  });
  const replacement = pluginRequire("fast-glob/package.json");
  assert.equal(replacement.name, "tinyglobby");
  assert.equal(replacement.version, "0.2.17");
  for (const [path, pkg] of Object.entries(lock.packages) as [string, { name?: string; extraneous?: boolean }][]) {
    assert.ok(!pkg.extraneous, `Extraneous lock entry: ${path}`);
    assert.ok(!/(?:^|\/)node_modules\/(?:braces|micromatch)$/.test(path), path);
    if (path.endsWith("node_modules/fast-glob")) assert.equal(pkg.name, "tinyglobby");
  }
  const workflow = readFileSync(join(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.doesNotMatch(workflow, /audit.*(?:omit|continue-on-error)/);
});

test("the replacement implements the Next plugin's directory-glob API on relative and absolute paths", () => {
  const root = fixture();
  try {
    const { globSync } = pluginRequire("fast-glob");
    // Directory suffixes differ between matchers; path.join in Next normalizes
    // them. Compare filesystem identities, not incidental trailing slashes.
    const normalize = (paths: string[]) => paths.map((path) => path.replace(/\/$/, "")).sort();
    const directories = normalize(globSync("apps/*", { cwd: root, onlyDirectories: true }));
    assert.deepEqual(directories, ["apps/one", "apps/space dir", "apps/two"]);
    assert.deepEqual(normalize(globSync(["apps/{one,two}", "!apps/two"], { cwd: root, onlyDirectories: true })), ["apps/one"]);
    assert.deepEqual(normalize(globSync("apps/**/app", { cwd: root, onlyDirectories: true })), ["apps/one/app", "apps/space dir/app", "apps/two/app"]);
    const pattern = join(root, "apps", "*").replace(/\\/g, "/");
    assert.deepEqual(normalize(globSync(pattern, { onlyDirectories: true })), directories.map((path: string) => `${root.replace(/\\/g, "/")}/${path}`).sort());
    const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js");
    assert.deepEqual(getRootDirs({ cwd: root, settings: {} }), [root]);
    assert.deepEqual(getRootDirs({ cwd: root, settings: { next: { rootDir: pattern } } }).sort(), globSync(pattern, { onlyDirectories: true }).sort());
    assert.deepEqual(getRootDirs({ cwd: root, settings: { next: { rootDir: [pattern, 12] } } }).sort(), globSync(pattern, { onlyDirectories: true }).sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("oversized and deeply nested configured patterns are rejected before matcher construction", () => {
  const root = fixture();
  try {
    // Bound the subprocess as well as input length/depth before any matching.
    const code = `import {createRequire} from 'node:module';
      import assert from 'node:assert/strict';
      import installGuard from ${JSON.stringify(guardUrl)};
      const requirePlugin=createRequire(${JSON.stringify(pluginEntry)});
      installGuard(requirePlugin);
      const {globSync}=requirePlugin('fast-glob');
      assert.throws(()=>globSync('{'.repeat(33000)+'x'+'}'.repeat(33000), {
        cwd:${JSON.stringify(root)},onlyDirectories:true
      }), /at most 2048/);
      assert.throws(()=>globSync('{'.repeat(32)+'x'+'}'.repeat(32), {
        cwd:${JSON.stringify(root)},onlyDirectories:true
      }), /too complex/);`;
    execFileSync(process.execPath, ["--input-type=module", "-e", code], { timeout: 5000, stdio: "pipe" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the guard is idempotent and does not modify the separate TypeScript resolver's matcher", () => {
  const matcher = pluginRequire("fast-glob");
  const bounded = matcher.globSync;
  installGuard(projectRequire);
  assert.equal(matcher.globSync, bounded);
  const resolverRequire = createRequire(projectRequire.resolve("eslint-import-resolver-typescript"));
  assert.notEqual(resolverRequire("tinyglobby").globSync, bounded);
  assert.throws(() => bounded("apps/*"), /only directory matching/);
  assert.throws(() => bounded(Array(33).fill("apps/*"), { onlyDirectories: true }), /Invalid Next lint root/);
});

test("all official Next Core Web Vitals rules and React/TypeScript/accessibility checks remain enabled", async () => {
  const eslint = new ESLint({ cwd: repositoryRoot });
  const config = await eslint.calculateConfigForFile(join(repositoryRoot, "app", "page.tsx"));
  const plugin = pluginRequire(pluginEntry);
  for (const [rule, severity] of Object.entries(plugin.configs["core-web-vitals"].rules)) {
    assert.equal(config.rules[rule][0], severity === "error" ? 2 : 1, rule);
  }
  for (const rule of ["react/jsx-key", "react-hooks/rules-of-hooks", "jsx-a11y/alt-text", "@typescript-eslint/no-explicit-any"]) {
    assert.ok(config.rules[rule][0] > 0, rule);
  }
});

test("the real ESLint config still detects internal HTML links and synchronous scripts", async () => {
  const eslint = new ESLint({ cwd: repositoryRoot });
  const [result] = await eslint.lintText(
    'export default function Example() { return <><a href="/">Home</a><script src="/test.js" /></>; }',
    { filePath: join(repositoryRoot, "app", "lint-canary.tsx") },
  );
  for (const rule of ["@next/next/no-html-link-for-pages", "@next/next/no-sync-scripts"]) {
    assert.ok(result.messages.some((message) => message.ruleId === rule && message.severity === 2), rule);
  }
});
