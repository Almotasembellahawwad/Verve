# Changelog

All notable changes to Verve are documented here.

## [0.3.0] — Unreleased Public Beta

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
