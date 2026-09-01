# Roadmap

This document tracks shipped foundations and the next evidence-driven product work.

## Phase 1 — MVP foundation (shipped)

- [x] Nine observable pipeline stages (`lib/application/run-generation-use-case.ts`)
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
- [x] Verve public-surface self-audit for the same 10px typography floor used by generated projects
- [x] Fast mode with local brief extraction, two core model calls, and deterministic preflight
- [x] Studio mode with adversarial critique and bounded repair
- [x] OpenRouter gateway fallback, structured output, local brief/plan resilience, heartbeat, truncation rejection, and recovery result
- [x] Input-bound Fast checkpoint resume from stage 05 without repeating provider planning
- [x] Arabic and English browser speech-to-text input
- [x] Project readiness warnings independent of distinctiveness score
- [x] Multi-file Project Validator with blocked/review/ready terminal states
- [x] Live Problems and Sandpack Console panels
- [x] ZIP export follows current editor changes
- [x] Browser-local BYOK with no Supabase dependency
- [x] GPT-5.6 Responses API, per-call deadlines, optional-stage fallback, accurate stage timing, and missed-heartbeat recovery
- [x] Native HTML/CSS preview with zero package downloads and isolated execution
- [x] Editable no-key public demo for first-run product proof
- [x] Unified `/examples` stories with live results, design decisions, optional evidence, and direct editor continuation
- [x] Public metadata surface: canonical URL, social cards, robots, sitemap, manifest, and structured data
- [x] Privacy-bounded result Share Kit with PNG score card and GitHub feedback path

## Phase 2.1 — Quality calibration

- [x] Executable Typography Contract with direction/script-aware profiles, bounded local OFL delivery, Arabic+Latin subsets, CSS enforcement, license text, and SHA-256 receipts
- [x] Scene media semantics that distinguish `not-applicable` external media from required programmatic visual richness
- [x] ARIA tabs validator for roving focus plus synchronized arrow-key selection and panels
- [x] Media Requirement Engine that classifies photography as required, recommended, optional, or avoidable before generation
- [x] Asset Assurance that prevents image-dependent projects from appearing production-ready without approved media
- [x] Browser-local brand kit with owned logos/images embedded in preview and ZIP without sending binary content to the provider
- [x] Template Diversity Gate for Verve's own repeated cross-industry art-direction fingerprint
- [x] Laptop-width workbench regression at 1366×768
- [x] Motion Gate that blocks authored animation without a reduced-motion contract
- [x] Brief-sensitive Direction Board selected from an 18-cell structural pool
- [x] Visual Narrative Story Graph with art-direction and functional-richness contracts
- [x] Source-bound bilingual Brief Evidence Ledger with exact records, comparison dimensions, missing-data gaps, and a whole-project realization gate
- [x] Rendered Evidence Salience with opaque evidence hooks, weighted prominence, first-viewport coverage, and privacy-bounded render receipts
- [x] Scene Asset Director with licensed catalog, scene assignment, responsive framing, alt intent, and generated asset receipts
- [x] Licensed Asset Delivery with exact-host allowlisting, bounded binary copy, media-signature validation, SHA-256 receipts, local source rewriting, and ZIP inclusion
- [x] Functional Visual Fulfillment source and rendered-DOM evidence with harmonic weak-scene aggregation
- [x] Semantic route depth up to five Creative routes and three Fast routes
- [x] Rendered screenshot audit at 360, 768, and 1440 pixels with multi-route/state Visual Truth receipts
- [x] Browser console and deterministic broken-navigation evidence in the readiness report
- [ ] Form-contract adapters for explicit email, webhook, or server-action behavior
- [ ] Section-level regeneration without replacing the whole project
- [x] Dedicated `/editor` with IndexedDB autosave, complete editable projects, portable import/export, and bounded local revisions
- [ ] User acceptance/rejection signals to calibrate scoring against real outcomes

## Phase 2.2 — Collaboration and delivery

- [ ] **Community submission UI** — Web form to submit cliché patterns without opening a PR. Currently: server logs + manual PR. Target: form → admin queue → auto-PR creation via GitHub API.
- [ ] **Optional encrypted sync** — only as an explicit opt-in; local browser storage remains the default.
- [x] **Distributed anonymous API admission control** — Upstash-backed sliding windows and concurrent leases, with a local-only in-memory fallback.
- [ ] **Authenticated heavy-use API tiers** — Application API keys, account quotas, and usage reporting remain separate product/security work.
- [ ] **Distinctiveness scoring v2** — Calibrate scores against real usage data while keeping project readiness a separate axis.
- [x] **CI** — GitHub Actions: typecheck, lint, engine tests, production build, and Playwright on PRs and `main`.
- [ ] **Deploy previews** — Keep Vercel preview deployments attached to pull requests and expose their status in GitHub.
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
