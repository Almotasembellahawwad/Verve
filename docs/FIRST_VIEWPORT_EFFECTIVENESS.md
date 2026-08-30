# First Viewport Effectiveness

Status: experimental metric, not a validated creativity score.

## Claim

Opening size is not a quality proxy. A viewport-filling composition can be
useful when it carries the primary object, decision evidence, and an immediate
action. A compact opening can still fail when it communicates only atmosphere.

Verve therefore evaluates the task-carrying capacity of the initial viewport
without including hero height, headline size, or visual density as positive or
negative terms.

## Contract

ProjectSpec v2 declares a `task-bearing-opening` with `any-scale`
presentation. Generated source provides three measurement hooks:

- `data-verve-task="primary-object"`
- `data-verve-task="decision-evidence"`
- `data-verve-primary-action`

The hooks do not style the project. Static validation checks that the contract
exists; Render Gate verifies whether marked evidence is actually visible at
360, 768, and 1440 pixels.

## Metric

For each rendered viewport, Verve estimates:

- `T`: task coverage, capped after two distinct visible task signals.
- `S`: information salience, estimated from the bounded visible area of those
  signals.
- `A`: action clarity, one only when the marked primary control is visible and
  has an accessible name.
- `C`: scroll cost to the marked primary action.

The provisional First Viewport Effectiveness score is:

```text
FVE = (0.45T + 0.25S + 0.30A) / (1 + 0.50C)
```

All inputs and the final result are bounded to `[0, 1]`. A viewport enters
review when it has fewer than two distinct task signals, lacks a visible
primary action, or scores below `0.55`. A project's displayed FVE is the
minimum measured score across the covered viewports so a strong desktop result
cannot hide a postponed mobile task.

## What the metric does not establish

FVE does not prove that copy is true, that the primary action is the right
business action, or that a design is original. Generated markup could also
mislabel atmospheric content as task evidence. Content safety, ProjectSpec,
accessibility checks, and human review remain separate gates.

The coefficients and threshold are hypotheses. They should be calibrated on
blind task-completion and comprehension studies rather than tuned until current
examples pass.

## Next experiment

The next research stage should pair FVE with Brief-Conditioned Creative
Responsiveness. For each base brief, generate:

1. a meaning-preserving paraphrase;
2. a semantic counterfactual that changes the primary job;
3. the original brief.

A useful creative engine should remain structurally stable under the
paraphrase, change on relevant axes under the counterfactual, and preserve FVE
and the hard quality gates in both cases. This tests controlled response to
meaning instead of rewarding random visual distance.
