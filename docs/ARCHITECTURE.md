# Verve Architecture

## Overview

Verve is a Next.js 16 App Router application that turns spoken or written briefs into distinctive, validated, multi-file web projects. Fast and Studio execution paths converge on one `GeneratedProject` contract.

The user-facing mental model has four macro phases: **Understand → Direct → Build → Prove**. The numbered internal modules below are deterministic or bounded checks inside those phases, not nine independent LLM agents. Fast mode still requires only two core generative calls.

## Pipeline Architecture

Engine functions receive a request-scoped LLM adapter explicitly. Deterministic stages remain pure; generative stages make bounded provider calls.

```
lib/engine/
├── brief-analyzer.ts           01 — structured brief analysis
├── asset-sourcer.ts            02 — photos, icons, font, and image palette
├── media-requirement.ts        02 — brief-specific media policy and readiness gate
├── blocklist-filter.ts         02 — 21-family cliché scan
├── competitive-field.ts       02 — industry pattern constraints
├── brand-archetype-resolver.ts 02.5 — brand archetype
├── animation-language.ts      02.6 — motion tokens
├── plan-generator.ts           03 — design thesis and tokens
├── critique-loop.ts            03 — adversarial revision loop
├── contrast-fixer.ts           04 — deterministic contrast correction
├── code-generator.ts           05 — component generation
├── code-quality-loop.ts        05.5 — TypeScript syntax check and repair
├── scorer.ts                   06 — final-code distinctiveness score
├── engineering-score.ts        06 — engineering score
├── design-diversity.ts         06 — recurring Verve-template fingerprint gate
├── fast-path.ts                 local archetype and deterministic preflight
└── pipeline.ts                 request-scoped orchestration

lib/project/
├── types.ts                    07 — public GeneratedProject contract
├── project-builder.ts          07 — Next.js, React/Vite, and HTML assembly
├── project-validator.ts        07 — multi-file production contract
├── editor-project.ts           workbench edits merged before validation/export
└── brand-kit.ts                owned-media manifest, preview hydration, and binary export
```

## LLM Adapter

All LLM calls go through `lib/llm-adapter/index.ts`. The adapter interface is:

```typescript
interface LLMAdapter {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}
```

To add a provider, implement `LLMAdapter` and register it in `createAdapter()`. Adapters are instantiated per request; there is no mutable provider singleton.

**Current default:** Claude Sonnet 4.6 via `@anthropic-ai/sdk`.

## Data Layer

**Phase 1:** JSON files in `/data/` — loaded at runtime, versioned in git.

- `data/cliches.json` — Community-maintained blocklist
- `data/reference-library.json` — Curated design references for RAG

**Current persistence:** project history and API keys remain in browser `localStorage`. No database, Supabase client, or account is required; remote sync can be added later only as an explicit opt-in.

## API Routes

```
app/api/generate/route.ts          POST — full JSON pipeline
app/api/generate/stream/route.ts   POST — SSE telemetry, heartbeat, and recovery project
app/api/critique/route.ts          POST — standalone design critic
app/api/compare/route.ts           POST — plain-model versus Verve comparison
app/api/cliches/route.ts           GET  — public blocklist
app/api/cliches/suggest/route.ts   POST — community submission
app/api/library/route.ts           GET  — reference library
```

Both generation routes validate the same `GenerationRequestSchema`; JSON and SSE cannot drift into different brand-asset or checkpoint contracts.

## Revision Loop

Plan generation and critique run in a loop inside stage 03:
1. Generate plan (Step 3)
2. Critique plan (Step 4, separate LLM context)
3. If critique fails (>3 high/medium flags), format critique as negative feedback and repeat Step 3
4. Cap at one revision cycle — surface final critique to user regardless

The revision count and critique transcript are always surfaced to the user. Transparency is a differentiator.

## Fast and Studio

Fast mode uses two core generative calls: design plan and entry-code generation. Brief analysis, archetype resolution, critique preflight, contrast, syntax, scoring, and project assembly are local. If provider planning fails, a conservative brief-specific local plan preserves the code-generation attempt. Provider and schema fallbacks remain bounded exceptions.

Fast runs emit bounded versioned checkpoints after stages 01 and 04. A stage-04 checkpoint contains only validated brief analysis and the contrast-enforced design plan, never credentials. It is fingerprinted against the brief, existing code, framework, and mode. If code generation fails, the browser returns that checkpoint with the next request and the pipeline skips the provider plan call.

Studio mode uses the full LLM archetype and adversarial critique flow, one bounded plan revision, and one targeted code repair. OpenRouter deliberately skips the optional repair call because free routed capacity is less predictable. Brief analysis, plan generation, critique, and revision each have a local fail-open contract; only entry-code generation remains a required model result. OpenRouter sends a model list to the gateway so fallback happens inside one stage deadline, and structured stages request strict JSON Schema output.

## Project and preview layer

`buildGeneratedProject()` creates the complete stack scaffold after code validation. `ProjectWorkbench` sends only standalone HTML and lightweight React projects into Sandpack, with file editing and responsive viewports. Complete Next.js projects stay outside the browser runtime and use a deterministic file inspector plus JSZip export for local execution. Generated code never mounts into Verve's own component tree.

For sandboxed projects, `render-gate.ts` adds an ephemeral probe to the in-memory preview files only. The probe reports actual document width, runtime/console errors, computed text sizes, image alternatives, duplicate IDs, and button names through a scoped `postMessage` contract. Probe files never enter history or ZIP exports, and readiness remains `verifying` until a matching rendered report arrives.

Project readiness is separate from distinctiveness. The validator checks scaffold files, entry exports, relative imports, declared packages, fragment targets, form behavior, unsafe HTML injection, image alternatives, button types, motion safeguards, mobile clipping, React list identity, font declarations, tiny text, and unfinished content. Unsupported quantified claims absent from the source brief block production readiness. The deterministic Media Gate also blocks image-dependent briefs until their minimum approved asset count is met. For sandboxed projects, `ProjectWorkbench` reruns code checks against the live editor state and ZIP uses that same state; media warnings remain explicit project-level launch requirements.

Owned image bytes never cross the generation API. The browser sends a bounded manifest (role, path, media type, and user-authored alt direction), attaches the original base64 payload to the returned `GeneratedProject`, hydrates local paths as data URLs only inside the preview, and writes the original bytes into ZIP. HTML assets export under `assets/`; React and Next.js assets export under `public/assets/`.

## Provider terminal states

The SSE route sends a heartbeat every ten seconds with separate `stageElapsedMs` and `totalElapsedMs` values. A run must end in exactly one of two user-visible paths:

- `result` with a complete pipeline response and project; or
- `stage_error` followed by `recovery` with the failed stage and a safe HTML fallback project.

The client also rejects a stream that closes without either terminal event. If three expected heartbeats are missed, the 35-second inactivity watchdog cancels the orphaned request and creates a local recovery checkpoint. The server has a 240-second run-wide deadline below the route's 300-second ceiling.

## Design System

The landing page implements Verve's own rules:
- **Signature Element:** an editorial calibration rail connected to a live project receipt
- **Colors:** ink black, warm paper, and correction vermilion; green is reserved for pass/live data
- **Type:** Manrope (interface), Instrument Serif (editorial thesis), and IBM Plex Mono (telemetry)
- **No:** Inter, blue-to-purple gradients, soft-shadow cards, 4-feature-card grids

## Persistence and secrets

Verve has no database or account layer. Generation history and BYOK provider keys are stored in browser `localStorage`. Keys are included in the selected API request, used to call the provider, and never written to application persistence or logs.
