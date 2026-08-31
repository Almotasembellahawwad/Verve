# Verve system design review

This review records the observed implementation before the architecture retrofit. It is evidence-led and intentionally distinguishes current behavior from the target architecture.

> This is the discovery snapshot captured before the engineering migration. It is intentionally preserved as the as-is baseline; see `docs/ARCHITECTURE.md` and `docs/MIGRATION_LOG.md` for the enforced post-refactor structure and disposition of these findings.

> The Google Fonts module mentioned in this baseline was removed in 0.12. Current output uses `lib/engine/typography-contract.ts`, bounded local OFL files, and no runtime font API.

## Discovery baseline

The repository was inspected on 2026-08-28 at `df2f681` with pre-existing, uncommitted product-readiness work in the working tree. Those changes were preserved. The required baseline commands produced these terminal results:

| Command | Result | Exact terminal conclusion |
|---|---|---|
| `npm run build` | Pass | `Compiled successfully`; 22 static/dynamic routes generated; exit 0 |
| `npm run lint` | Pass | ESLint produced no diagnostics; exit 0 |
| `npm run typecheck` | Pass | `tsc --noEmit`; exit 0 |
| `npm test` | Pass | `tests 44`, `pass 44`, `fail 0`; exit 0 |
| `npm audit --omit=dev` | Pass | `found 0 vulnerabilities`; exit 0 |

On this Windows host the first invocation of `npm` was intercepted by the PowerShell execution policy. Re-running the same commands through `npm.cmd` reached the project and produced the results above.

### Observed tree (three levels)

```text
app/
  api/
    cliches/{route.ts,suggest/}
    compare/route.ts
    critique/route.ts
    generate/{route.ts,stream/}
    jobs/[jobId]/
    library/route.ts
    patch/route.ts
    readme/route.ts
  demos/{page.tsx,DemosClient.tsx,demos.module.css}
  docs/{page.tsx,docs.module.css}
  lab/{page.tsx,LabClient.tsx,lab.module.css}
  showcase/{page.tsx,showcase.module.css}
  layout.tsx
  page.tsx
  globals.css
  manifest.ts
  robots.ts
  sitemap.ts
components/
  ApiKeyModal.*
  BrandKitInput.*
  GeneratePanel.*
  HistoryDrawer.*
  OnboardingModal.*
  ProjectWorkbench.*
  VoiceBriefInput.*
lib/
  api/{generation-request.ts,pipeline-response.ts}
  client/{generation-stream.ts,key-storage.ts}
  demo/{public-demo.ts,public-demo-gallery.ts}
  engine/
    brief-analyzer.ts
    asset-sourcer.ts
    blocklist-filter.ts
    competitive-field.ts
    brand-archetype-resolver.ts
    animation-language.ts
    plan-generator.ts
    critique-loop.ts
    contrast-fixer.ts
    code-generator.ts
    code-quality-loop.ts
    scorer.ts
    engineering-score.ts
    design-diversity.ts
    pipeline.ts
  llm-adapter/{types.ts,index.ts,claude.ts,openai.ts,gemini.ts,openrouter.ts}
  middleware/{error-handler.ts,rate-limit.ts}
  project/{types.ts,project-builder.ts,project-validator.ts,render-gate.ts,brand-kit.ts}
  security/safe-url.ts
  share/result-share.ts
  export.ts
  history.ts
  site.ts
```

## Based on this discovery, here is what I believe the current architecture actually is

Verve is a Next.js 16 App Router application whose server-side generation behavior is centered on one request-scoped orchestration function. Route handlers parse input, perform process-local rate limiting, construct or indirectly construct provider adapters, call engine functions, and serialize JSON or SSE. The generation engine is modular at the function level, and most deterministic rules are testable, but folder names do not yet enforce hexagonal dependency direction: orchestration constructs an adapter, imports project assembly, and calls asset infrastructure directly (`lib/engine/pipeline.ts:17-45`, `lib/engine/pipeline.ts:158-163`).

The provider abstraction is already request-scoped and consumers use a provider-neutral `complete()` contract (`lib/llm-adapter/types.ts:6-32`). Construction is centralized in the factory (`lib/llm-adapter/index.ts:33-54`). Fast and Studio are behavioral variants, but the selection policy is distributed across the orchestrator (`lib/engine/pipeline.ts:168-176`, `lib/engine/pipeline.ts:210-212`, `lib/engine/pipeline.ts:246-309`, `lib/engine/pipeline.ts:384-387`, `lib/engine/pipeline.ts:421-427`) rather than represented by a strategy object.

Project history is a browser concern backed directly by `localStorage` (`lib/history.ts:26-78`). The blocklist and reference library are compile-time JSON imports (`lib/engine/blocklist-filter.ts:1`, `lib/engine/plan-generator.ts:5`). Rate limiting and concurrency use process-local maps, so the deployed system has no global admission control across Vercel instances (`lib/middleware/rate-limit.ts:3-12`, `lib/middleware/rate-limit.ts:27`).

## Actual as-is data flow

```text
HTTP request
  -> route-local rate limit + concurrent slot
  -> Zod request parsing
  -> request-scoped provider adapter construction
  -> [01] brief analysis
       Fast: local | Studio: provider with local fallback | checkpoint resume
  -> [02] in parallel
       blocklist scan | asset/media sourcing | competitive-field analysis
  -> [02.5] archetype resolution
       Fast: local | Studio: provider
  -> [02.6] deterministic animation language
  -> [03] plan generation with local fallback
  -> [03] critique and optional one-pass revision
       Fast: local preflight | Studio: provider with local fallback
  -> [04] deterministic contrast correction
  -> [05] provider code generation
  -> [05.5] syntax/quality loop and optional Studio repair
  -> delivered-code blocklist + restraint + engineering + diversity checks
  -> [06] distinctiveness score and evidence caps
  -> [07] asset-usage evidence + project assembly + validation/readiness
  -> serialized JSON OR observer events -> SSE framing
```

Evidence: the parallel stage is explicit at `lib/engine/pipeline.ts:197-205`; plan and critique share stage 03 at `lib/engine/pipeline.ts:240-370`; contrast precedes code at `lib/engine/pipeline.ts:372-407`; quality and deterministic checks run at `lib/engine/pipeline.ts:415-465`; scoring and assembly run at `lib/engine/pipeline.ts:467-512`.

### Divergence from the requested conceptual flow

- No server-side auth layer exists before rate limiting. The product is anonymous BYOK, and API-key authentication is provider authentication, not application-user authentication (`app/api/generate/route.ts:11-31`).
- Asset sourcing is not after brief analysis as a single serial step; it runs concurrently with the input blocklist and competitive analysis (`lib/engine/pipeline.ts:197-204`).
- Critique is not a stage after plan generation in telemetry; it is folded into stage 03 and its revision loop (`lib/engine/pipeline.ts:240-370`).
- Contrast correction is stage 04, while code generation is stage 05; this is consistent behavior but differs from comments at the top of the orchestrator (`lib/engine/pipeline.ts:5-14`, `lib/engine/pipeline.ts:372-407`).
- Quality, blocklist, restraint, engineering, and diversity checks all occur before the named stage-06 scoring event (`lib/engine/pipeline.ts:415-475`).
- ZIP creation is a client-side export concern, separate from project assembly. `buildGeneratedProject()` accumulates files and validates them; packaging is outside the builder (`lib/project/project-builder.ts:115-127`, `lib/project/project-builder.ts:286`).

## Bounded contexts and boundary quality

| Context | Current modules | Boundary assessment |
|---|---|---|
| Generation Engine | `lib/engine/pipeline.ts`, brief/archetype/plan/code modules | **Present but leaking.** Functions are modular, but one orchestrator constructs infrastructure and embeds mode policy. |
| Quality & Critique | blocklist, critique, contrast, restraint, scoring, quality loop, diversity | **Mostly cohesive, incompletely isolated.** Deterministic rules are testable; JSON data and LLM contracts are imported directly rather than supplied through ports. |
| Asset Sourcing | asset sourcer, media requirement, fonts, owned brand kit | **Leaking.** Pexels fetch and Google Fonts configuration live in engine modules; the font module reads `process.env` and retains a module cache (`lib/engine/fonts-intelligence.ts:97-119`). |
| Project Assembly & Export | `lib/project/*`, `lib/export.ts`, workbench ZIP | **Respected.** Assembly and runtime validation are server-neutral; browser download behavior is separate. The builder is currently a functional builder rather than a formal class. |
| Platform concerns | adapters, rate limit, error handler, API routes | **Partially respected.** Provider SDKs stay inside adapters, but rate limiting returns Next responses directly and orchestration creates adapters. |
| UI / Workbench | `app/*` pages, `components/*`, `lib/client/*` | **Mostly respected.** Browser key/history state remains client-side. The large `GeneratePanel` is a UI orchestration hotspot, but it does not own server engine rules. |

## Pattern audit before changes

| Pattern | State | Evidence and judgment |
|---|---|---|
| Adapter (LLM) | Correctly present | Provider-neutral messages/options and `complete()` at `lib/llm-adapter/types.ts:6-32`; SDK clients are confined to provider implementations. |
| Strategy (Fast/Studio) | Present but leaking | Mode decisions are repeated throughout `lib/engine/pipeline.ts:168-176`, `210-212`, `246-309`, `384-387`, and `421-427`. |
| Factory (adapter construction) | Correctly present | Concrete construction is in `lib/llm-adapter/index.ts:33-54`; route and engine call sites use `createAdapter()`. |
| Pipeline / Chain of Responsibility | Present but incomplete | Stages have observable boundaries, but share many mutable locals in one 400-line function (`lib/engine/pipeline.ts:112-546`). |
| Circuit breaker | Absent and needed | Provider adapters have timeouts/retries, but no shared closed/open/half-open failure policy; Pexels and Fonts calls also have none. |
| Repository | Absent and needed | JSON imports and browser storage are concrete (`lib/engine/blocklist-filter.ts:1`, `lib/engine/plan-generator.ts:5`, `lib/history.ts:26-78`). |
| Observer / pub-sub | Correctly present, informal | Engine emits through `onEvent` (`lib/engine/pipeline.ts:140-150`); only the route frames events as SSE (`app/api/generate/stream/route.ts:54-89`). |
| Builder | Correctly present as functions | File accumulation/finalization are in project builder; ZIP/browser download remains separate. |
| Dependency injection | Present but incomplete | LLM is request-scoped, but the pipeline constructs it and asset/font infrastructure reads concrete configuration. |

## Non-functional requirements scorecard

| Requirement | Rating | Evidence |
|---|---|---|
| Scalability (100 concurrent Vercel users) | **Critical Gap** | Process-local request windows and concurrent counts cannot coordinate serverless instances (`lib/middleware/rate-limit.ts:3-12`, `27`). Long Studio requests also hold one function for up to 240 seconds (`app/api/generate/stream/route.ts:48-53`). |
| Reliability | **Adequate** | Request cancellation, total deadline, heartbeat, optional-stage fallback, checkpoints, and recovery are implemented (`app/api/generate/stream/route.ts:48-72`, `93-115`). Missing circuit breakers allow repeated calls to a known-down dependency. |
| Security | **Adequate** | Zod bounds input, errors are redacted and correlated (`lib/middleware/error-handler.ts:26-58`), remote URL checks exist, and `.env*` is ignored. There is deliberately no app identity/auth boundary, so abuse controls depend entirely on rate limiting. |
| Cost predictability | **Weak** | Fast mode and bounded revision/repair reduce cost, but anonymous endpoints lack distributed admission control and provider-wide circuit state. Compare also starts two model paths concurrently (`app/api/compare/route.ts:81-93`). |
| Observability | **Weak** | Failures have request IDs and sanitized logs (`lib/middleware/error-handler.ts:56-59`), but successful stage telemetry is sent only to the connected SSE client. Logs alone cannot reconstruct a successful or degraded run. |

## Single points of failure and coupling hotspots

- `runPipeline()` is the central change hotspot: mode policy, checkpoints, external calls, scoring, project assembly, and telemetry all meet in one function (`lib/engine/pipeline.ts:112-546`).
- In-memory rate-limit state is both a correctness gap and a process-level singleton (`lib/middleware/rate-limit.ts:27`).
- Google Fonts uses a mutable module cache and reads configuration mid-call (`lib/engine/fonts-intelligence.ts:97-119`).
- Static JSON imports tie domain decisions to one persistence mechanism (`lib/engine/blocklist-filter.ts:1`, `lib/engine/plan-generator.ts:5`).
- Provider construction is duplicated across route composition roots and inside the pipeline (`app/api/compare/route.ts:81-92`, `lib/engine/pipeline.ts:158-163`). The factory is correct, but ownership is not yet consistently at the outer boundary.
- SSE transport itself is correctly outside business stages, but the streaming route owns timeout, heartbeat, checkpoint capture, recovery assembly, and event formatting in one controller (`app/api/generate/stream/route.ts:42-122`).
