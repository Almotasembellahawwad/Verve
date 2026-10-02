import test from "node:test";
import assert from "node:assert/strict";
import measured from "../data/public-demo-visual-truth.json";

test("architecture records verified post-media-fix Windows and Linux measurements", () => {
  const architecture = measured.examples.architecture;
  assert.equal(architecture.platformDistances.win32, 0.326);
  assert.equal(architecture.platformDistances.linux, 0.325);
  assert.equal(architecture.nearestMeasuredExampleDistance, Math.min(...Object.values(architecture.platformDistances)));
  assert.equal(architecture.linuxMeasurementSource, "https://github.com/Almotasembellahawwad/Verve/actions/runs/37066132378/job/111034253953");
  assert.match(architecture.measurementNote, /e6e816d875fee0241aaea3dd3ec51faec450511f/);
  assert.ok(architecture.nearestMeasuredExampleDistance < measured.releaseDistanceThreshold, "Calibration must not manufacture a diversity release pass");
  assert.notDeepEqual(architecture.platformDistances, architecture.historicalPlatformDistances, "Pre-fix measurements remain historical only");
});
