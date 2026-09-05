# Evaluation coherence

Verve produces several measurements because a generated project can fail in different ways. Those measurements are not interchangeable. A plan can be conceptually strong while its delivered font is missing; a source file can be valid while the rendered mobile experience hides the primary action; a distinctive direction can still compile into a recurring house template.

Evaluation Coherence makes those relationships explicit without inventing another master score.

## Evidence classes and authority

| Class | Question | Examples | Authority |
| --- | --- | --- | --- |
| Release gate | May the project be labelled ready? | project readiness, Quality Report | Veto |
| Delivered source | Did the generated files realize the contract? | typography delivery, asset delivery and use, source FVF, template diversity | Evidence; a blocking source failure vetoes readiness |
| Render evidence | What happened in the browser at the release widths and states? | FVE, rendered FVF, RES, RCR, Direction Fidelity | Required before a visual-creative claim becomes eligible |
| Plan diagnostic | Is the proposed direction plausible and purposeful? | direction-board diversity, Norman reading, Restraint heuristic | Hypothesis only |
| Provenance | How was optional intelligence obtained? | provider critique or local fallback | Confidence qualifier |

The ordering is a partial order, not a ranking of taste:

```text
blocking release/source/render evidence
  vetoes
plan diagnostic and provenance optimism
```

Scores from different evidence classes are never averaged. A high Norman behavioral reading and a low Restraint heuristic are not automatically contradictory: one estimates plan-level usability while the other asks whether a proposed signature earns its prominence. A contradiction exists only when two signals claim the same invariant and disagree, such as a blocking Media Gate paired with a passing assets axis.

## Creative claim state

`creativeClaim` is separate from project readiness:

- `withheld`: the project is blocked, plan/source diversity failed, Render Gate failed, Direction Fidelity failed, or the rendered archive distance is below the mode threshold.
- `provisional`: the source result is plausible but browser evidence is incomplete, under review, or the Creative critique used a degraded local fallback.
- `eligible`: the server-side gates permit the result, all three release viewports passed, direction realization passed, archive distance cleared its threshold, and critique provenance was not degraded.

`eligible` is deliberately not “beautiful” or “award winning.” It means only that the evidence needed for Verve's bounded distinctiveness claim is present.

## Render evidence persistence and privacy

The API cannot know the final browser geometry when it returns the generated project. The workbench therefore attaches a bounded local summary after rendering 360, 768, and 1440 pixels. It stores:

- counts, statuses, and normalized metric values;
- the Direction Fidelity status and value;
- the distance from the local visual archive;
- one capture timestamp.

It does not add the brief, source code, screenshots, copy, images, form values, or raw route/state names to telemetry. The summary stays with the browser-local history entry.

## Why this is not a new quality formula

Reviews of generative-design evaluation distinguish fidelity or similarity, diversity, constraint satisfaction, functional performance, and conditioning rather than treating them as one construct. Automated generative metrics can also diverge from human judgment. Evaluation Coherence uses those lessons conservatively: separate measurements, explicit vetoes, and visible disagreement instead of a weighted average presented as truth.

References:

- Regenwetter et al., [Deep Generative Models in Engineering Design: A Review](https://doi.org/10.1016/j.compind.2023.103861).
- Stein et al., [Exposing flaws of generative model evaluation metrics and their unfair treatment of diffusion models](https://arxiv.org/abs/2306.04675).
- Bradley et al., [Quality-Diversity through AI Feedback](https://arxiv.org/abs/2310.12103).

## Calibration experiment

The next defensible quantitative step starts after at least 15–30 real, render-complete runs have been collected across the fixed brief corpus.

1. Build a disagreement matrix by evidence class and failure reason.
2. Use weighted Cohen's kappa only for ordinal signals that claim the same outcome (`pass`, `review`, `fail`). Do not compare semantically different diagnostics merely because both expose numbers.
3. Use rank correlation only to test a named hypothesis between compatible continuous measures; report the sample size and uncertainty.
4. Keep quality, accessibility, functional success, structural novelty, visual archive distance, and cost as separate objectives. Select non-dominated candidates on a Pareto frontier rather than maximizing a composite mean.
5. Collect pairwise human judgments of task quality and perceptual similarity. With enough labels, calibrate the visual-fingerprint distance or a small learned metric; do not let average preference collapse the archive to one popular style.

This experiment may support a new Verve-specific result. Until it is run, it is a research protocol, not a mathematical discovery.
