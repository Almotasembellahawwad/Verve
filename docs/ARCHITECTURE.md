# Verve architecture

## System boundary

Verve is a Next.js 16 App Router application that turns a written or spoken brief into a validated multi-file web project. The browser owns BYOK credentials, optional owned-media bytes, preview state, editing, history, and ZIP download. The server owns bounded generation orchestration, deterministic quality rules, external provider calls, asset discovery, admission control, and response/SSE transport.

Fast and Creative converge on one `PipelineResult` and `GeneratedProject` contract. `studio` is a request alias for Creative. Project readiness, diversity evidence, descriptive experience review, execution provenance, and actual asset use remain separate evidence axes.

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
  -> direction exploration (`/api/directions/stream`)
       Fast: one six-candidate call
       Creative: two independent three-candidate calls
       brief-sensitive selection from 18 cells -> quality floor -> archive novelty -> brief fit -> signed checkpoint
  -> generation use case
       [01] brief analysis
       [02] blocklist + asset sourcing + competitive field (parallel)
       [02.5] archetype resolution
       [02.6] motion language
       [03] plan + critique + optional revision
       [04] deterministic contrast correction
       [04.1] direction diversity and local novelty selection
       [04.15] executable Typography Contract: script-aware profile + local OFL file manifest
       [04.18] source-bound Brief Evidence Ledger: records, attributes, comparisons, exclusions, gaps
       [04.2] ProjectSpec Visual Narrative: semantic routes, evidence-shaped story scenes, per-scene Composition Genome, richness budget
       [04.3] Scene Asset Director: licensed catalog, scene purpose, framing, fallback, expected layers
       [05] code generation
       [05.5] syntax/quality + whole-project Brief Evidence Realization + optional repair
       delivered-code quality, restraint, engineering, diversity checks
       [06] evidence-bounded scoring
       [07] rendered FVE/FVF/RES/DF + asset-use evidence + project assembly + validation/readiness
  -> JSON response OR observer events framed as SSE
  -> concurrent lease release
```

The blocklist rule itself is dependency-free (`lib/domain/blocklist.ts:29`). Storage is supplied through `BlocklistRepositoryPort`. The same pattern is used for the reference library, history, documents, and suggestion submissions.

## Deliberately applied patterns

| Pattern | Location | Why it fits |
|---|---|---|
| Adapter + Port | `lib/ports/llm.ts`, `lib/adapters/llm/*` | Provider SDKs vary while generation needs one stable completion contract. |
| Factory | `lib/adapters/llm/factory.ts` | Model validation and concrete construction must have one audited path. |
| Strategy | `lib/application/generation-strategy.ts` | Fast and Creative vary policy, call budgets, critique, checkpoints, and repair without changing delivery contracts. |
| Pipeline / Chain of Responsibility | `lib/application/pipeline-stage.ts` | Stages need immutable input snapshots, isolated tests, and reorderability. The main orchestrator is being extracted into this contract incrementally. |
| Circuit Breaker + Decorator | `lib/application/circuit-breaker.ts`, `lib/adapters/llm/circuit-breaking-llm.ts` | Repeated calls to a failing provider should stop spending latency and quota, without provider branches in consumers. |
| Repository | `lib/ports/repositories.ts`, `lib/adapters/storage/*` | Static JSON, browser storage, filesystem content, and future DB/KV stores must be replaceable without changing business rules. |
| Observer | `lib/ports/progress.ts`, progress adapters | Pipeline behavior publishes facts; SSE and structured logs independently observe them. |
| Builder | `lib/project/project-builder.ts` | Project files/config are accumulated and finalized separately from browser ZIP packaging. |
| Dependency Injection | `GenerationDependencies` | Every request owns provider, asset, repository, progress, and configuration state; application code does not read mutable global request state. |

## LLM and resilience boundary

`LLMPort.complete()` contains only provider-neutral messages and options. Provider SDK request/response types do not cross `lib/adapters/llm`. `createAdapter()` wraps each request-scoped provider with a failure-window circuit breaker. Fast/Creative policy never branches on concrete provider except one explicit cost/reliability capability: Creative repair is disabled for OpenRouter's free routed capacity.

Fast is the shared default, defined once as a dependency-free domain value and consumed by the request schema, application use case, and client workbench. Creative is explicit opt-in, while `studio` normalizes to Creative for older clients; both modes return the same project/evidence contract.

Optional analysis, planning, and critique fail open to deterministic fallbacks. Required code generation fails to a visible recovery project. The stream has a 240-second application deadline, ten-second heartbeats, client cancellation, stage errors, and checkpoint recovery.

## Asset boundary

`AssetSourcePort` separates discovery from Pexels. `PexelsAssetSourceAdapter` owns the key and a request-scoped circuit breaker (`lib/adapters/assets/pexels-asset-source.ts`). Owned binary assets remain browser-local; the server receives only a bounded manifest. `asset-director.ts` turns approved sources into a licensed catalog and assigns them to Story Graph scenes with purpose, framing, alt intent, and fallback. A fetched asset is not counted as used until `asset-usage.ts` finds its URL, verifies required attribution, and traces its assigned asset ID in delivered code.

`AssetDeliveryPort` is a separate post-generation capability. The Pexels delivery adapter accepts only exact HTTPS `images.pexels.com` URLs without credentials, ports, or redirects; it streams into a 1.2 MB per-file cap, enforces a 2.4 MB project cap, validates JPEG/PNG/WebP signatures, and computes SHA-256. The conservative binary budget leaves room for Base64 expansion plus the surrounding streamed project response under intermediary payload envelopes. Only Pexels assets actually referenced by delivered source are copied. Source references and ProjectSpec catalog URLs are rewritten to framework-correct local paths, binary files enter preview and ZIP, and `ASSETS.md` preserves the source page, API credit, Pexels License link, media type, size, checksum, and standalone-redistribution/third-party-rights warning. Failure leaves the remote preview dependency visible and blocks production readiness. The checksum proves delivered-byte identity, not ownership, endorsement, third-party clearance, or continuing license validity.

## Typography boundary

Typography has an independent delivery boundary. `typography-contract.ts` selects from a curated local OFL catalog only after the final direction and script are known. It emits role assignments, exact package files, Unicode coverage, fallback policy, and deterministic CSS. The delivery step copies WOFF2 bytes into the generated project under a 500 KB cap, records SHA-256 and provenance, includes complete license text in `FONT-LICENSES.md`, and injects the contract after authored CSS so an accidental Georgia, Times, Verdana, or generic system default cannot win the cascade. Validation checks that declared binaries exist, CSS URLs resolve, contracted families are applied, and the license file ships. No browser-time Google Fonts request or font API key is part of generation.

## Brief evidence boundary

`brief-evidence.ts` performs bounded deterministic extraction from the original English or Arabic brief. Every evidence item stores a verbatim span, source length, and digest; validation fails if a checkpoint is rebound to changed input. Quoted and list-form records are kept separate from collection totals, while comparison dimensions, explicit exclusions, and missing-record/missing-value gaps remain first-class data. The extractor does not call a provider and does not infer absent item-level facts.

ProjectSpec maps those evidence IDs into Story Graph scenes and information shapes. After generation, `brief-evidence-realization.ts` inspects entry plus supporting source files for known record labels, supplied attributes, requested dimensions, explicit gap disclosure, and prohibited patterns. This is source realization evidence, not proof that content is visually prominent; Render Gate remains responsible for rendered visibility and responsive truth. Creative can spend its already-bounded repair pass on a failed realization check. Fast returns the same measured warning without adding a provider call.

[Composition Genome](COMPOSITION_GENOME.md) compiles every story scene into seven categorical spatial axes. The deterministic selector first respects the scene's information shape, medium, and chosen experience model, then maximizes weighted distance from already assigned scenes. Generated scene roots trace the exact structure, flow, and depth genes into the existing Visual Intent source gate. [Rendered Composition Realization](RENDERED_COMPOSITION_REALIZATION.md) then measures the resulting child geometry, detects adjacent spatial repetition, and compares the 360px and 1440px transforms. Neither source trace nor RCR claims aesthetic quality.

## Project and preview boundary

`buildGeneratedProject()` creates Next.js, React/Vite, or HTML scaffolds, runs deterministic validation, and computes three-axis readiness. Static HTML is delivered as `index.html`, `styles.css`, and optional `script.js`. Browser ZIP packaging consumes the current edited project, not the original response.

HTML and lightweight React run in isolated previews. Next.js output is inspected and exported rather than mounted into an incompatible browser runtime. Render probes are ephemeral and never enter history or ZIP files. When a ProjectSpec is present, the probe computes rendered Functional Visual Fulfillment from visible scene roots, actual DOM layers, purpose links, required asset placements, and orphan visual area. It also computes [Rendered Evidence Salience](RENDERED_EVIDENCE_SALIENCE.md) from opaque scene-bound evidence markers, weighted coverage, local prominence, and first-viewport placement, plus RCR from bounded scene geometry. These are readiness signals, not creativity scores.

## Persistence

- Blocklist and reference library: versioned static JSON repositories.
- Generation history: browser repository over `localStorage`, capped at 20 entries.
- Editable projects: browser IndexedDB repository, complete canonical project files, autosave, and up to eight local revisions per project (`lib/ports/editor-projects.ts`, `lib/adapters/storage/indexeddb-editor-project-repository.ts`).
- Provider/Pexels keys: browser-local BYOK storage; never application persistence.
- Cliché suggestions: structured-log repository pending a durable review queue.

## Admission control

Managed deployments should configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Rate windows and concurrent leases are atomic Redis Lua operations over the Upstash REST API (`lib/adapters/rate-limit/upstash-rate-limit-store.ts:37`). IP values are SHA-256 digests before becoming Redis keys. A deployment missing Redis configuration remains usable through a process-local memory fallback and reports degraded health. A configured but unavailable Upstash store still fails closed with HTTP 503.

The public middleware interface remains `checkRateLimit()` and `acquireConcurrentSlot()` (`lib/middleware/rate-limit.ts:45`, `lib/middleware/rate-limit.ts:60`). Leases have TTLs so an interrupted serverless invocation cannot permanently consume capacity.

## Observability and health

The SSE observer and structured-log observer receive the same stage events. JSON logs contain `requestId`, stage/event identity, duration, retry/degradation metadata, and exclude briefs, credentials, generated code, checkpoints, and unapproved nested fields (`lib/adapters/observability/structured-log-progress-publisher.ts:3-49`, `tests/engine.test.ts:289-315`). Terminal error logs use the same request ID and redact common key formats.

`GET /api/health` reports environment, commit SHA, and configuration readiness without consuming provider quota (`app/api/health/route.ts:7`). Managed deployments using process-local admission return `degraded`; strict deployments missing distributed admission control return 503.

Sentry or an equivalent exception tracker is not installed. Structured Vercel logs support reconstruction; alerting and longer retention remain an explicit operations gap.

## CI/CD, environments, and rollback

Pull requests and `main` run typecheck, lint, unit tests, production build, and Playwright. CodeQL analyzes JavaScript/TypeScript on pushes, pull requests, and a weekly schedule; pull requests also run dependency review. A weekly workflow runs `npm audit --omit=dev --audit-level=high`, and Dependabot proposes grouped dependency updates. Every third-party workflow action is pinned to an immutable commit SHA. `.env*` is ignored except `.env.example`.

Preview and Production must use separate Upstash databases/tokens. Provider and Pexels keys remain browser-local BYOK values and are not Vercel variables. `/api/health` exposes `VERCEL_GIT_COMMIT_SHA`, making a deployment traceable to source. Rotation, the required GitHub branch-ruleset status check, and one-step rollback (`vercel rollback`) are documented in `docs/OPERATIONS.md`.
