# Composition Genome v1

Status: deterministic composition-planning heuristic. It is not a validated creativity, beauty, or usability measure.

## Problem

A page-wide art-direction sentence can still compile into repeated centered sections. Composition Genome moves spatial decisions down to the scene level. Every story scene receives a bounded contract whose axes can be compared, validated, sent to code generation, and traced in delivered source.

## Genes

Each assignment contains seven categorical axes:

| Axis | Weight | Examples |
| --- | ---: | --- |
| Structure | 0.28 | rail-canvas, radial-map, modular-matrix |
| Focal position | 0.16 | leading, center, edge, distributed |
| Reading flow | 0.14 | vertical, horizontal, radial, alternating |
| Depth | 0.12 | flat, layered, immersive |
| Media frame | 0.12 | inset, full-bleed, fragmented, constellation |
| Overlap | 0.10 | none, contained, cross-boundary |
| Density | 0.08 | sparse, balanced, dense |

For two genomes `g` and `h`, weighted categorical distance is:

```text
D(g,h) = Σₖ wₖ · 𝟙[gₖ ≠ hₖ]
```

The weights sum to one, so `D ∈ [0,1]`. Structure is intentionally strongest, while density alone cannot make two centered stacks count as different.

## Selection

The candidate pool contains eight structural families. Scene fitness is computed from the selected experience model, scene information shape, and scene visual medium.

For every scene after the first, candidates with adjacent distance below `0.30` are discarded when a viable alternative exists. Remaining candidates use:

```text
S(c) = 0.60 · fitness(c)
     + 0.37 · min-distance(c, assigned scenes)
     + 0.03 · stable-tie-break(c)
```

The small tie-break is a deterministic hash, not runtime randomness. The same inputs produce the same genome. Changing the experience model or scene evidence can change the result.

Until the project has established three structural families (or authored fewer than three scenes), selection is constrained to an unused viable structure. This makes the minimum breadth an invariant rather than a fortunate outcome of scoring.

This is a quality-diversity planner, not novelty for its own sake: fitness remains the majority term, while the maximin term prevents local convergence on one section recipe.

## Continuity and responsive behavior

Spatial difference must still tell one story. Each scene transition declares `echo`, `contrast`, `escalate`, or `resolve`. Every structure also receives one mobile transformation such as focus-and-drawer, pan-and-focus, preserved overlap, sequenced cards, or deliberate single-column reorder.

Code generation must implement the genes as layout behavior. The scene root carries exact `data-verve-composition`, `data-verve-flow`, and `data-verve-depth` values beside its `data-verve-scene` ID. These attributes are measurement hooks and must not be CSS selectors.

## Evidence boundary

Visual Intent source inspection verifies that the expected gene values occur together on the correct scene root. This catches omitted or partially switched composition contracts and lowers Functional Visual Fulfillment.

It does not prove that the rendered geometry matches the declared family. A generator could still write correct markers around weak CSS. The next calibration step is Rendered Composition Realization: compare child geometry, overlap, focal dominance, depth, and responsive transformation across screenshots and validate those signals against human review.
