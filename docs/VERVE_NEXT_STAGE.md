# Verve next stage: design decisions that survive delivery

Audit date: 2026-09-26. Starting revision: `6712eea` on `main`.
This is an engineering audit and a product hypothesis, not a claim of market leadership.
The review covers the direction pipeline, evidence policy, media, preview, persistence,
public examples, CI and the user journey. It is not a penetration test or a complete
audit of every dependency. No paid provider benchmark was run for this review.

### Security follow-up

GitHub reported two high-severity dependency alerts during publication. The follow-up
lockfile patch updates transitive `sharp` 0.35.3 to 0.35.4 (including its platform
packages/libvips) and development-only `js-yaml` 4.3.1 to 4.3.2. Direct dependency
ranges remain unchanged. See the maintainer advisories for
[sharp](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) and
[js-yaml](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh).
The installed paths were Next.js/ColorThief → sharp and ESLint → eslintrc → js-yaml.
This establishes affected package presence, not confirmed exploitation of Verve.
CI now audits the full dependency tree at the high-severity threshold; a registry
failure is visible rather than silently ignored. Zero registry advisories at a point
in time is not proof that the application has no security vulnerabilities.

The 2026-10-02 delivery slice hit new CI audit findings in development-only
ESLint dependency paths. The two `brace-expansion` resolutions move from 1.1.18
and 5.0.9 to patched 1.1.21 and 5.0.12 without changing direct dependency ranges
or weakening the audit gate. Maintainer advisories cover
[nested-brace stack exhaustion](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7),
[parse-comma stack exhaustion](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p),
and [quadratic expansion](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr).
Affected packages in the development tree are not evidence of production exploitability.

## The decision

Build a **design-directed creation workflow**, not another general-purpose IDE.
The proposed initial audience is independent designers and small studios delivering
distinctive Arabic/English brand, service and product experiences. Validate that
audience with interviews and actual project delivery; it is not established demand.

The promise to test: **Choose a convincing direction, turn it into a working site,
then improve one part without losing what made it distinctive.**

The main acquisition artifact must be a genuinely good working result, not an
architecture diagram or a high generated score. The reason to return should be
reliable refinement, reusable brand decisions and faster client approval.

## Competitive reality

Checked against first-party documentation on the audit date:

- [Lovable browser testing](https://docs.lovable.dev/features/browser-testing)
  already exercises flows in a real browser, including screenshots and responsive
  checks. Its documentation explicitly acknowledges limits in judging subtle
  visual details. A browser checker alone is not Verve's differentiation.
- [Lovable design systems](https://docs.lovable.dev/features/design-systems)
  already supports shared components, tokens and usage guidance. A brand kit or
  a token system alone is not a defensible advantage either.
- [Lovable preview toolbar](https://docs.lovable.dev/features/preview-toolbar)
  includes direct preview interaction and editing. Do not position an editable
  preview as a capability competitors lack.

The opportunity is a **better end-to-end design decision process**, not an assertion
that these features are absent elsewhere. We have not performed a matched output
benchmark against Lovable or v0. Claims of superior quality must wait for it.

## What the audit actually found

### Correctness fixes in this change

1. **Missing evidence was too permissive.** In `lib/engine/evaluation-coherence.ts`,
   missing archive distance or direction fidelity could be treated as passing.
   Creative eligibility now requires finite, measured evidence and passed source
   gates. An empty archive leaves distinctiveness provisional, even if the project
   is technically ready. A failed observed viewport blocks immediately; a later
   valid recheck can recover without retaining stale render warnings.
2. **Direction identity was mixed by position.** In
   `lib/engine/direction-board.ts`, fallback candidates had a fixed order while
   requested cells were reordered by brief affinity. Overwriting descriptors by
   index could turn a decision-room concept into a collection-browser label.
   Fallbacks now match the experience model, update their dependent opening and
   navigation fields, and keep their complete identity/mechanism together.
   Provider responses are matched by the entire requested cell; missing cells
   trigger a coherent local fallback rather than silent structural relabelling.
3. **History replacement was destructive before success.** `lib/history.ts`
   cleared storage before rewriting entries. One atomic replacement now retains
   the old history when quota is exhausted; reduced-quota recovery keeps newest
   entries. Corrupt containers and unavailable storage are handled defensively.
4. **Industry defaults overrode explicit exclusions.**
   `lib/engine/media-requirement.ts` now recognizes complete English/Arabic
   photography exclusions before the sector heuristic. A scoped exclusion such
   as “no photos of people” does not ban all photography. This remains a bounded
   parser, not a claim of complete natural-language understanding.
5. **React preview could understate source blockers.** Its visible readiness now
   respects the project's blocked status and blocking warnings, matching HTML.
6. **Direction choice lacked visual structure.** `components/DirectionSketch.tsx`
   adds lightweight SVG composition sketches using the candidate's palette and
   experience model. No provider call, stock asset, or final-site claim is added.
   The UI labels these as sketches. Focus visibility, selected-card tokens and
   metadata wrapping are also corrected.
7. **CI was testing a development server despite building production first.**
   Playwright now starts the production server in CI; local developers can opt in
   with `PLAYWRIGHT_PRODUCTION=1` after building. Offline browser fixtures cover
   manual selection, recommendation, checkpoint handoff and mobile overflow.

### High-priority work still open

- **Public examples fail our own distinctiveness target.** The committed
  `data/public-demo-visual-truth.json` records nearest-neighbor distances of
  **0.212–0.285** at the initial audit, below **0.50**, despite zero mechanical
  failures/warnings in that baseline. The first Carbon workbench rebuild adds a
  working source-trail and local-only assignment. The new measured range is
  **0.224–0.296** when taking the lower Windows/Linux measurement per example,
  still below target. Carbon measures 0.296 on Windows and 0.314 on Linux;
  the receipt exposes both while the public comparison uses 0.296. Several use Arial/Georgia. These
  hand-curated references do not prove that the latest font-delivery code fails.
  Passing overflow checks is not beauty.
- **The board still has a small hand-authored search space.** Six experience models
  and 18 structural cells prevent some repetition but do not constitute open-ended
  art direction. The new sketches make that structure inspectable, not limitless.
- **Candidate fonts and delivered fonts previously diverged.** The board now
  resolves every candidate through the same local licensed Typography Contract
  used by generation, including Arabic and Latin subsets. It previews the selected
  family in the card. Further art-direction work must test whether this improves
  human choice; matching a font name does not establish visual quality by itself.
- **Archive comparison previously included the same project.** Both workbenches used to
  record fingerprints without ownership. This local-memory change excludes
  the current project's prior revisions using a hashed local ID. Unowned legacy
  entries cannot be attributed safely and are excluded from owned comparisons;
  identical results from *different* identified projects remain detectable.
  Archive entries are still not bound to source and asset revisions.
- **Persisted evidence now has revision binding (2026-10-02 slice).** A history
  render summary names SHA-256 source/configuration, asset/license and design
  digests, probe version and hashed tested surfaces. Applying evidence requires
  the current revision; a stale pass or fail has no authority over edited output.
  Preview matrices reset on code, asset, configuration and ProjectSpec changes.
  Restored history reruns the browser checks; omitted binaries keep claims
  provisional. Linking history to complete editor storage and revision-binding
  archive entries remain open.
- **Unified identity now reaches delivery (2026-10-02 slice).** ProjectSpec's
  optional Design Contract v1 records the chosen direction, exact typography
  assignment, palette roles, spatial rhythm, material/image/motion language,
  signature purpose and scene IDs. Framework-correct exports add a reserved token
  stylesheet and JSON receipt; validation catches disconnected or drifted tokens
  and warns when authored styling does not consume the shared color/spacing roles.
  Design choices is collapsed in the workbench. This is not editable Theme,
  enforced Scene Lock, a rendered candidate prototype, or proof of visual fidelity.
- **Heuristics are not expert judgment.** Restraint scans keywords and purpose
  phrases; repeated scores can be deterministic behavior, not a meaningful
  perceptual diagnosis. Source markers and DOM geometry have similar limits.
  Treat them as diagnostics; calibrate against blinded human judgments.
- **Content-boundary checking is coarse.** Scanning complete source text risks
  conflating internal strings with visible visitor copy. Parse rendered text or
  syntax-aware nodes before making stronger blocking decisions.
- **Creative provider stability is not proven by mocks.** PR #28 bounded the
  critique stage and fixed production font resolution. We still need real-run
  latency, timeout, fallback and repair evidence across representative briefs.
- **Operational readiness is separate.** Distributed admission control exists,
  but an in-memory deployment fallback is not a distributed guarantee. Confirm
  production configuration and secret handling separately; never publish keys.
- **Forms need explicit delivery contracts.** A visually functional submission
  is not proof of email, booking, payment or data persistence. Require a configured
  adapter or a clearly disclosed demo state, with an end-to-end test.

## Architecture to converge toward

Retain the existing ports/adapters and stage boundaries. Do not rewrite the engine
while reliability and output quality are still being measured. Consolidate contracts:

1. **Brief contract:** verified facts, unknown facts, user jobs, exclusions, assets,
   locale, task complexity and success conditions.
2. **Design contract:** complete direction identity, font binaries, palette roles,
   spatial composition, visual motifs, content hierarchy and interaction model.
3. **Scene contract:** real evidence, focal object, visual medium, state changes,
   keyboard behavior, responsive transformation and performance budget.
4. **Delivery contract:** generated files, asset receipts, runtime behavior and
   source revision. All edits create a new revision.
5. **Evidence contract:** one authoritative release policy over independent source,
   render, interaction and asset observations. Missing means unknown, not pass.

User-facing UI should lead with **Preview**, **Fixes needed**, and **Design choices**.
Detailed FVE/FVF/RES/RCR/DF evidence belongs in an inspectable drawer. Do not delete
useful diagnostic information; stop presenting seven numbers as competing verdicts.

## A richer visual engine, not a decoration quota

- Start from the domain's visual objects: binding sections and paper specimens for
  a print studio, uncertainty ranges for carbon operations, ingredients and actual
  packaging for skincare, private case pathways for legal services.
- Produce a small visual thesis for every candidate: focal object, type contrast,
  material/light language, spatial rhythm and one meaningful interaction. A title
  plus a palette is insufficient. Use licensed or user-owned media only.
- Carry the same thesis through every scene. Richness can be photography, original
  diagrams, evidence-dense data, crafted type or consequential interaction. It is
  not “three images per industry” or “add gradients everywhere.”
- Keep meaningful contrast across scenes: overview/detail, calm/dense, spatial/
  sequential. Preserve a deliberate reading path and a mobile equivalent.
- Compose movement around state and orientation. Reduced motion, keyboard focus,
  legible type and loading stability are part of the design, not polish after it.
- Treat a large hero as acceptable when it contains task-bearing information;
  neither reward nor ban it based on size alone.

## Delivery sequence and exit criteria

### 0. Restore trust — implemented in this change

Land the corrections above with deterministic regressions, production typography
verification and desktop/mobile browser coverage. No new model calls in Fast.
This milestone does not imply improved generated-site aesthetics by itself.

### 1. Make observations trustworthy — partially implemented

- [Implemented 2026-10-02] Bind render receipts to exact source/configuration,
  asset/license and design revisions. Legacy unbound receipts remain historical.
- [Implemented 2026-10-02] Compile and export the shared Design Contract without
  another model call; validate executable token agreement and expose Design choices.
- Bind archive entries to project/source/asset revisions (still open).
- [Implemented in the first slice] Exclude the current project from archive
  comparisons without excluding genuinely duplicated work from other projects.
  Unowned legacy records are retained but not used for owned comparisons.
- Unify preview status and history status under the same release-decision adapter.
- Collect 15–24 consented real runs: brief family, mode, provider/model version,
  per-stage duration, fallback reason, repair count, source gates, browser surfaces,
  export integrity. Keep brief/code/images local unless explicitly shared.
- Exit: an old passing receipt cannot bless edited output; a blocked font or form
  cannot be shown as ready; the archive cannot reject a project merely on reopen.

### 2. Prove design quality — highest product priority

- Move approved typography and asset feasibility into candidate selection.
- Upgrade sketches to content-aware art-direction studies with actual available
  media and type; preserve the inexpensive six-direction/one-build budget.
- Rebuild and freeze six examples: photo-led architectural atlas; Arabic restaurant
  reservation journey; carbon operations workbench; playful learning laboratory;
  nonlinear fashion collection; accessible civic guided flow.
- Every example needs a real focal object, a complete primary task, a distinct
  mobile composition, asset licenses, true screenshots and a reproducible receipt.
- Exit: no duplicate topology/opening/navigation combinations, no critical
  accessibility failure or horizontal overflow at 360/768/1440, no placeholders
  masquerading as delivered media. Treat visual distance ≥0.50 as a provisional
  engineering target, subject to human calibration, not a certificate of beauty.

### 3. Give users a reason to return

- Build scene-scoped refinement on the existing staged patch/accept workflow.
- Expose locks for type, palette, routes, verified facts and approved assets.
- Show the changed scene alongside the previous revision and rerun affected tests.
- Add explicit form adapters and truthful deployment/export guidance.
- Exit: changing a comparison scene leaves unrelated scenes and locked identity
  intact; every accepted edit has a reversible snapshot and fresh evidence.

### 4. Test the positioning, not just the implementation

- Use the fixed 24-brief bilingual corpus; balance expressive and task-oriented
  projects, supplied/no media, and single/multi-route tasks.
- Compare Verve with alternative tools under recorded, matched briefs and budgets;
  randomize tool identity and presentation order for reviewers.
- Score task completion, factual accuracy, visual hierarchy, craft, responsive
  quality and preference separately. Report ties, failures and reviewer disagreement.
- Predeclare held-out briefs before tuning thresholds; do not choose examples only
  because they make Verve look good. Start with a pilot, not a significance claim.
- Measure time to accepted direction, time to usable result, completion/export
  rate, revisions needed and seven-day reuse only with opt-in research/analytics.
  No telemetry is added by this change.

## Mathematical framing: useful and falsifiable, not a new theorem

Let `C` be the set of candidates with observed passes for factual, asset, runtime,
accessibility and task constraints. An unobserved constraint is **unknown**, so that
candidate cannot claim verified membership in `C` yet. Keep technical release
eligibility separate from the stronger claim of demonstrated distinctiveness.

Within `C`, compare a vector `(task utility, human preference, novelty, -cost,
-latency)` instead of summing unlike scores. Pareto-dominated candidates need not
be recommended. Maximin novelty can spread the shortlist, but only against a
valid, self-excluding reference archive and only after quality constraints.

The testable hypothesis is: **showing meaningfully different, faithful directions
and preserving the chosen identity reduces revisions to acceptance without reducing
task success**. Compare against today's workflow with a pilot; report uncertainty.
Do not add Thompson Sampling before defining a reliable reward, collecting enough
consented observations and establishing an offline baseline. Timeouts are an
engineering reliability problem, not evidence that a bandit algorithm is needed.

## What this review does not establish

It does not establish market demand, superiority over competitors, a validated
creativity metric, or that all generated projects are launch-ready. Frozen example
tests and mocked API flows do not replace fresh provider generations or human
visual review. The attached historical downloads are not newly generated results
from this branch. Keep public claims aligned with those boundaries.
