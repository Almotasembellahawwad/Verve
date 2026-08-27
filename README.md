# Verve — speak a brief, ship a complete project

![Verve project intelligence interface](docs/verve-0.2-preview.png)

Verve is an open-source project intelligence engine for generating distinctive web projects from spoken or written briefs. It does not stop at a code block: every successful run returns a runnable multi-file project, design rationale, validation evidence, and a ZIP export. HTML and React projects also open in a lightweight live sandbox; complete Next.js projects use an inspect-and-export workspace for reliable local execution.

[Development preview](https://verve-dev.vercel.app/) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [MIT License](LICENSE)

## What changed in 0.4.1 Separate Results

- **Separate no-key demo gallery** — `/demos` keeps architecture, Arabic hospitality, and carbon SaaS results away from the homepage while preserving complete file inspection, live validation, editing, and ZIP download.
- **Truthful route roles** — `/demos` contains runnable generated projects; `/showcase` remains the product evidence and methodology surface.
- **Mobile navigation** — a focused hamburger drawer consolidates routes, README, GitHub, and key management with keyboard-safe behavior.
- **Native HTML runtime** — HTML/CSS uses an isolated browser frame with zero package downloads; React remains on the lightweight Sandpack runtime.
- **Discoverable release surface** — canonical metadata, generated social cards, sitemap, robots policy, manifest, and SoftwareApplication structured data.
- **Public engineering contract** — CI, issue forms, changelog, security policy, and an explicit disclosure of the browser-local BYOK request path.
- **Shareable launch receipt** — every completed result can produce a 1200 × 630 PNG score card, a privacy-bounded share summary, and a direct Public Beta feedback path.

## What changed in 0.2

- **Project Engine** — assembles complete Next.js 16, React 19 + Vite, or standalone HTML projects.
- **Framework-safe preview** — HTML and lightweight React run in the live sandbox; Next.js projects use a file inspector and ZIP export instead of an incompatible browser shell.
- **Fast and Studio modes** — a two-model-call draft path with local brief extraction and a deeper adversarial production path.
- **Voice briefs** — dictate in Arabic or English, review the transcript, then generate.
- **OpenRouter recovery** — gateway-managed model fallback, structured JSON output, local brief/plan resilience, ten-second SSE heartbeats, truncation detection, failed-stage reporting, and a downloadable recovery draft.
- **Resumable Fast checkpoints** — after contrast enforcement, a failed code call can resume from stage 05 without paying for another brief or plan call.
- **Complete ZIP export** — source, configuration, dependencies, `.gitignore`, and a project-specific README.
- **Production warnings** — flags fake forms, unsafe HTML injection, unsupported quantified claims, runtime asset dependencies, root-level mobile clipping, weak React keys, missing fonts, tiny text, and missing reduced-motion handling.
- **Project Validator 0.2.1** — verifies scaffold files, entry exports, relative imports, declared dependencies, fragment links, form contracts, image alternatives, button types, reduced motion, and unfinished content markers.
- **Live Problems + Console** — revalidates the edited project inside the workbench and surfaces Sandpack runtime failures beside deterministic checks.
- **Rendered-result gate** — HTML/React previews report real viewport overflow, console failures, tiny text, missing image alternatives, duplicate IDs, and unnamed buttons before readiness can become `ready`.
- **Browser smoke suite** — Playwright verifies desktop/mobile rendering, horizontal overflow, browser errors, security headers, and Verve's own 10px readable-type floor using the installed Chrome channel.
- **Edit-safe export** — ZIP packages the current editor state, not the original generated snapshot.
- **Calibrated Fast evidence 0.2.4** — Fast-mode structural evidence can no longer masquerade as an adversarial visual review, blocklist and usability failures cap the final grade, cliché matching requires distinctive evidence, and the plan prompt no longer recommends its own forbidden cream token.
- **Truthful scoring and HTML delivery 0.2.3** — adversarial design flags cap distinctiveness scores, engineering checks avoid reduced-motion and fluid-width false positives, static HTML projects ship accurate no-build instructions, and generators may not fabricate item-level portfolio records from a total count.
- **Provider resilience 0.2.2** — GPT-5.6 uses the Responses API, calls have stage-specific deadlines, Studio review degrades to a deterministic preflight, and a silent stream creates an immediate recovery checkpoint.
- **Local BYOK** — provider keys are stored in the current browser only and sent only with the request that uses them.

## Why Verve exists

Most AI interface generators optimize for the statistically safest answer. The result is usually a familiar hero, generic copy, interchangeable cards, and code that looks complete until someone tries to run or extend it.

Verve applies two independent contracts:

1. **Taste contract** — reject category clichés, form a coherent visual thesis, enforce restraint, and expose the reasoning.
2. **Project contract** — return real files, runtime configuration, dependency metadata, truthful interactions, validation warnings, and a runnable preview.

Distinctiveness is not allowed to hide broken behavior. A high visual score and production readiness remain separate evidence.

## Generation modes

| Mode | Model calls | Best for | Behavior |
|---|---:|---|---|
| **Fast** | 2 core calls, plus gateway/schema fallback | OpenRouter free models, exploration, rapid drafts | Local brief analysis, local archetype/preflight, provider design plan and code, deterministic validation |
| **Studio** | Variable, bounded | Production candidates and complex briefs | LLM archetype, adversarial critique, one optional plan revision, code generation, optional targeted repair |

Both modes return the same `GeneratedProject` schema, so the workbench, history, preview, API, and ZIP exporter do not need mode-specific output handling.

## Supported project stacks

### Next.js 16 + React 19 + TypeScript

The primary stack. A generated project includes:

```text
app/
├── globals.css
├── layout.tsx
└── page.tsx
next.config.ts
next-env.d.ts
tsconfig.json
package.json
.gitignore
README.md
```

### React 19 + Vite + TypeScript

```text
src/
├── App.tsx
├── index.css
└── main.tsx
index.html
vite.config.ts
tsconfig.json
package.json
.gitignore
README.md
```

### Standalone HTML

A zero-build `index.html` plus a project-specific README. This is best for portable landing pages and quick prototypes.

## Pipeline architecture

```text
Spoken or written brief
        ↓
[01] Brief analysis
        ↓
[02] Assets + cliché blocklist + competitive field
        ↓
[02.5] Archetype ───────── local in Fast / LLM in Studio
        ↓
[02.6] Motion language
        ↓
[03] Design plan ───────── local preflight in Fast / critique loop in Studio
        ↓
[04] Deterministic contrast correction
        ↓
[05] Production-minded entry code
        ↓
[05.5] Syntax validation ─ deterministic in Fast / bounded repair in Studio
        ↓
[06] Distinctiveness + engineering evidence
        ↓
[07] Project Engine → files + dependencies + scripts + README + warnings
        ↓
Live sandbox / ZIP / history
```

The adapter is request-scoped: no global provider instance and no server-side key persistence. Asset sourcing, blocklist scanning, competitive analysis, contrast correction, engineering checks, project assembly, and final scoring are deterministic.

Optional intelligence is fail-open: if adversarial review or its revision exceeds its call budget, Verve keeps the last valid plan, runs the local production preflight, and continues to code generation. Core generation failures still end in a visible recovery project.

## OpenRouter reliability

Free routed models can rate-limit, hang, return empty content, or stop at their output limit. OpenRouter documents this capacity for experimentation and low-volume use rather than guaranteed production traffic. Verve treats an incomplete answer as a provider failure rather than presenting half a project.

The OpenRouter path now provides:

- local Fast-mode brief extraction, saving one free request per run;
- a local brief-specific plan if provider planning fails;
- an input-bound local checkpoint that resumes code generation without repeating the plan call;
- gateway-managed fallback between the selected free endpoint and the free router;
- stage-specific deadlines up to a 90-second hard ceiling;
- strict JSON Schema output for brief and plan calls;
- `max_completion_tokens` with additional reasoning/output headroom;
- explicit `finish_reason: length` rejection;
- stage-aware retry telemetry;
- ten-second stream heartbeats;
- a terminal `stage_error` with the failed stage;
- a `recovery` event containing a safe, downloadable fallback project;
- client detection when a stream closes without `result` or `recovery`.

For free OpenRouter models, start with **Fast mode**. Studio remains available, but provider availability—not Verve—still controls free-model capacity.

## Local development

Requirements: Node.js 20+ and an API key from Anthropic, OpenAI, Google AI, or OpenRouter.

```bash
git clone https://github.com/Almotasembellahawwad/Verve.git
cd Verve
npm install
npm run dev
```

Open `http://localhost:3000`. Add a provider key from the key manager. It is saved under Verve’s browser-local storage namespace and is never written to the repository or a Verve database.

The optional canonical-site setting is documented in [`.env.example`](.env.example). Provider and Pexels keys are entered in the browser key manager and must not be added to environment files. Pexels is optional: without it Verve never invents remote image URLs and image-dependent briefs receive honest placeholders.

## Commands

```bash
npm run dev        # Next.js development server
npm run typecheck  # strict TypeScript validation
npm run lint       # ESLint
npm test           # deterministic engine tests
npm run build      # production build
npm start          # serve the production build
```

## API

### `POST /api/generate`

```json
{
  "brief": "A bilingual architecture studio portfolio for Abu Dhabi clients.",
  "framework": "nextjs",
  "mode": "fast",
  "provider": "openrouter",
  "model": "openrouter/free",
  "apiKey": "sk-or-v1-..."
}
```

The response contains analysis, plan, critique, code checks, scores, and the complete project:

```json
{
  "mode": "fast",
  "project": {
    "schemaVersion": 1,
    "name": "abu-dhabi-architecture-studio",
    "framework": "nextjs",
    "entryFile": "app/page.tsx",
    "files": [
      {
        "path": "app/page.tsx",
        "content": "...",
        "language": "tsx",
        "role": "source"
      }
    ],
    "dependencies": {
      "next": "^16.3.1",
      "react": "^19.2.4"
    },
    "scripts": {
      "dev": "next dev",
      "build": "next build"
    },
    "warnings": [],
    "readiness": { "status": "ready", "score": 100 }
  }
}
```

### `POST /api/generate/stream`

The workbench uses the SSE endpoint. Expected event flow:

```text
connected
stage_start
heartbeat       # every 10 seconds during a silent provider call
stage_retry     # when OpenRouter retries or switches model
stage_degraded  # optional Studio intelligence moved to local fallback
checkpoint      # safe Fast-mode stage state; never contains an API key
stage_done
result          # successful terminal event
```

Failure terminal flow:

```text
stage_error     # safe error code + failed stage
recovery        # downloadable fallback GeneratedProject
```

Other public routes are documented in the in-app `/docs` page.

## Security model

- API keys remain in browser storage and are sent only to Verve’s same-origin API route for the selected request.
- Keys are never included in results, history entries, logs, generated files, or recovery projects.
- Logs redact common Anthropic, OpenAI, OpenRouter, Gemini, and bearer-token patterns.
- HTML and React previews run inside a Sandpack iframe rather than Verve’s own React tree. Next.js output is inspected and exported without starting a browser shell.
- Project edits are revalidated in the browser and the exact edited files are used for ZIP export.
- Remote critique URLs must be public HTTPS targets; private-network and loopback addresses are rejected.
- Voice input requires an explicit browser microphone permission and remains editable before submission.
- Generated code is untrusted output. Review warnings and run the production build before deployment.

## Repository map

```text
app/
├── api/generate/              # JSON endpoint
├── api/generate/stream/       # SSE + heartbeat + recovery
├── docs/                      # in-product developer reference
└── page.tsx                   # product experience
components/
├── GeneratePanel.tsx          # orchestration workbench
├── ProjectWorkbench.tsx       # sandbox, files, responsive preview, ZIP
└── VoiceBriefInput.tsx        # Arabic/English speech input
lib/
├── engine/
│   ├── pipeline.ts            # Fast/Studio orchestration
│   ├── fast-path.ts           # local archetype and preflight
│   ├── provider-resilience.ts # optional-stage fallback contract
│   └── code-quality-loop.ts   # deterministic checks + Studio repair
├── llm-adapter/
│   └── openrouter.ts          # timeout/retry/fallback/truncation policy
├── project/
│   ├── types.ts               # GeneratedProject contract
│   ├── project-builder.ts     # complete stack scaffolds + risk scan
│   ├── project-validator.ts   # multi-file production contract
│   └── editor-project.ts      # editor state → validation/export project
└── client/
    ├── key-storage.ts         # browser-local BYOK storage
    └── generation-stream.ts   # missed-heartbeat watchdog
tests/
└── engine.test.ts
```

## Product principles

- A project that cannot run is not finished.
- A feature must not pretend to work.
- A recovery result is better than a silent spinner.
- Distinctive does not mean decorated.
- Fast and Studio may spend different compute, but must honor the same delivery contract.
- Generated facts must come from the brief or be labeled as placeholders.

## Contributing

See [Contributing](docs/CONTRIBUTING.md). The highest-leverage contributions are production-quality checks, stack templates, provider resilience tests, accessible preview behavior, and evidence-backed additions to the public cliché blocklist.

Please run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## License

[MIT](LICENSE) © Almotasembellah Awwad
