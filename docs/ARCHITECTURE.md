# Verve Architecture

## Overview

Verve is a Next.js 16 App Router application with nine observable pipeline stages that turn design briefs into distinctive, validated UI code.

## Pipeline Architecture

Engine functions receive a request-scoped LLM adapter explicitly. Deterministic stages remain pure; generative stages make bounded provider calls.

```
lib/engine/
├── brief-analyzer.ts           01 — structured brief analysis
├── asset-sourcer.ts            02 — photos, icons, font, and image palette
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
└── pipeline.ts                 request-scoped orchestration
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

**Current persistence:** project history and API keys remain in browser `localStorage`. No database or account is required; remote sync can be added later only as an explicit opt-in.

## API Routes

```
app/api/generate/route.ts          POST — full JSON pipeline
app/api/generate/stream/route.ts   POST — SSE pipeline telemetry
app/api/critique/route.ts          POST — standalone design critic
app/api/compare/route.ts           POST — plain-model versus Verve comparison
app/api/cliches/route.ts           GET  — public blocklist
app/api/cliches/suggest/route.ts   POST — community submission
app/api/library/route.ts           GET  — reference library
```

All routes validate input with Zod schemas before processing.

## Revision Loop

Plan generation and critique run in a loop inside stage 03:
1. Generate plan (Step 3)
2. Critique plan (Step 4, separate LLM context)
3. If critique fails (>3 high/medium flags), format critique as negative feedback and repeat Step 3
4. Cap at 2 revision cycles — surface final critique to user regardless

The revision count and critique transcript are always surfaced to the user. Transparency is a differentiator.

## Design System

The landing page implements Verve's own rules:
- **Signature Element:** an editorial calibration rail connected to a live "Taste Trace" review card
- **Colors:** ink black, warm paper, and correction vermilion; green is reserved for pass/live data
- **Type:** Manrope (interface), Instrument Serif (editorial thesis), and IBM Plex Mono (telemetry)
- **No:** Inter, blue-to-purple gradients, soft-shadow cards, 4-feature-card grids

## Persistence and secrets

Verve has no database or account layer. Generation history and BYOK provider keys are stored in browser `localStorage`. Keys are included in the selected API request, used to call the provider, and never written to application persistence or logs.
