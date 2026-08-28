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

- **Adapter + Port:** moved the provider-neutral LLM contract to `lib/ports/llm.ts`; SDK types remain inside concrete adapters.
- **Factory:** removed concrete adapter exports from the factory barrel and changed the adapter-level test to construct through `createAdapter()`. A repository-wide grep now finds concrete construction only inside the factory.
- **Strategy:** introduced `FastGenerationStrategy` and `StudioGenerationStrategy`. The pipeline now asks one strategy for analysis, archetype, critique, plan budgets, revisions, checkpoints, and repair policy.
- **Circuit Breaker + Decorator:** added an injectable closed/open/half-open breaker and an LLM decorator. Pexels, palette extraction, and optional Google Fonts requests use the same breaker policy.
- **Repository:** blocklist, reference-library, and browser-history access now sit behind repository ports with static JSON and browser adapters.
- **Pipeline / Chain of Responsibility:** added an immutable stage contract and reorderable stage runner. Existing pipeline behavior remains intact while subsequent migration can extract stages incrementally.
- **Observer:** formalized the existing callback behavior as `ProgressPublisherPort`; SSE framing remains outside business stages.
- **Builder:** audited as already correct. Project accumulation/finalization is separate from client ZIP packaging, so no pattern-for-pattern's-sake class rewrite was made.
- **Dependency Injection:** removed the Google Fonts module cache and mid-request `process.env` read; key and breaker are explicit dependencies.
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

- Moved the real generation orchestrator to `lib/application/run-generation-use-case.ts`; `lib/engine/pipeline.ts` is now a compatibility facade only.
- Removed API keys, Pexels keys, adapter construction, JSON repository selection, and transport callbacks from the use-case input. Request-scoped dependencies are injected through `GenerationDependencies`.
- Added a composition root that wires LLM, asset source, repositories, progress publisher, model configuration, and circuit state per request.
- Moved concrete LLM implementations and their factory under `lib/adapters/llm/*`; legacy import paths are narrow compatibility exports.
- Extracted the blocklist evaluator into dependency-free `lib/domain/blocklist.ts`.
- Added application use cases for generation, comparison, critique, patching, recovery, and content access. API routes now parse, wire, invoke one use case, and format transport responses.
- Added an executable architecture test that prevents domain imports, application-to-infrastructure imports, route bypasses into engine/project internals, and adapter construction outside the factory.

Pattern/principle: **Ports and Adapters with a Composition Root** — provider, storage, asset, and transport details point inward through interfaces while the application layer owns orchestration.

Verification gate:

```text
npm run build       PASS — Next.js 16.3.1 compiled and generated 22 routes
npm run lint        PASS — no diagnostics
npm run typecheck   PASS — tsc --noEmit
npm test            PASS — tests 49, pass 49, fail 0
```

## Phase D — deployment and operations

Pending.

## What a senior engineer would still flag

This section will be finalized after the last verification gate. Open findings are not considered resolved merely because they are documented.
