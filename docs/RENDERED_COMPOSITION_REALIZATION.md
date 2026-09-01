# Rendered Composition Realization

Status: experimental DOM-geometry evidence. RCR is not a validated measure of beauty, originality, or usability.

## Why it exists

Composition Genome declares a different spatial contract for every Story Graph scene. Exact source markers prove that the contract reached generated code, but a generator could still place those markers around repeated centered stacks. Rendered Composition Realization (RCR) measures the browser result and makes that shortcut visible.

The probe is ephemeral. It runs only inside the isolated preview and is never written to project source, history, or ZIP exports.

## Scene geometry

For each visible scene root, the probe measures its first meaningful layout children. A single wrapper is unwrapped once so ordinary component shells do not hide the real composition. The bounded numeric signature contains:

- row and column bands;
- horizontal and vertical spread;
- sibling overlap and boundary crossing;
- focal dominance and edge bias;
- depth-producing CSS signals;
- size variation, angular coverage, and alignment concentration;
- occupied area, media coverage, media fragments, and internal horizontal pan.

The declared structural family has a profile over those signals. The remaining focal-position, flow, overlap, depth, density, and media-frame genes are scored separately. Per-scene realization is:

```text
R_scene = √(structureFit × geneFit) × markerIntegrity
```

`markerIntegrity` is `1` only when the expected structure, flow, and depth values occur on the measured scene root; otherwise it is `0.45`. A scene is counted as realized at `R_scene ≥ 0.60`.

## Repetition and project aggregation

Adjacent scenes are compared using the mean normalized L1 distance across a 16-value geometry vector:

```text
D_rendered(a,b) = (1/16) Σᵢ |aᵢ - bᵢ|
```

An adjacent pair below `0.12` is reported as repeated geometry even if its HTML markers name different structures. Project RCR uses the harmonic mean of scene scores, then applies a bounded penalty for repeated adjacent pairs. One strong opening therefore cannot average away several weak scenes.

## Responsive realization

Direction Fidelity joins privacy-safe scene hashes across the 360px and 1440px reports. It tests the declared mobile transformation against geometry:

- single-column reorder reduces or preserves a genuinely narrow column structure;
- focus-and-drawer must collapse columns, create internal pan, or materially change geometry;
- preserved overlap retains overlap, depth, or boundary crossing;
- pan-and-focus exposes bounded internal pan or a horizontally distributed focus surface;
- sequenced cards become a narrow multi-row sequence.

Missing viewport pairs receive no responsive-composition credit. Composition contributes 20% of Direction Fidelity; route, state, scene, layer, and typography evidence remain independent.

## Privacy and limitations

Reports contain hashes, categorical public structure names, and bounded numbers. They do not contain brief text, generated copy, route names, scene IDs, code, images, or form values.

RCR cannot determine whether a composition is tasteful, culturally appropriate, emotionally effective, or visually beautiful. Thresholds are engineering hypotheses calibrated by adversarial fixtures, not human-grounded psychometric constants. Nested layout systems, transforms with unusual coordinate spaces, and visually meaningful backgrounds can still be under-measured. The next calibration step is to compare RCR predictions with blinded human pairwise judgments over generated screenshots and adjust thresholds only from held-out results.
