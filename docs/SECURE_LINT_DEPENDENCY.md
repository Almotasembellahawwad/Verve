# Scoped Next lint dependency remediation

## Why this exists

The full dependency audit on 2026-10-04 reported [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. The advisory lists no patched `braces` release; the registry still reports 3.0.3. This is a development dependency, but production-only audit results do not waive the complete CI gate.

## Remediation, not suppression

An exact, nested npm override replaces **only** `@next/eslint-plugin-next@16.3.7`'s `fast-glob` dependency with the MIT-licensed `tinyglobby@0.2.17`. Its real package identity and registry integrity are visible in the lockfile. `braces` and `micromatch` are removed from the dependency tree. No patched-version fiction, advisory exclusion, `--omit=dev`, forced Next downgrade or relaxed audit severity is used.

The installed Next plugin uses a named `globSync(pattern, { onlyDirectories: true })` import solely to resolve configured Next root directories. [Upstream source](https://github.com/vercel/next.js/blob/canary/packages/eslint-plugin-next/src/utils/get-root-dirs.ts) and [tinyglobby's documented API](https://github.com/SuperchupuDev/tinyglobby) support this specific replacement. This is **not** a promise that tinyglobby implements every fast-glob API, such as streaming or task generation. No application code or generated-project path is passed to this lint utility.

The ESLint configuration installs `tools/next-lint-glob.mjs` on the replacement's named `globSync` property before any rule executes. The adapter disables automatic directory expansion, preserves absolute input paths across Windows drives, normalizes trailing slashes and checks patterns before matching: at most 32 patterns, 2048 characters per pattern, 16 nested delimiters and 64 opening delimiters. These are defensive configuration limits, not a general-purpose untrusted glob service. The adapter checks the installed identity, is idempotent, and does not modify the separate matcher used by the TypeScript resolver. No rule implementations, severities or source ignores are changed.

## Regression protection

`tests/next-lint-dependency.test.ts` checks the installed replacement identity and lockfile, relative/absolute directory globs, braces/negation/nested paths, spaces, the actual Next root-directory resolver, and rejection of oversized/deeply nested patterns in a timeout-bounded subprocess. It also checks every official Core Web Vitals rule's severity, React/hooks/TypeScript/accessibility coverage, real internal-link/synchronous-script violations, and isolation/idempotence of the adapter.

The current ESLint configuration does not define `settings.next.rootDir`: Next uses the literal lint working directory without invoking glob matching. Globs in future monorepo configuration must remain trusted, bounded repository configuration. A stress check of the raw replacement on an extremely nested, under-length-limit pattern did not finish within five seconds; the adapter rejects such patterns before calling it. Removing the known vulnerable dependency alone would not justify exposing the raw replacement to generated/user-controlled paths.

## Maintenance

The override is intentionally version-scoped. Any Next ESLint upgrade must review the upstream glob imports and rerun these compatibility tests plus `npm ci`, the **full** audit and lint. Prefer removing the override once an official release removes or patches the vulnerable chain. Passing an audit is dependency evidence, not a universal guarantee against vulnerabilities.
