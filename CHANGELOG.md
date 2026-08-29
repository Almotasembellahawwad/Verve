# Changelog

All notable changes to Verve are documented here.

## [Unreleased] — Simplified Product Flow

### Added

- Added a human-gated AI Development Studio to `/editor`: Fast stages one targeted model call, while Studio uses a bounded plan and implementation pass.
- Added multi-file proposal preview, deterministic validation receipts, accept/reject decisions, automatic pre-AI rollback snapshots, and a browser-local iteration trail.
- Added `/create` as the focused generation destination and `/examples` as the single home for runnable case stories and their evidence.

### Changed

- Reduced global navigation to Create, Examples, Editor, and Docs, with Settings and GitHub treated as utilities.
- Reframed the homepage around one product promise, one three-step flow, one live example, and one primary call to action.
- Rebuilt the editor as a preview-first application shell with explicit Preview, Code, AI, Checks, and Project controls.
- Moved provider, framework, generation mode, brand, diagnostics, revisions, and history behind contextual progressive disclosure.
- Redirected `/demos` and `/showcase` to `/examples` so old links remain valid without maintaining duplicate product surfaces.
- Missing Upstash configuration now uses an observable in-process rate limiter so BYOK generation remains available; configured distributed-store failures still fail closed.

### Removed

- Removed the obsolete strict-bootstrap rate-limit flag. Provisioning Upstash now activates distributed admission control automatically.
- Removed the forced first-visit onboarding modal and the obsolete Demos/Showcase client bundles.

## [0.7.0] — 2026-08-29 Live Project Studio

### Added

- Added a dedicated `/editor` workspace with project switching, live HTML/React preview, an editable Next.js source inspector, autosave, local revisions, and `.verve.json` import/export.
- Added an IndexedDB repository boundary for full editable projects while keeping provider keys and generation history under their existing browser-local policies.
- Added CodeQL, pull-request dependency review, grouped Dependabot updates, and a quota-free load-smoke command.

### Changed

- Fast remains the default generation policy; generated results and public demos can now continue directly into the editor.
- Project validation now blocks placeholder form submission and authored motion without a reduced-motion contract.
- Preview viewport presets now exercise 360, 768, and 1440 pixel layouts.
- GitHub Actions use immutable commit SHAs and the package version is `0.7.0`.

### Removed

- Removed repository agent instruction files, starter SVG assets, and tool-specific adapter class naming. Anthropic remains a fully supported runtime provider.

## [0.6.0] — 2026-08-27 Brand Inputs + Diversity Gate

### Added

- Added a local Brand Kit input for an existing name, approved colors, identity constraints, logos, and up to four owned images.
- Added binary project assets to preview and ZIP export without sending image bytes to the LLM; only the user-authored manifest and alt direction enter the prompt.
- Added a Template Diversity Gate that detects Verve's emerging cross-industry house recipe and caps distinctiveness at 84 until the information topology changes.
- Added a 1366×768 laptop regression that verifies a wide preview rail and prevents Reframe's title/note collision.

### Changed

- Reworked Maeda into a split, menu-first composition and Ledgerline into a compact operational interface instead of three similar oversized editorial heroes.
- Public visual demos now distinguish structure proofs that still require owned photography from a media-optional interface proof.
- The workbench moves preview to a full row on laptop widths instead of squeezing the generated desktop page beside the editor.
- JSON and SSE generation routes now share one validated request schema.

## [0.5.0] — 2026-08-27 Asset Assurance

### Added

- Added a deterministic Media Requirement Engine that classifies approved imagery as required, recommended, optional, or intentionally avoidable from the brief.
- Added a visible Media Gate to the critique report with the policy, rationale, approved-image count, and readiness outcome.
- Added a browser-local Pexels connection status beside the generation controls.

### Changed

- Image-dependent projects can no longer become production-ready without their minimum approved media; they remain exportable with explicit labeled placeholders and a blocking warning.
- Interface-led briefs no longer receive irrelevant missing-Pexels warnings.
- Code generation now follows the media policy instead of treating stock photography as a universal default.

## [0.4.1] — 2026-08-27 Separate Results

### Changed

- Moved the complete public projects from the homepage to a dedicated `/demos` evidence room.
- Replaced the homepage gallery with one focused route into the live results.
- Updated global navigation and discovery metadata to treat demos as a first-class route.

### Removed

- Removed the demo-event bridge from the generation form; curated results no longer mutate the homepage workbench.

## [0.4.0] — 2026-08-27 Demo Gallery

### Added

- Three no-key public demo projects spanning adaptive-reuse architecture, Arabic hospitality, and carbon operations SaaS.
- A project chooser that opens each complete four-file result inside the existing editor, native preview, Render Gate, and ZIP workflow.
- Automated validation coverage for every curated demo project.

### Changed

- Replaced the single Cairo demo CTA with a multi-industry proof gallery led by a new architecture project.
- Labelled fictional projects, metrics, and contact details explicitly inside the demos.

## [0.3.2] — 2026-08-27

### Changed

- Moved the no-key demo out of the generation form into a dedicated public-proof section.
- Rebuilt mobile navigation as a 44px hamburger drawer with focus trapping, Escape dismissal, scroll locking, and consolidated utilities.

### Accessibility

- Mobile navigation now restores focus after keyboard dismissal and keeps Tab navigation inside the open dialog.

## [0.3.1] — 2026-08-27

### Added

- Privacy-bounded Share Kit for every completed result.
- One-click 1200 × 630 PNG score card, native share/copy fallback, and GitHub Public Beta feedback path.

### Security

- Share artifacts exclude the design brief, provider details, and API keys by contract.

## [0.3.0] — 2026-08-27 Public Beta

### Added

- Native, isolated HTML/CSS preview with no package downloads.
- Editable no-key public demo with current-file ZIP export.
- Fast pipeline checkpoints that resume code generation without repeating provider planning.
- Generated Open Graph and Twitter cards, sitemap, robots policy, web manifest, canonical metadata, and software application structured data.
- GitHub CI, issue forms, and a public security policy.

### Changed

- Google Fonts and Fontshare preview assets use explicit CSP allowlists.
- React remains on the lightweight Sandpack runtime; complete Next.js output remains inspect-and-export only.
- Version advanced to 0.3.0 for the Public Beta foundation.

### Security

- HTML preview executes in a sandboxed iframe without same-origin access.
- Render reports are accepted only from the active preview window and probe identifier.
