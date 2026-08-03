# Contributing to Verve

Thank you for helping grow the blocklist and reference library. These two datasets are the engine of Verve — their quality compounds directly into the quality of every design the tool produces.

## Two ways to contribute

### 1. Adding a cliché pattern (most impactful)

Open `data/cliches.json` and add an entry:

```json
{
  "id": "category-NNN",
  "category": "color | typography | layout | motion | copy",
  "pattern": "Short, recognizable name for the pattern",
  "description": "What the pattern is, why it's a default, and what it signals about the design",
  "example_values": [
    "specific hex code",
    "CSS class name",
    "copy string",
    "font name"
  ],
  "severity": "high | medium | low",
  "date_observed": "YYYY-MM-DD",
  "tags": ["keyword1", "keyword2"]
}
```

**Severity guide:**
- `high` — A default so common that seeing it immediately marks the design as AI-generated
- `medium` — Common but not universal; still worth blocking
- `low` — A mild signal, worth flagging but not a dealbreaker

**PR title format:** `cliche: [pattern name]`

**What makes a good cliché entry:**
- Specific example values (exact hex codes, class names, copy strings)
- A description that explains *why* this is a default, not just *what* it is
- A `date_observed` — AI defaults shift over time, stale entries become maintenance backlog

**What doesn't help:**
- Vague patterns like "generic colors" with no examples
- Patterns that are only bad *sometimes* — if the context determines whether it's a cliché, it's not cliché-able

---

### 2. Adding a reference entry

Open `data/reference-library.json` and add an entry:

```json
{
  "id": "ref-NNN",
  "name": "Company or Project Name",
  "url": "https://the-url.com",
  "industry": "fintech | developer-tools | portfolio | agency | publishing | ...",
  "mood": ["adjective1", "adjective2", "adjective3"],
  "what_makes_it_work": "The specific, named thing that makes this design effective. Must be concrete — not 'it looks clean' but 'the color palette is derived entirely from actual product screenshots, making the marketing feel like an extension of the product rather than a separate layer.'",
  "specific_techniques": [
    "named technique 1",
    "named technique 2",
    "named technique 3"
  ],
  "color_palette": ["#HEX1", "#HEX2", "#HEX3"],
  "tags": ["keyword1", "keyword2"]
}
```

**`what_makes_it_work` is the most important field.** Verve uses it as retrieval context before generation. "Looks nice" is not useful. "Uses typographic weight as the sole hierarchy device, with no color differentiation between H1 and H2 — this creates a flat, calm reading experience that serves a publishing product" is useful.

**PR title format:** `reference: [name]`

**What makes a good reference entry:**
- The `what_makes_it_work` field explains a specific, nameable design decision
- `specific_techniques` are named as techniques, not descriptions (e.g., "oblique product screenshots" not "the product is shown at an angle")
- The design is genuinely distinctive — not "this SaaS is clean and uses blue" but "this fintech brand uses banana yellow as its primary background"

---

## Code contributions

If you're contributing to the engine (`/lib/engine`) or UI components (`/components`):

1. Run `npm run typecheck` before opening a PR — TypeScript strict mode is enforced
2. Components must follow the cliché blocklist themselves — Verve must practice what it preaches
3. Engine functions should be pure (input → output, no side effects except LLM calls)
4. LLM calls go through the adapter in `/lib/llm-adapter` — don't call the Anthropic SDK directly from engine code

## Running locally

```bash
cp .env.example .env.local
# Add ANTHROPIC_API_KEY
npm install
npm run dev
```

## License

By contributing, you agree your contributions will be licensed under the project's MIT License.
