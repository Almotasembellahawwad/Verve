# Architecture migration log

This log records the incremental engineering pass. A phase is marked complete only when build, lint, typecheck, and tests pass after its changes.

## Step 0 — discovery

- Read `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `package.json` in full.
- Captured the three-level `app/`, `lib/`, and `components/` tree in `docs/SYSTEM_DESIGN_REVIEW.md`.
- Preserved the dirty working tree found at session start rather than resetting user work.
- Consulted the installed Next.js 16.3.1 Route Handlers guide before changing API code.

Verification gate:

```text
npm run build       PASS — Compiled successfully; 22 routes generated
npm run lint        PASS — no diagnostics
npm run typecheck   PASS — tsc --noEmit
npm test            PASS — tests 44, pass 44, fail 0
npm audit --omit=dev PASS — found 0 vulnerabilities
```

## Phase A — system design analysis

Added `docs/SYSTEM_DESIGN_REVIEW.md` with the observed request/data flow, bounded contexts, pattern audit, non-functional scorecard, divergence notes, and coupling hotspots.

Pattern/principle: **Architecture Decision Evidence** — document the system that exists before changing boundaries so later claims can be checked against code rather than intent.

Verification gate:

```text
npm run build       PASS — Next.js 16.3.1 compiled and generated 22 routes
npm run lint        PASS — no diagnostics
npm run typecheck   PASS — tsc --noEmit
npm test            PASS — tests 44, pass 44, fail 0
```

## Phase B — design patterns

- **Adapter + Port:** moved the provider-neutral LLM contract to `lib/ports/llm.ts`; SDK types remain inside concrete adapters (`lib/ports/llm.ts:19`, `lib/adapters/llm/factory.ts:30`).
- **Factory:** removed concrete adapter exports from the factory barrel and changed the adapter-level test to construct through `createAdapter()`. The executable architecture check now permits concrete construction only inside the factory (`lib/adapters/llm/factory.ts:30`, `tests/engine.test.ts:225-240`).
- **Strategy:** introduced `FastGenerationStrategy` and `StudioGenerationStrategy`. The pipeline now asks one strategy for analysis, archetype, critique, plan budgets, revisions, checkpoints, and repair policy (`lib/application/generation-strategy.ts:16-96`).
- **Circuit Breaker + Decorator:** added an injectable closed/open/half-open breaker and an LLM decorator. Pexels, palette extraction, and optional Google Fonts requests use the same breaker policy (`lib/application/circuit-breaker.ts:18`, `lib/adapters/llm/circuit-breaking-llm.ts:5`, `lib/engine/fonts-intelligence.ts:98-128`).
- **Repository:** blocklist, reference-library, and browser-history access now sit behind repository ports with static JSON and browser adapters (`lib/ports/repositories.ts:4-24`).
- **Pipeline / Chain of Responsibility:** added an immutable stage contract and reorderable stage runner. Existing pipeline behavior remains intact while subsequent migration can extract stages incrementally (`lib/application/pipeline-stage.ts:4-24`).
- **Observer:** formalized the existing callback behavior as `ProgressPublisherPort`; SSE framing remains outside business stages (`lib/ports/progress.ts:8`, `app/api/generate/stream/route.ts:81-97`).
- **Builder:** audited as already correct. Project accumulation/finalization remains separate from client ZIP packaging, so no pattern-for-pattern's-sake class rewrite was made (`lib/project/project-builder.ts:286`, `components/ProjectWorkbench.tsx:36-45`).
- **Dependency Injection:** removed the Google Fonts module cache and mid-request `process.env` read; key and breaker are explicit dependencies (`lib/engine/fonts-intelligence.ts:98-128`).
- Preserved and verified the readiness/evidence work present in the initial working tree: execution provenance, actual asset-usage evidence, three-axis readiness policy, and maintainable split HTML delivery. These are included here because they complete the same explicit-policy and evidence-contract boundary.

Pattern/principle: **Strategy, Repository, Decorator/Circuit Breaker, Chain of Responsibility, and Dependency Injection** — each addresses a concrete variability or failure boundary found in Phase A.

Verification gate:

```text
npm run build       PASS — Next.js 16.3.1 compiled and generated 22 routes
npm run lint        PASS — no diagnostics
npm run typecheck   PASS — tsc --noEmit
npm test            PASS — tests 48, pass 48, fail 0
```

## Phase C — layered / hexagonal architecture

- Moved the real generation orchestrator to `lib/application/run-generation-use-case.ts`; `lib/engine/pipeline.ts` is now a compatibility facade only (`lib/application/run-generation-use-case.ts:120`, `lib/engine/pipeline.ts:1-10`).
- Removed API keys, Pexels keys, adapter construction, JSON repository selection, and transport callbacks from the use-case input. Request-scoped dependencies are injected through `GenerationDependencies` (`lib/application/run-generation-use-case.ts:91-123`).
- Added a composition root that wires LLM, asset source, repositories, progress publisher, model configuration, and circuit state per request (`lib/adapters/composition-root.ts:20-44`).
- Moved concrete LLM implementations and their factory under `lib/adapters/llm/*`; legacy import paths are narrow compatibility exports (`lib/adapters/llm/factory.ts:1-54`, `lib/llm-adapter/index.ts:1-4`).
- Extracted the blocklist evaluator into dependency-free `lib/domain/blocklist.ts` (`lib/domain/blocklist.ts:1-71`).
- Added application use cases for generation, comparison, critique, patching, recovery, and content access. API routes now parse, wire, invoke one use case, and format transport responses (`lib/application/run-comparison-use-case.ts:39`, `lib/application/run-critique-use-case.ts:6`, `lib/application/run-patch-use-case.ts:21`, `lib/application/content-use-cases.ts:9-27`).
- Added an executable architecture test that prevents domain imports, application-to-infrastructure imports, route bypasses into engine/project internals, and adapter construction outside the factory (`tests/engine.test.ts:225-240`).

Pattern/principle: **Ports and Adapters with a Composition Root** — provider, storage, asset, and transport details point inward through interfaces while the application layer owns orchestration.

Verification gate:

```text
npm run build       PASS — Next.js 16.3.1 compiled and generated 22 routes
npm run lint        PASS — no diagnostics
npm run typecheck   PASS — tsc --noEmit
npm test            PASS — tests 49, pass 49, fail 0
```

## Phase D — deployment and operations

- Replaced process-local production rate limiting with an Upstash Redis adapter behind `RateLimitStorePort`. Sliding request windows and concurrent leases are atomic Lua operations; lease TTLs recover capacity after interrupted serverless invocations (`lib/ports/rate-limit.ts:4-8`, `lib/adapters/rate-limit/upstash-rate-limit-store.ts:4-65`).
- Kept in-memory admission control only for local development. Managed deployments without Redis configuration, or with an unavailable admission store, fail closed with HTTP 503 (`lib/middleware/rate-limit.ts:15-43`).
- Added structured progress observers that correlate stage starts, completions, retries, and degradation by `requestId` without logging briefs, credentials, generated code, checkpoint payloads, or unapproved nested fields (`lib/adapters/observability/structured-log-progress-publisher.ts:3-49`, `app/api/generate/stream/route.ts:81-97`, `tests/engine.test.ts:289-315`).
- Added `/api/health`, backed by a runtime-configuration port/use case, to expose environment, source commit, and configuration readiness without spending provider quota (`lib/application/read-health-use-case.ts:3-17`, `app/api/health/route.ts:7-14`).
- Verified the existing PR/main CI gate and added a separate weekly production-dependency audit workflow. The operations runbook records the external GitHub ruleset needed to make `CI / verify` a required merge check (`.github/workflows/ci.yml:1-31`, `.github/workflows/security-audit.yml:1-19`).
- Documented Preview/Production Upstash isolation, browser-local provider/Pexels keys, secret rotation, deployment traceability, and Vercel's one-step rollback path.
- Recorded the absence of Sentry/exception tracking as an explicit gap rather than implying that structured logs provide alerting or long-term tracing.

Pattern/principle: **Distributed Adapter + Observer + Fail-Closed Readiness** — serverless instances coordinate admission through one port, pipeline telemetry has independent SSE/log observers, and a managed deployment cannot report ready while its abuse-control dependency is absent.

Verification gate:

```text
npm run build       PASS — Next.js 16.3.1 compiled and generated 22 routes
npm run lint        PASS — no diagnostics
npm run typecheck   PASS — tsc --noEmit
npm test            PASS — tests 53, pass 53, fail 0
npm audit --omit=dev PASS — found 0 vulnerabilities
```

## Post-pass increment — Fast-first execution

- Made Fast the single shared default across the domain contract, API schema, application use case, and workbench instead of maintaining three independent Studio defaults (`lib/domain/generation-mode.ts:1-6`, `lib/api/generation-request.ts:30`, `lib/application/run-generation-use-case.ts:136`, `components/GeneratePanel.tsx:263`).
- Replaced the low-visibility mode select with native radio cards that state call budget, review depth, and the OpenRouter free-capacity tradeoff while preserving keyboard semantics (`components/GeneratePanel.tsx:66-87`, `components/GeneratePanel.tsx:730-765`).
- Fixed the Ubuntu CI failure by normalizing the architecture test's concrete-adapter path before comparison; Windows and Linux now assert the same repository-relative path (`tests/engine.test.ts:248-252`).
- Prevented pre-hydration Brand Kit input loss by keeping its controlled inputs disabled until React has attached handlers (`components/BrandKitInput.tsx:26-35`, `tests/e2e/smoke.spec.ts:45-63`).

Pattern/principle: **Single Source of Truth + Progressive Enhancement** — one domain value controls default execution policy, while interactive browser controls do not claim readiness before hydration.

Verification gate:

```text
npm run build       PASS — Next.js 16.3.1 compiled and generated 22 routes
npm run lint        PASS — no diagnostics
npm run typecheck   PASS — tsc --noEmit
npm test            PASS — tests 54, pass 54, fail 0
npx playwright test PASS — tests 20, pass 20, fail 0 (desktop + mobile Chrome)
```

## What a senior engineer would still flag

- Most pure scoring, archetype, contrast, and generation services still live under the legacy `lib/engine` area. Dependency tests prevent infrastructure from leaking inward, but deeper migration into `lib/domain` remains deliberately incremental to avoid mixing file movement with behavior changes (`docs/ARCHITECTURE.md:21-31`, `tests/engine.test.ts:225-240`).
- Circuit-breaker state is request-scoped. It protects repeated calls within one generation, but it does not aggregate provider failures across requests or serverless instances; a distributed provider-health policy would be a separate reliability project (`lib/adapters/composition-root.ts:21-44`, `lib/adapters/llm/factory.ts:30-38`).
- No load test proves the 100-concurrent-user target or validates real provider quotas. Redis now makes admission globally correct, while actual throughput remains bounded by Vercel and each BYOK provider account; the test scripts contain unit and browser checks but no load harness (`package.json:5-14`).
- Structured logs are present, but Sentry/equivalent alerting, retention, dashboards, and cross-service tracing are not. Cliché suggestions also remain structured logs rather than a durable moderation queue (`lib/adapters/observability/structured-log-progress-publisher.ts:31-49`, `package.json:15-45`).
- `/api/health` validates required configuration only; it deliberately does not live-ping Redis or LLM providers. A separate synthetic monitor should exercise a bounded real route (`lib/application/read-health-use-case.ts:3-17`).
- Generation history remains capped browser `localStorage`, not IndexedDB or optional encrypted sync (`lib/history.ts:8-29`, `lib/adapters/storage/browser-history-repository.ts:4-9`).
- GitHub branch protection/rulesets are repository settings and cannot be proven from this local checkout. `main` must require `CI / verify` before the workflow truly blocks merges.
- GitHub Actions are version-tag pinned (`@v4`) rather than commit-SHA pinned. Teams with a stricter software-supply-chain policy should pin action revisions and automate their updates (`.github/workflows/ci.yml:20-21`, `.github/workflows/security-audit.yml:16-17`).
