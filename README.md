# Verve — Every AI website looks the same. Yours won't.

[![MIT License](https://img.shields.io/badge/license-MIT-D49020?style=flat-square)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-white?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Anthropic](https://img.shields.io/badge/Powered%20by-Claude-191919?style=flat-square)](https://anthropic.com)

> **Verve** is an open-source design taste layer that sits between any LLM and its code output — forcing bold, non-generic, context-specific UI instead of the median AI aesthetic.

---

## The problem

AI-generated interfaces converge on the same visual defaults:

| What every model produces | Why |
|---|---|
| Inter or Roboto, 700 weight | Most common font in training data |
| Blue-to-purple hero gradients | Appears in ~40% of SaaS landing pages |
| `rgba(0,0,0,0.08)` soft shadow cards | Default box-shadow in every CSS framework |
| "Build faster. Boost productivity." copy | Highest-frequency hero copy pattern |
| 4-card feature grid | Most common layout after hero |

This isn't a prompting skill issue. It's a **statistical regression-to-the-mean problem**. Every model, trained on the same corpus, learns the average. The average is indistinguishable.

Verve interrupts that convergence **mechanically** — through a structured 6-step pipeline, not by asking the model to "be more creative."

---

## How it works

```
User brief (+ optional existing code)
        ↓
[1] BRIEF ANALYZER       → subject, audience, primary job, tone, industry
        ↓
[2] CLICHÉ BLOCKLIST     → scans brief against 20+ known AI-design tells
                           injects a blocking system prompt into all downstream calls
        ↓
[3] DESIGN PLAN          → color palette (derived from subject matter, not trends)
                           type pairing (with written justification)
                           layout concept
                           signature element (required, non-empty, uniquely justified)
        ↓
[4] ADVERSARIAL CRITIQUE → isolated second LLM call:
                           "Would a generic prompt produce this same plan?"
                           Rejects + regenerates if >3 elements flagged as defaults.
                           Max 2 revision cycles.
        ↓
[5] CODE GENERATION      → full component code, responsive, accessible,
                           prefers-reduced-motion aware. Only after plan passes.
        ↓
[6] DISTINCTIVENESS SCORE → 0-100 score, letter grade (S/A/B/C/D),
                             critique transcript, what was avoided, what remains.
                             Surfaced to you — transparency is the product.
```

Every step is a pure function wrapping an LLM call. Each is independently testable and swappable.

---

## Quickstart

**Prerequisites:** Node.js 18+, an [Anthropic API key](https://console.anthropic.com/account/keys)

```bash
git clone https://github.com/mohasbks/Verve.git
cd Verve
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **No server-side key storage.** Verve runs on your own Anthropic key, sent with each request and never persisted. You can also paste it directly in the UI without touching `.env.local`.

---

## API reference

All endpoints available without authentication in v1. Rate limiting is applied generously for anonymous use.

### `POST /api/generate`
Run the full 6-step pipeline.

```json
// Request
{
  "brief": "A landing page for a carbon accounting SaaS for manufacturing CFOs.",
  "existingCode": "<optional — paste code to redesign>",
  "framework": "nextjs | react | html",
  "apiKey": "<your-anthropic-key>"
}

// Response
{
  "briefAnalysis": { "subject": "...", "audience": "...", "tone": "...", "industry": "..." },
  "plan": {
    "colorPalette": [{ "name": "...", "hex": "#...", "role": "..." }],
    "typePairing": { "display": "...", "body": "...", "rationale": "..." },
    "layoutConcept": "...",
    "signatureElement": { "name": "...", "description": "...", "justification": "..." }
  },
  "critique": { "passed": true, "flaggedElements": [], "verdict": "..." },
  "code": { "code": "...", "framework": "nextjs", "componentName": "...", "setupNotes": "..." },
  "distinctivenessReport": { "score": 91, "grade": "A", "clichesAvoided": [], "recommendations": [] },
  "revisionCount": 0,
  "durationMs": 12400
}
```

### `POST /api/critique`
Standalone design critic — paste code or a URL to get a cliché analysis.

```json
{ "code": "<paste component code>" }
// → { "critique": { "flags": [], "score": 78, "summary": "..." } }
```

### `GET /api/cliches`
Returns the full public blocklist (cached 1h).

### `POST /api/cliches/suggest`
Submit a new cliché pattern (goes to server log + manual PR queue for now).

### `GET /api/library`
Returns the reference library entries used for design plan grounding (cached 1h).

---

## Repo structure

```
/app
  page.tsx                  Landing page (client component)
  /api
    /generate/route.ts      POST — full 6-step pipeline
    /critique/route.ts      POST — standalone design critic
    /cliches/route.ts       GET  — public blocklist
    /cliches/suggest/       POST — community submission
    /library/route.ts       GET  — reference library

/lib
  /engine
    brief-analyzer.ts       Step 1 — extracts structured brief
    blocklist-filter.ts     Step 2 — cliché detection + prompt injection
    plan-generator.ts       Step 3 — design plan with signature element
    critique-loop.ts        Step 4 — adversarial self-critique (max 2 cycles)
    code-generator.ts       Step 5 — framework-specific code output
    scorer.ts               Step 6 — distinctiveness report (0-100)
    design-critic.ts        Module E — standalone critic
    pipeline.ts             Orchestrator (pure function composition)
  /llm-adapter
    index.ts                Provider-agnostic adapter (swap here to change LLM)

/data
  cliches.json              The blocklist — version controlled, community-maintained
  reference-library.json    30 reference designs for plan grounding

/components                 UI (subject to its own blocklist rules)
/docs                       Architecture, CONTRIBUTING, ROADMAP
```

---

## Contributing a cliché pattern

The blocklist is the most leverageable part of Verve. Each new entry tightens what the pipeline can produce.

**5 minutes to contribute:**

1. Open `data/cliches.json`
2. Add an entry:

```json
{
  "id": "category-NNN",
  "category": "color | typography | layout | motion | copy",
  "pattern": "Short, specific name for the pattern",
  "description": "What it is, why it appears, why it's a regression-to-mean tell",
  "example_values": ["specific hex codes, class names, copy strings, or timing values"],
  "severity": "high | medium | low",
  "date_observed": "YYYY-MM-DD",
  "tags": ["keyword1", "keyword2"]
}
```

3. Open a PR titled `cliche: [pattern name]`

**Good entries name a specific, recognizable pattern with real example values.** `"Don't use blue"` is not useful. `"#6366F1 / #8B5CF6 gradient — appears in ~60% of AI-generated SaaS hero sections"` is useful.

---

## Contributing a reference entry

The reference library grounds the design plan generator in high-quality real work. Each entry expands what Verve can draw inspiration from.

```json
{
  "id": "ref-NNN",
  "name": "Company / Project Name",
  "url": "https://example.com",
  "industry": "fintech | developer-tools | portfolio | ...",
  "mood": ["specific adjective 1", "specific adjective 2"],
  "what_makes_it_work": "The named, specific thing that makes this design work. Not 'looks nice.'",
  "specific_techniques": ["named technique 1", "named technique 2"],
  "color_palette": ["#HEX1", "#HEX2", "#HEX3"],
  "tags": ["keyword1", "keyword2"]
}
```

PR title: `reference: [name]`

---

## Design principles for contributors

Components in `/components` are subject to the same blocklist rules as any Verve output:

- **No Inter as primary sans-serif** — Verve uses Space Grotesk + IBM Plex Mono
- **No soft-shadow white cards** — use border + bg-depth variation instead
- **No blue-to-purple gradients** — amber (#D49020) is the only accent
- **One signature element** — clearly named, visually present, justified in comments

If you're adding a UI component, run it mentally against `data/cliches.json` before submitting. Verve must practice what it preaches.

---

## Roadmap

**Phase 1 — current (complete):**
- [x] 6-step pipeline end-to-end
- [x] Standalone design critic
- [x] Community-extensible cliché blocklist (20 entries)
- [x] Reference library (30 entries)
- [x] Landing page dogfooding Verve's own rules

**Phase 2 — after first users:**
- [ ] Community contribution UI (web form → auto-PR, no GitHub account required)
- [ ] Postgres-backed project history (Neon serverless)
- [ ] Public API with rate limiting (Upstash Redis)
- [ ] Distinctiveness scoring v2 (calibrated against usage data)
- [ ] CI/CD (GitHub Actions: typecheck + lint + build on PR)

**Phase 3 — after traction:**
- [ ] Figma MCP bridge — ground plans in existing design tokens
- [ ] Vue + Svelte code output adapters
- [ ] Screenshot analysis via Claude vision API
- [ ] VSCode extension — critic inline on open files

---

## License

MIT. Fork it, extend it, build on it.

---

*Built by [mohasbks](https://github.com/mohasbks) · Open to freelance work in product design and frontend development.*
