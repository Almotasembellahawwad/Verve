# Roadmap

This document tracks shipped foundations and the next evidence-driven product work.

## Phase 1 — MVP foundation (shipped)

- [x] Nine observable pipeline stages (`/lib/engine/pipeline.ts`)
- [x] Cliché blocklist engine (`data/cliches.json`, 21 families / 67 signals)
- [x] Reference library RAG context (`data/reference-library.json`, 30 entries)
- [x] Adversarial self-critique loop with one bounded revision
- [x] Standalone Design Critic mode (Module E)
- [x] Landing page dogfooding its own rules
- [x] All 5 API endpoints
- [x] Community contribution guide (CONTRIBUTING.md)
- [x] MIT license, README with quickstart

## Phase 2 — Project Engine (shipped)

- [x] Complete Next.js 16 project output
- [x] Complete React 19 + Vite project output
- [x] Standalone HTML project output
- [x] Shared `GeneratedProject` schema across JSON, SSE, preview, and ZIP export
- [x] Framework-safe preview: live HTML/React sandbox plus Next.js inspector/export
- [x] Rendered-result gate for live overflow, runtime, text-size, and accessibility evidence
- [x] Playwright desktop/mobile smoke tests and security-header checks
- [x] Fast mode with three core model calls and deterministic preflight
- [x] Studio mode with adversarial critique and bounded repair
- [x] OpenRouter timeout, retry, fallback, heartbeat, truncation rejection, and recovery result
- [x] Arabic and English browser speech-to-text input
- [x] Project readiness warnings independent of distinctiveness score
- [x] Multi-file Project Validator with blocked/review/ready terminal states
- [x] Live Problems and Sandpack Console panels
- [x] ZIP export follows current editor changes
- [x] Browser-local BYOK with no Supabase dependency
- [x] GPT-5.6 Responses API, per-call deadlines, optional-stage fallback, accurate stage timing, and missed-heartbeat recovery

## Phase 2.1 — Quality calibration

- [ ] Rendered screenshot audit at 360, 768, and 1440 pixels
- [x] Browser console and deterministic broken-navigation evidence in the readiness report
- [ ] Form-contract adapters for explicit email, webhook, or server-action behavior
- [ ] Section-level regeneration without replacing the whole project
- [ ] Persistent editable project snapshots in IndexedDB rather than large localStorage records
- [ ] User acceptance/rejection signals to calibrate scoring against real outcomes

## Phase 2.2 — Collaboration and delivery

- [ ] **Community submission UI** — Web form to submit cliché patterns without opening a PR. Currently: server logs + manual PR. Target: form → admin queue → auto-PR creation via GitHub API.
- [ ] **Optional encrypted sync** — only as an explicit opt-in; local browser storage remains the default.
- [ ] **Public API with rate limiting** — Generous anonymous tier, API key for heavy use. Implement with Upstash for Redis-backed rate limiting.
- [ ] **Distinctiveness scoring v2** — Calibrate scores against real usage data while keeping project readiness a separate axis.
- [ ] **CI/CD** — GitHub Actions: typecheck, lint, build on PR. Deploy preview on Vercel for each PR.
- [ ] **More cliché entries** — Target: 50 entries. Focus areas: motion (more specific timing patterns), copy (more LLM-specific phrasing tells), component-level layout tells (pricing table layouts, testimonial patterns).

## Phase 3 — After real traction

- [ ] **Figma MCP bridge (Module F)** — Connect to Figma's MCP server so the plan generator grounds itself in an existing design system's tokens instead of inventing a palette. This eliminates the "Verve-designed vs. existing-system" conflict for teams with established brands.
- [ ] **Vue + Svelte output** — Add framework adapters to the code generator. The pipeline doesn't change — only the code generation system prompt and output format.
- [ ] **Vision model integration** — Screenshot analysis via Claude's vision API for the Design Critic mode. Currently: text-only code analysis. Vision analysis would catch visual issues (contrast, spacing) that aren't in the code.
- [ ] **VSCode extension** — Run the critic inline on open files. Single most-requested feature in the initial GitHub issue tracker (assumption; validate before building).

## Module F (Figma MCP) — Design note

This is deliberately deferred. The Figma MCP integration requires:
1. User has an existing Figma file with a published design system
2. User has MCP server running locally
3. Token extraction logic to map Figma variables → our plan schema

Without real users requesting this, it's over-engineering. The flag here is a reminder that the architecture supports it (the plan generator accepts external constraints), not a commitment to build it.
