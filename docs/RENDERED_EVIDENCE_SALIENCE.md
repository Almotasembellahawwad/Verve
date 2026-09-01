# Rendered Evidence Salience (RES)

Status: experimental render-realization metric, not a validated creativity, beauty, or usability score.

## Problem

Source validation can prove that generated files contain a supplied record such as `Riso Notebook — A5 — 120gsm — EGP 450`. It cannot prove that the user can see that record, that it has meaningful visual weight, or that a generic opening does not push it out of the task surface.

RES closes only that gap. ProjectSpec assigns opaque `evidence-N` identifiers to story scenes. Generated markup puts each ID on the smallest meaningful visible group that renders the evidence. The preview receives IDs and evidence kinds, never the private text, and returns counts, unit scores, and one-way hashes for missing items.

## Measurement

For each expected item `i`:

- `wᵢ = 3` for a supplied record or declared collection total;
- `wᵢ = 2` for a requested comparison dimension;
- `wᵢ = 1` for other source-bound facts;
- `oᵢ ∈ {0,1}` indicates a visible, non-empty rendered marker;
- `aᵢ ∈ [0,1]` is bounded element area relative to the viewport, with a specificity penalty for marking an oversized section or page shell;
- `fᵢ ∈ [0,1]` is readable type scale relative to 24px;
- `sᵢ` is `1` inside a semantic data structure (`table`, `dl`, or a declared data layer) and `0.65` otherwise.

Local prominence is:

```text
pᵢ = √(aᵢ × (0.55fᵢ + 0.45sᵢ))
```

Weighted coverage and observed prominence are:

```text
C = Σ(wᵢoᵢ) / Σwᵢ
P = Σ(wᵢpᵢ) / Σ(wᵢoᵢ)
```

The reported score is the geometric mean:

```text
RES = √(C × P)
```

The geometric mean prevents full textual coverage with negligible visual weight from receiving a high score. It also prevents one very prominent record from hiding omitted evidence. Hook-scene evidence has a separate weighted first-viewport coverage value `H`.

## Gate policy

- **Fail:** a source-supplied record or declared collection total is not rendered.
- **Review:** `RES < 0.65` or hook evidence has `H < 1`.
- **Pass:** no critical evidence is missing, `RES ≥ 0.65`, and all hook evidence is visible in the first viewport.

These thresholds are engineering defaults, not research claims. They must be calibrated against human task-completion and preference data before RES can support broader conclusions.

## Privacy and anti-gaming boundary

The report contains no brief copy, generated copy, route names, form values, or raw evidence IDs. Missing IDs are one-way FNV keys used only to count and correlate expected evidence inside the active preview. Empty/hidden markers do not count. Marking an entire page receives an oversize specificity penalty, and measurement attributes are forbidden as CSS selectors.

RES complements rather than replaces:

- First Viewport Effectiveness (task/action access);
- Functional Visual Fulfillment (scene layers and purpose);
- Direction Fidelity (route/state/viewport realization);
- Visual Fingerprint distance (structural and perceptual diversity);
- human art direction and usability review.
