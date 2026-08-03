# Verve Architecture

## Overview

Verve is a Next.js 15 App Router application with a structured 6-step pipeline that processes design briefs into distinctive, cliché-blocked UI code.

## Pipeline Architecture

Each step is a **pure function wrapping an LLM call**, making them independently testable and swappable.

```
lib/engine/
├── brief-analyzer.ts    Step 1 — Extract structured brief analysis
├── blocklist-filter.ts  Step 2 — Scan against cliché database (pure, no LLM)
├── plan-generator.ts    Step 3 — Generate design token plan with RAG context
├── critique-loop.ts     Step 4 — Adversarial self-critique (separate LLM context)
├── code-generator.ts    Step 5 — Full component code generation
├── scorer.ts            Step 6 — Distinctiveness scoring (pure computation)
└── pipeline.ts          Orchestrator — wires all 6 steps with revision loop
```

## LLM Adapter

All LLM calls go through `lib/llm-adapter/index.ts`. The adapter interface is:

```typescript
interface LLMAdapter {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
}
```

To swap providers: implement `LLMAdapter` and replace the singleton in `getLLMAdapter()`. No engine code needs to change.

**Current default:** Claude 3.5 Sonnet via `@anthropic-ai/sdk`

## Data Layer

**Phase 1:** JSON files in `/data/` — loaded at runtime, versioned in git.

- `data/cliches.json` — Community-maintained blocklist
- `data/reference-library.json` — Curated design references for RAG

**Phase 2:** Postgres (Neon/Supabase recommended) for project history, submission queues, and usage analytics. The data layer is isolated to API routes — engine functions don't touch the database.

## API Routes

```
app/api/generate/route.ts          POST — full pipeline
app/api/critique/route.ts          POST — standalone design critic
app/api/cliches/route.ts           GET  — public blocklist
app/api/cliches/suggest/route.ts   POST — community submission
app/api/library/route.ts           GET  — reference library
```

All routes validate input with Zod schemas before processing.

## Revision Loop

Steps 3 → 4 run in a loop:
1. Generate plan (Step 3)
2. Critique plan (Step 4, separate LLM context)
3. If critique fails (>3 high/medium flags), format critique as negative feedback and repeat Step 3
4. Cap at 2 revision cycles — surface final critique to user regardless

The revision count and critique transcript are always surfaced to the user. Transparency is a differentiator.

## Design System

The landing page implements Verve's own rules:
- **Signature Element:** "Signal Noise" — terminal/oscilloscope aesthetic derived from the product's subject (AI signal vs noise)
- **Colors:** Phosphor green (#39FF14) + terminal amber (#FFAB00) — derived from CRT hardware, not a brand palette generator
- **Type:** Space Grotesk (display) + IBM Plex Mono (body) — monospace body mirrors the code-generation subject matter
- **No:** Inter, blue-to-purple gradients, soft-shadow cards, 4-feature-card grids

## Phase 2 Database Schema (planned)

```sql
-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  brief TEXT NOT NULL,
  brief_analysis JSONB,
  design_plan JSONB,
  critique JSONB,
  code TEXT,
  score INTEGER,
  framework VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cliché submission queue
CREATE TABLE cliche_submissions (
  id UUID PRIMARY KEY,
  pattern TEXT NOT NULL,
  category VARCHAR(20),
  example TEXT,
  severity VARCHAR(10),
  context TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
```
