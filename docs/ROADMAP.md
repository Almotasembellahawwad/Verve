# Roadmap

This document tracks planned development phases. Phase 3 only starts after Phase 1 has real users.

## Phase 1 — MVP (current)

- [x] Full 6-step pipeline (`/lib/engine/pipeline.ts`)
- [x] Cliché blocklist engine (`data/cliches.json`, 20 entries)
- [x] Reference library RAG context (`data/reference-library.json`, 30 entries)
- [x] Adversarial self-critique loop with 2-cycle cap
- [x] Standalone Design Critic mode (Module E)
- [x] Landing page dogfooding its own rules
- [x] All 5 API endpoints
- [x] Community contribution guide (CONTRIBUTING.md)
- [x] MIT license, README with quickstart

## Phase 2 — After first users

- [ ] **Community submission UI** — Web form to submit cliché patterns without opening a PR. Currently: server logs + manual PR. Target: form → admin queue → auto-PR creation via GitHub API.
- [ ] **Postgres integration** — Save projects, track usage, power "most flagged clichés" analytics. Target DB: Neon (serverless, zero cold-start, free tier for OSS).
- [ ] **Public API with rate limiting** — Generous anonymous tier, API key for heavy use. Implement with Upstash for Redis-backed rate limiting.
- [ ] **Distinctiveness scoring v2** — Calibrate scores against real usage data. Current scoring is heuristic; v2 should learn from user acceptance/rejection of plans.
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
