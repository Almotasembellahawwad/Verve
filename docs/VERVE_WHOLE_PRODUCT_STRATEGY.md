# Verve: product thesis, visual breadth, and execution plan

Audit date: 2026-09-28. Verified GitHub `main`: `09ec601` (merged PR #39);
no open pull requests at the time of this audit. This document is a decision
record, not a claim that generated output already meets a world-class bar.
The local visual review used the current homepage and examples at 1440px.
Provider-backed generation and a matched competitor benchmark were **not** run.

## 1. What Verve should be

Verve should be a **design-directed creative compiler**: it turns a brief into
distinct, inspectable experience directions; compiles one selected direction
into owned code and licensed assets; runs the result; and lets a person improve
specific scenes without losing the approved design thesis.

This is narrower than a universal AI IDE and stronger than a one-shot landing
page generator. The first audience to validate is independent designers and
small studios shipping Arabic/English brand, product, and service experiences.
The acquisition promise is a compelling *working project*. The retention
promise is identity-preserving refinement and reliable handoff. Neither demand
nor superior quality is established until tested with real users and outputs.

The user-visible loop should be:

1. **Brief contract** — goals, audience decisions, verified facts, unknowns,
   exclusions, brand assets, locale, and success conditions.
2. **Direction Board** — six meaningfully different *proposals*, each with a
   behavioral model, information topology, composition, typography, color,
   visual media role, and one signature interaction. A sketch is labelled a
   sketch, not a generated screenshot.
3. **Design lock** — user chooses or delegates Auto, and may lock facts,
   typography, palette roles, media, or interaction principles.
4. **Compilation** — ProjectSpec and Story Graph become a runnable multi-file
   project with an asset manifest and revision identifier.
5. **Execution evidence** — build, typecheck, browser tasks, three widths,
   accessibility and asset checks. Unknown is never displayed as pass.
6. **Scene-level refinement** — propose/preview/accept a bounded change;
   rerun affected checks and preserve a reversible revision.
7. **Handoff** — portable source, licenses, tested surfaces, known limitations,
   and honest instructions for integrations that are only simulated.

## 2. Where the system really is

The existing engine has a six-direction board, 18 structural cells, near/far
reference retrieval, ProjectSpec v2, a story/scene contract, typography and
asset delivery, multi-file output, local editor, staged AI patches, and
source/render evidence including Render Gate, FVE, FVF, RES, RCR and Direction
Fidelity. Fast is two core model calls; Creative is normally five and capped
at seven. The 24-brief bilingual corpus and automated browser checks are
useful regression tools. The six public examples explicitly disclose that
they are hand-curated, not proven live-engine outputs.

The current automated public-example visual distances are **0.224–0.296**
(conservative Windows/Linux minimum) versus a provisional **0.50** release
target. This is evidence of a gap in the chosen fingerprint, not a universal
measure of beauty. As of this audit, local unit tests pass; paid provider
runs, blinded design judging, end-to-end generated Next.js builds, and
matched competitor comparisons remain unproven.

### Priority gaps

- **Execution truth:** generated Next.js/React files receive static validation
  and preview, but not an isolated install/build/typecheck/test cycle before a
  strong "ready" claim. The builder also uses some `latest` dependencies and
  its import classifier can miss packages beginning with `react` or `next`.
- **Repair truth:** one quality-loop path can treat a partial reduction of
  issues as repaired, while a later caller discards residual issues. Fix this
  before increasing the number of visual features or model choices.
- **Revision truth:** persisted render evidence is not yet bound to a full
  source-and-asset digest. A hash labels a revision; it does not by itself
  attest that an untrusted preview ran honestly.
- **Output quality:** the board explores only a compact human-authored space;
  the examples are uneven, and their wrappers and some section rhythms repeat.
  More score formulas are not a substitute for real runs and blinded reviews.
- **Language/semantics:** generated project roots still default to English in
  some builders. The delivery contract needs explicit `locale`, `lang`,
  `dir`, and bilingual font/layout checks.
- **Operational reality:** Creative latency and degradation are not measured
  across enough real provider runs; browser-local history and user-supplied
  keys are not a collaborative cloud workspace. Production limits and key
  handling need threat review, not marketing language.

These are ordered by user harm and release integrity, not by architectural
novelty. See [the previous next-stage audit](VERVE_NEXT_STAGE.md) for the
underlying code-level findings and existing mitigations.

## 3. Visual breadth without style templates

The named schools below are **vocabularies, not presets or quality ranks**.
Do not map `sector → style` (e.g. legal → minimal, skincare → warm beige).
Compile a direction from orthogonal, brief-sensitive axes:

`task topology × information density × spatial rhythm × materiality ×
type voice × color strategy × image/data/shape role × motion behavior ×
interaction consequence × locale`.

Each candidate should explain its *counterfactual*: what a conventional
solution would do, what it changes, and which user decision becomes easier
or more memorable. Six outputs need distinct **structural/behavioral
combinations**, not merely six palette swaps. Visual style is evaluated after
task fit, facts, accessibility, asset feasibility, and performance.

- **Minimalism:** remove visual noise and make primary evidence unusually
  clear. It does not require white backgrounds, sans-serif fonts, or a sparse
  information model. Dense expert data can be minimal in ornament but rich in
  content.
- **Modern flat:** use planar, legible layers and explicit affordances. Do not
  erase elevation, focus, or active-state cues merely to look "flat".
- **Warm minimal:** humanize through material, type, and pacing only when the
  brief supports it; ban the automatic beige/serif association as a retrieval
  shortcut, not beige itself.
- **Neumorphism:** a small tactile accent for low-risk controls at most.
  Low-contrast boundaries and state ambiguity make it a poor default for
  navigation, forms, or financial/medical data.
- **Glass materials:** a controlled surface layer for navigation or floating
  controls, never a universal content skin. Provide opaque fallback, contrast
  checks over every actual background, and reduced-transparency behavior.
  Apple's guidance likewise treats glass as a functional layer used sparingly.
- **Neo-brutalism:** strong edge, scale, collision, and directness; neon and
  crude shadows are optional, not defining requirements. Keep keyboard focus,
  readable hierarchy, and brand/context fit.
- **Digital maximalism:** a coordinated high-density visual world, not a quota
  of gradients, 3D objects, or animations. Every layer needs a narrative,
  informational, or interaction role and a performance/reduced-motion budget.
- **AI-driven or "zero UI":** conversational entry can adapt an experience,
  but never delete discoverable navigation, inspectable state, escape routes,
  consent, or direct controls for frequent tasks. Start with progressive
  disclosure, not literal zero controls. [NN/g's hybrid-interface research](https://www.nngroup.com/articles/ai-articulation-barrier/)
  explains why prompt-only input creates an articulation and discoverability
  burden for some users.

Implementation: add a versioned `VisualGrammar` descriptor beside, not
inside, the existing topology/experience identity. It stores allowed ranges
and rationales for the axes above; it is not an HTML/CSS template. Candidate
generation may cross compatible grammar operators, then the existing quality
gate rejects poor brief fit or unlicensed/impossible assets. The selector
should compare both structure and rendered visual evidence. Keep Fast's two
core-call budget by resolving grammar locally from the board; Creative may
spend its existing expansion/critique calls. No default mode change.

Roll out under an opt-in flag and test **same brief across grammar choices**:
task completion and factual fidelity must not fall as visual distance rises.
If six candidates are visually different but tell the same story or cannot
be implemented in the asset budget, the experiment fails.

## 4. A controlled craft library, not a pasted design system

Use sources for *primitives* and *provenance*, not their default aesthetic:

- **Icons/SVG:** [Lucide](https://lucide.dev/) (ISC),
  [Phosphor](https://phosphoricons.com/) (MIT), and
  [Iconoir](https://iconoir.com/docs) (MIT) are suitable candidates. Choose
  one coherent icon family per project; mix only for a declared semantic need.
  Keep package/version/license in the asset manifest.
- **Interaction primitives:** [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction)
  (MIT) and [React Aria](https://react-spectrum.adobe.com/react-aria/index.html)
  (Apache-2.0 project) can supply keyboard and screen-reader behavior while
  Verve authors the visual skin. [shadcn/ui](https://ui.shadcn.com/docs)
  distributes editable source but importing its default look across every
  generated site would recreate the sameness problem.
- **One-off decorative SVG:** prefer original programmatic geometry tied to
  the brief and document it as generated. For catalog sites such as
  [SVG Repo](https://www.svgrepo.com/page/licensing), check the *individual*
  asset's license, attribution, and trademark restrictions before copying;
  do not treat a catalog homepage as a blanket license.

All copied assets need a pinned origin, license text or notice, integrity hash,
alt intent where relevant, and local delivery. Sanitize untrusted SVG before
inlining; no arbitrary remote SVG injection or unlicensed hotlinks. A library
component is only a behavior starting point: render-based proof and the
project's design thesis decide its final appearance.

## 5. The API-versus-IDE question

A raw API is **not** what prevents a compelling site. A model inside an AI IDE
is still reached through an API or inference service. The larger product gap is
the surrounding *execution loop*: persistent filesystem context, package
installation, build and browser diagnostics, safe patch application, version
history, integrations, and deployment. Verve already owns part of this loop
(generation, HTML/React preview, editor, staged patches, ZIP), but not a full
isolated runtime for every generated stack or a collaboration/deployment layer.

Current [v0 documentation](https://vercel.com/academy/vercel-foundations/v0-way)
describes sandbox scaffolding, live preview, GitHub import/sync, console,
versions, and deployment. [Lovable's own documentation](https://docs.lovable.dev/features/browser-testing)
describes real-browser testing. Therefore "we also have a preview" is not a
differentiator. Do **not** attempt generic IDE feature parity first.

The defensible wedge is the *continuity of a design decision*: six serious
directions, visible tradeoffs, one selected thesis, verified implementation,
and edits that preserve approved identity and facts. Add an optional bounded
execution sandbox only after defining CPU/time/network/filesystem limits,
secret isolation, dependency policy, and a cleanup strategy. Never execute
arbitrary generated server code in the main Verve web process.

## 6. What the current Verve site communicates

The current homepage has a recognizable ink/paper/correction palette, clear
primary CTA, and readable typographic hierarchy. The examples page shows six
real project screenshots and honestly labels their curated provenance.
That is credible progress, **not design perfection or unique market quality**.

The homepage still follows a familiar hero → three steps → featured project →
three value propositions → CTA structure. The example cards repeat one
Expected/Turn/Outcome wrapper, which visually flattens six different worlds.
The featured interactive example must be checked at the moment it enters the
viewport; a static full-page headless screenshot captured a white iframe while
browser inspection later confirmed the `srcDoc` content loaded. Treat that as
a rendering/measurement question, not a proven customer-facing outage.

Next site iteration: lead with an immediately inspectable working result and
one concise proof of transformation; give each example a distinct editorial
presentation keyed to its actual task (map, journey, workbench, lab, collection,
flow), while keeping neutral navigation and consistent accessibility. Run
desktop/mobile screenshots and five-person comprehension tests: can a new
visitor say what Verve produces, inspect one working task, and understand
why it differs from a template within 60 seconds?

## 7. Roadmap with gates

### Phase A — release integrity (next)

Fix partial-repair issue propagation; add full dependency resolution with
pinned ranges; distinguish aliased local imports from packages; introduce
`locale/lang/dir` in ProjectSpec and export. Run a generated-project build
and browser smoke in an isolated worker for at least one Next.js and one Vite
sample. Exit only when a failing build or residual blocker cannot be called
Ready. Do not add a new aggregate creativity score.

### Phase B — visual grammar pilot

Implement the versioned grammar descriptor and a small set of operators
covering restrained, tactile, expressive, and data-dense choices. Design
content-aware direction studies using actual available type and assets.
Run the 24-brief corpus with frozen seeds and human review; check structural
distance, task fit, accessible contrast, motion reduction and mobile
transformation. Exit when breadth improves without degrading usefulness.

### Phase C — six proof projects and the Verve site

Rebuild the six curated references as complete task experiences with licensed
assets, working interactions, distinct mobile compositions, and reproducible
receipts. Label them curated until genuine engine re-generation passes a
matched test. Recompose the gallery around the six different tasks and make
the homepage proof immediately usable. Treat the 0.50 distance target as
provisional until blinded raters agree it tracks meaningful distinctiveness.

### Phase D — identity-preserving Studio

Add scene-scoped edits, identity/fact locks, before/after comparison, revision
binding, and affected-test reruns. An optional sandboxed build/preview
environment can then deepen into Git import/export, explicit integration
adapters and deploy handoff. Keep Fast, Creative and Studio roles separate.

### Phase E — market and scientific validation

Pre-register a held-out subset of briefs and compare Verve with competitors
under the same brief, time, assets and budget. Blind raters to tool identity.
Measure task success, visual craft, factual correctness, accessibility,
revision count, time to acceptance, and willingness to use again separately.
Report confidence intervals and disagreement. Do not claim a new creativity
theorem from an internal distance function; publish a falsifiable design
hypothesis and reproduce it first.

## 8. Models added in this slice

The picker adds **optional** GPT-6 Astra, Claude Opus 5.5, and Gemini 3.8
Flash while retaining the existing defaults and model IDs. The adapters send
GPT-6 through Responses and map unsupported `none` effort to `low` for
Astra; omit temperature for Opus 5.5 and Gemini 3.8; allow extra Opus output
headroom for adaptive thinking; and reject truncated Anthropic output. These
are request-contract and regression tests, **not live provider smoke tests**:
no provider credentials were supplied. Gemini still uses the legacy
`@google/generative-ai` SDK; Google recommends migrating to the GA
`@google/genai` SDK before treating new-model support as fully operational.
Rollout requires a consented real-call matrix and a measured latency/cost
comparison; do not silently replace the current defaults.

Primary references: [OpenAI GPT-6 guidance](https://developers.openai.com/api/docs/guides/latest-model),
[Anthropic Opus 5.5 migration](https://platform.claude.com/docs/en/models/opus-5-5/migration-guide),
[Gemini 3.8 Flash migration](https://ai.google.dev/gemini-api/docs/generate-content/latest-model),
[Google SDK migration](https://ai.google.dev/gemini-api/docs/migrate),
[WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials),
and [Material Design 3 Expressive](https://m3.material.io/).
