# Changelog

All notable changes to Verve are documented here.

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
