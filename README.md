# Verve — speak a brief, ship a complete project

![Verve 0.2 project intelligence interface](docs/verve-0.2-preview.png)

Verve is an open-source project intelligence engine for generating distinctive web projects from spoken or written briefs. It does not stop at a code block: every successful run returns a runnable multi-file project, live sandbox preview, design rationale, validation evidence, and a ZIP export.

[Development preview](https://verve-dev.vercel.app/) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [MIT License](LICENSE)

## What changed in 0.2

- **Project Engine** — assembles complete Next.js 16, React 19 + Vite, or standalone HTML projects.
- **Live sandbox** — browse files, edit code, run the result, refresh it, and inspect mobile/tablet/desktop layouts inside Verve.
- **Fast and Studio modes** — a three-model-call draft path and a deeper adversarial production path.
- **Voice briefs** — dictate in Arabic or English, review the transcript, then generate.
- **OpenRouter recovery** — per-call limits, retry/fallback routing, ten-second SSE heartbeats, truncation detection, failed-stage reporting, and a downloadable recovery draft.
- **Complete ZIP export** — source, configuration, dependencies, `.gitignore`, and a project-specific README.
- **Production warnings** — flags fake forms, unsafe HTML injection, runtime asset dependencies, and missing reduced-motion handling.
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
| **Fast** | 3 core calls, plus provider/schema retries | OpenRouter free models, exploration, rapid drafts | LLM brief analysis, local archetype/preflight, design plan, code, deterministic validation |
| **Studio** | Variable | Production candidates and complex briefs | LLM archetype, adversarial critique, bounded revisions, code generation, optional targeted repair |

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

## OpenRouter reliability

Free routed models can rate-limit, hang, return empty content, or stop at their output limit. Verve treats an incomplete answer as a provider failure rather than presenting half a project.

The OpenRouter adapter now provides:

- a 35-second individual call budget;
- a 70-second fallback-chain budget;
- bounded exponential retry;
- fallback from the free router to a direct free model;
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

Optional environment settings are documented in [`.env.example`](.env.example). Pexels is optional and its key follows the same local BYOK flow.

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
- Generated projects run inside a Sandpack iframe rather than Verve’s own React tree.
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
│   └── code-quality-loop.ts   # deterministic checks + Studio repair
├── llm-adapter/
│   └── openrouter.ts          # timeout/retry/fallback/truncation policy
├── project/
│   ├── types.ts               # GeneratedProject contract
│   └── project-builder.ts     # complete stack scaffolds + risk scan
└── client/key-storage.ts      # browser-local BYOK storage
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
