# Native page preview and project-wide browser evidence

This is delivery and observation work, not an aesthetic quality milestone. No paid
provider generations or engine-produced showcase examples are part of this change.

## What changed

- HTML pages are enumerated from the delivered manifest. A page selector and local
  anchor navigation support root, nested, directory and extensionless page paths.
  Back/Forward use a bounded, local preview history rather than changing Verve's URL.
- The iframe remains `sandbox="allow-scripts"`, without same-origin access. The
  parent checks the sender frame, active probe and target manifest before navigating.
  Every page load gets a new probe. Messages from replaced pages cannot navigate or
  populate the new page's evidence.
- Route context is explicit: a nested `srcDoc` cannot be mistaken for the root route
  simply because its browser location is `about:srcdoc`. Duplicate route aliases in
  separate delivered files still require separate observations.
- Visual Truth v3 caps coverage independently for each route and each width. Every
  expected state-count target needs observations at 360, 768 and 1440. Extra states
  elsewhere cannot fill a gap. Declared routes without delivered pages remain missing.
- Readiness and persisted audits use all observed surfaces, not just the latest
  report for each width. An error on a secondary page stays actionable after returning
  to a clean home page. Editing any source clears the complete observation matrix.
- Probe v5 invalidates older receipts. Source, binary assets and design decisions
  still use the existing SHA-256 revision binding. Saved coverage contains counts and
  hashed identities only, never page copy, form values or raw URLs.

## What this does not prove

State hashes are DOM-state observation signatures. Counting them does not establish
that a specific business workflow, endpoint, form validation or every declared state
works. These still need explicit interaction tests. A high Direction Fidelity
diagnostic is not evidence that a site is original, beautiful or market-ready.

The lightweight preview is not a virtual server. It does not emulate
`location.pathname`, `location.search`, programmatic `location` redirects, external
sites, browser-native history or server form submissions. Query-bearing page links
retain their preview-history target, but code reading the real location still needs
the exported project under HTTP. Authored delegated handlers that prevent default
navigation are respected. Preview navigation scripts are never written into the ZIP.

Coverage is manual: open each page at each width and exercise its state controls.
Unobserved surfaces stay incomplete. The UI does not silently run interactions or
increase the model-call budget to manufacture a pass.

## Regression checks

- Unit cases cover manifest enumeration, alias collisions, exact path precedence,
  traversal/external rejection, absent-page failure, route/state/width coverage,
  stale sequencing and privacy-safe persistence.
- Browser cases use offline mocked generation responses in the real production-CSP
  iframe. They exercise nested CSS/JS, keyboard navigation, RTL, route selection,
  Back/Forward, required state coverage, stale message replay and secondary-page
  runtime errors. They do not measure provider design quality.
- The existing delivery suite still checks classic/deferred scripts, modules,
  nested assets and executable ZIP export without synthetic `/compare` files.

## Next product checkpoint

Compare four fixed briefs in two selected directions each. Measure the existing
realization axes and inspect screenshots and primary tasks, recording failures in
the engine rather than correcting showcase code by hand. Follow that with two
engine-produced examples (photo-led architecture and a rich Arabic decision/spec
experience), using owned or documented licensed assets. Live provider cost and
latency results must be labelled separately from these offline regression fixtures.
