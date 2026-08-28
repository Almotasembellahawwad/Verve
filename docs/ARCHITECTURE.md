# Verve architecture

## System boundary

Verve is a Next.js 16 App Router application that turns a written or spoken brief into a validated multi-file web project. The browser owns BYOK credentials, optional owned-media bytes, preview state, editing, history, and ZIP download. The server owns bounded generation orchestration, deterministic quality rules, external provider calls, asset discovery, admission control, and response/SSE transport.

Fast and Studio converge on one `PipelineResult` and `GeneratedProject` contract. Project readiness, distinctiveness, execution provenance, and actual asset use remain separate evidence axes.

## Enforced dependency direction

```text
Browser UI / Workbench
        |
        v
app/api/* route handlers
  parse + rate limit + compose + invoke + format
        |
        +-----------------------> lib/adapters/*
        |                          SDK / REST / filesystem / browser storage
        |                                  |
        v                                  v
lib/application/* --------------------> lib/ports/*
  use cases + strategies + pipeline       interfaces and contracts
        |
        +-----------------------> lib/domain/*
        |                          dependency-free business rules
        |
        +-----------------------> lib/engine/* + lib/project/*
                                   legacy domain/generation services being
                                   migrated incrementally; no route imports
```

The composition root creates request-scoped LLM, asset, repository, circuit-breaker, progress, and model dependencies (`lib/adapters/composition-root.ts:21`). The generation use case accepts those dependencies explicitly and receives no API key, Pexels key, Next.js response, or environment access (`lib/application/run-generation-use-case.ts:105-123`). Concrete LLM construction exists only in `lib/adapters/llm/factory.ts`.

The boundary test at `tests/engine.test.ts:225` fails when:

- a `lib/domain` file imports anything;
- `lib/application` imports adapters, legacy LLM infrastructure, Next.js, or `process.env`;
- an API route imports `lib/engine` or `lib/project` directly; or
- a concrete provider is constructed outside the adapter factory.

`lib/engine` is now a compatibility and legacy-domain area, not the composition layer. `lib/engine/pipeline.ts` is a re-export facade; the real orchestrator is `lib/application/run-generation-use-case.ts:120`.

## Request flow

```text
request
  -> distributed rate window (Upstash Redis in managed environments)
  -> schema validation
  -> distributed concurrent lease
  -> request-scoped composition root
  -> generation use case
       [01] brief analysis
       [02] blocklist + asset sourcing + competitive field (parallel)
       [02.5] archetype resolution
       [02.6] motion language
       [03] plan + critique + optional revision
       [04] deterministic contrast correction
       [05] code generation
       [05.5] syntax/quality + optional repair
       delivered-code quality, restraint, engineering, diversity checks
       [06] evidence-bounded scoring
       [07] asset-use evidence + project assembly + validation/readiness
  -> JSON response OR observer events framed as SSE
  -> concurrent lease release
```

The blocklist rule itself is dependency-free (`lib/domain/blocklist.ts:29`). Storage is supplied through `BlocklistRepositoryPort`. The same pattern is used for the reference library, history, documents, and suggestion submissions.

## Deliberately applied patterns

| Pattern | Location | Why it fits |
|---|---|---|
| Adapter + Port | `lib/ports/llm.ts`, `lib/adapters/llm/*` | Provider SDKs vary while generation needs one stable completion contract. |
| Factory | `lib/adapters/llm/factory.ts` | Model validation and concrete construction must have one audited path. |
| Strategy | `lib/application/generation-strategy.ts` | Fast and Studio vary policy, call budgets, critique, checkpoints, and repair without changing delivery contracts. |
| Pipeline / Chain of Responsibility | `lib/application/pipeline-stage.ts` | Stages need immutable input snapshots, isolated tests, and reorderability. The main orchestrator is being extracted into this contract incrementally. |
| Circuit Breaker + Decorator | `lib/application/circuit-breaker.ts`, `lib/adapters/llm/circuit-breaking-llm.ts` | Repeated calls to a failing provider should stop spending latency and quota, without provider branches in consumers. |
| Repository | `lib/ports/repositories.ts`, `lib/adapters/storage/*` | Static JSON, browser storage, filesystem content, and future DB/KV stores must be replaceable without changing business rules. |
| Observer | `lib/ports/progress.ts`, progress adapters | Pipeline behavior publishes facts; SSE and structured logs independently observe them. |
| Builder | `lib/project/project-builder.ts` | Project files/config are accumulated and finalized separately from browser ZIP packaging. |
| Dependency Injection | `GenerationDependencies` | Every request owns provider, asset, repository, progress, and configuration state; application code does not read mutable global request state. |

## LLM and resilience boundary

`LLMPort.complete()` contains only provider-neutral messages and options. Provider SDK request/response types do not cross `lib/adapters/llm`. `createAdapter()` wraps each request-scoped provider with a failure-window circuit breaker. Fast/Studio policy never branches on concrete provider except one explicit cost/reliability capability: Studio repair is disabled for OpenRouter's free routed capacity.

Fast is the shared default, defined once as a dependency-free domain value and consumed by the request schema, application use case, and client workbench (`lib/domain/generation-mode.ts:1-6`, `lib/api/generation-request.ts:30`, `lib/application/run-generation-use-case.ts:136`, `components/GeneratePanel.tsx:263`). Studio remains an explicit opt-in and both modes return the same project/evidence contract.

Optional analysis, planning, and critique fail open to deterministic fallbacks. Required code generation fails to a visible recovery project. The stream has a 240-second application deadline, ten-second heartbeats, client cancellation, stage errors, and checkpoint recovery.

## Asset boundary

`AssetSourcePort` separates the application use case from Pexels. `PexelsAssetSourceAdapter` owns the key and a request-scoped circuit breaker (`lib/adapters/assets/pexels-asset-source.ts:6`). Owned binary assets remain browser-local; the server receives only a bounded manifest. A fetched asset is not counted as used until `asset-usage.ts` finds its URL in delivered code and verifies required attribution.

## Project and preview boundary

`buildGeneratedProject()` creates Next.js, React/Vite, or HTML scaffolds, runs deterministic validation, and computes three-axis readiness. Static HTML is delivered as `index.html`, `styles.css`, and optional `script.js`. Browser ZIP packaging consumes the current edited project, not the original response.

HTML and lightweight React run in isolated previews. Next.js output is inspected and exported rather than mounted into an incompatible browser runtime. Render probes are ephemeral and never enter history or ZIP files.

## Persistence

- Blocklist and reference library: versioned static JSON repositories.
- Generation history: browser repository over `localStorage`, capped at 20 entries.
- Provider/Pexels keys: browser-local BYOK storage; never application persistence.
- Cliché suggestions: structured-log repository pending a durable review queue.

## Admission control

Managed deployments require `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Rate windows and concurrent leases are atomic Redis Lua operations over the Upstash REST API (`lib/adapters/rate-limit/upstash-rate-limit-store.ts:37`). IP values are SHA-256 digests before becoming Redis keys. Missing Redis configuration or an unavailable admission store fails closed with HTTP 503. Local development alone uses an in-memory fallback.

The public middleware interface remains `checkRateLimit()` and `acquireConcurrentSlot()` (`lib/middleware/rate-limit.ts:45`, `lib/middleware/rate-limit.ts:60`). Leases have TTLs so an interrupted serverless invocation cannot permanently consume capacity.

## Observability and health

The SSE observer and structured-log observer receive the same stage events. JSON logs contain `requestId`, stage/event identity, duration, retry/degradation metadata, and exclude briefs, credentials, generated code, checkpoints, and unapproved nested fields (`lib/adapters/observability/structured-log-progress-publisher.ts:3-49`, `tests/engine.test.ts:289-315`). Terminal error logs use the same request ID and redact common key formats.

`GET /api/health` reports environment, commit SHA, and configuration readiness without consuming provider quota (`app/api/health/route.ts:7`). Managed deployments without distributed admission control return 503.

Sentry or an equivalent exception tracker is not installed. Structured Vercel logs support reconstruction; alerting and longer retention remain an explicit operations gap.

## CI/CD, environments, and rollback

Pull requests and `main` run typecheck, lint, unit tests, production build, and Playwright. A weekly workflow runs `npm audit --omit=dev --audit-level=high`. `.env*` is ignored except `.env.example`.

Preview and Production must use separate Upstash databases/tokens. Provider and Pexels keys remain browser-local BYOK values and are not Vercel variables. `/api/health` exposes `VERCEL_GIT_COMMIT_SHA`, making a deployment traceable to source. Rotation, the required GitHub branch-ruleset status check, and one-step rollback (`vercel rollback`) are documented in `docs/OPERATIONS.md`.
