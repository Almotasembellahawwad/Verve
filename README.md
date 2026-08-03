# Verve — Every AI website looks the same. Yours won't.

[![MIT License](https://img.shields.io/badge/license-MIT-39FF14?style=flat-square)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-white?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)

**Verve is an open-source design taste layer that sits between any LLM and its code output, forcing bold, non-generic, context-specific UI design instead of the median AI aesthetic.**

---

## Why this exists

AI-generated interfaces converge on the same visual defaults: Inter or Roboto, safe blue/gray or purple gradients, four cards in a grid, faint hover states, cream-and-serif or near-black-and-neon color schemes.

This isn't a prompting skill issue. It's a **statistical regression-to-the-mean problem** inherent to how LLMs generate design. Every model, trained on the same corpus of UI code, learns the average — and the average is indistinguishable.

Verve interrupts that convergence **mechanically**, through a structured pipeline, not by asking the model to "be more creative."

---

## How it works — the 6-step pipeline

```
User input (design brief + optional existing code)
        ↓
[1] BRIEF ANALYZER       → subject, audience, primary job, tone, industry
        ↓
[2] CLICHÉ BLOCKLIST     → scans brief against 20+ known AI-design tells
        ↓
[3] DESIGN PLAN          → color palette, type pairing, layout concept,
                           signature element (required, non-empty)
        ↓
[4] ADVERSARIAL CRITIQUE → separate LLM call: "Would a generic prompt
                           produce this same plan?" Rejects + regenerates
                           if >3 elements flagged as defaults. Max 2 cycles.
        ↓
[5] CODE GENERATION      → only after plan passes critique. Full component
                           code, responsive, accessible, motion-safe.
        ↓
[6] DISTINCTIVENESS SCORE → 0-100 score, grade, critique transcript
                            surfaced to user — transparency is the product
```

Every step is a pure function wrapping an LLM call. Each is independently testable.

---

## Quickstart

**Prerequisites:** Node.js 18+, an Anthropic API key

```bash
git clone https://github.com/verve-project/verve
cd verve
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The landing page itself runs through Verve's own rules — it's the first proof that the tool works.

---

## API

All endpoints are available without authentication in Phase 1. Rate limiting is applied generously for anonymous use — trying it for free is how it gets stars.

```
POST /api/generate
  body: { brief, existingCode?, framework? }
  → { plan, critique, code, distinctivenessReport }

POST /api/critique
  body: { url? | code? | screenshot? }
  → { critique }

GET  /api/cliches
  → current blocklist (public, cached 1h)

POST /api/cliches/suggest
  body: { pattern, example, category, severity? }
  → submission confirmation

GET  /api/library
  → reference library entries (public, cached 1h)
```

---

## Contributing a cliché pattern

This is the single biggest lever for Verve becoming useful. A richer blocklist means more patterns caught, more distinctiveness enforced.

**5 minutes to contribute:**

1. Open `data/cliches.json`
2. Add an entry using this template:

```json
{
  "id": "category-NNN",
  "category": "color | typography | layout | motion | copy",
  "pattern": "Short name for the pattern",
  "description": "What it is and why it's a default",
  "example_values": ["specific values, hex codes, class names, or copy strings to avoid"],
  "severity": "high | medium | low",
  "date_observed": "YYYY-MM-DD",
  "tags": ["keyword1", "keyword2"]
}
```

3. Open a PR with the title `cliche: [pattern name]`

**Good entries:**
- Name a specific, recognizable pattern with example values
- Include the hex codes, class names, or copy phrases that identify it
- Reference a real AI tool that produces this pattern (helpful, not required)

**Not useful:**
- "Don't use generic colors" (too vague)
- Patterns without example values (unactionable)

---

## Contributing a reference entry

The reference library grounds the design plan generator in real, high-quality work. New entries expand what Verve can draw from.

**Template:**

```json
{
  "id": "ref-NNN",
  "name": "Company / Project Name",
  "url": "https://example.com",
  "industry": "fintech | developer-tools | portfolio | ...",
  "mood": ["adjective1", "adjective2"],
  "what_makes_it_work": "The specific, named thing that makes this design effective. Not 'looks nice.'",
  "specific_techniques": ["named technique 1", "named technique 2"],
  "color_palette": ["#HEX1", "#HEX2", "#HEX3"],
  "tags": ["keyword1", "keyword2"]
}
```

Open a PR with the title `reference: [name]`.

---

## Repo structure

```
/app                    Next.js App Router pages + API routes
  /api/generate         POST — full 6-step pipeline
  /api/critique         POST — standalone design critic
  /api/cliches          GET  — public blocklist
  /api/cliches/suggest  POST — community submission
  /api/library          GET  — reference library

/lib
  /engine               The pipeline (6 pure functions)
    brief-analyzer.ts
    blocklist-filter.ts
    plan-generator.ts
    critique-loop.ts
    code-generator.ts
    scorer.ts
    pipeline.ts         Orchestrator
  /llm-adapter          Provider-agnostic LLM interface

/data
  cliches.json          The blocklist — version controlled, community-maintained
  reference-library.json

/components             UI components (follow their own blocklist rules)
/docs                   Architecture, CONTRIBUTING, ROADMAP

.env.example            Copy to .env.local and add ANTHROPIC_API_KEY
```

---

## Design principles for contributors

The components in `/components` are subject to the same rules as any Verve output:

- No Inter as default sans-serif (Verve uses Space Grotesk + IBM Plex Mono)
- No soft-shadow white cards
- No blue-to-purple hero gradients
- One signature element, clearly named and justified

If you're adding UI components, run them through the cliché blocklist before submitting. Verve must practice what it preaches.

---

## Roadmap

**Phase 1 (current):**
- [x] 6-step pipeline end-to-end
- [x] Standalone design critic (Module E)
- [x] Community-extensible cliché blocklist
- [x] 30-entry reference library
- [x] Landing page dogfooding Verve's own rules

**Phase 2:**
- [ ] Community contribution UI (beyond PR-only)
- [ ] Distinctiveness scoring refined with usage data
- [ ] Public API with rate limiting + API keys
- [ ] Postgres-backed project history

**Phase 3 (after real usage):**
- [ ] Figma MCP bridge — ground plans in real design tokens (Module F)
- [ ] Vue + Svelte code output
- [ ] Screenshot analysis via vision model

---

## License

MIT. Fork it, extend it, build on it.

---

*Built by [Your Name](https://yourportfolio.com) · Open to freelance work in product design and frontend development.*
