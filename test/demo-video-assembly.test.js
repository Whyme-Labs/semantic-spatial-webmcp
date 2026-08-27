import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs, validateSources } from "../scripts/assemble-demo-video.mjs";

function validSources() {
  return [
    {
      result: "passed",
      artifact: { dirty: false },
      webmcp: { toolCount: 10 },
      flow: { timeline: { entryCount: 10, allSourceLabelledAgent: true, allSuccessful: true } },
      console: { errors: [] },
      videoCapture: { durationSeconds: 177.5 }
    },
    {
      result: "passed",
      output: { durationSeconds: 175 },
      segments: Array.from({ length: 11 })
    },
    {
      result: "passed",
      failures: [],
      segments: Array.from({ length: 11 })
    }
  ];
}

test("demo assembly accepts matching clean replay and narration receipts", () => {
  assert.deepEqual(validateSources(...validSources()), {
    durationSeconds: 175,
    captureDurationSeconds: 177.5,
    timeScale: 175 / 177.5
  });
});

test("demo assembly rejects an unsafe replay scale or failed alignment", () => {
  const [capture, narration, alignment] = validSources();
  capture.videoCapture.durationSeconds = 900;
  assert.throws(() => validateSources(capture, narration, alignment), /unsafe/);
  capture.videoCapture.durationSeconds = 177.5;
  alignment.failures = ["segment"];
  assert.throws(() => validateSources(capture, narration, alignment), /alignment did not pass/);
});

test("demo assembly CLI exposes repository-local defaults", () => {
  const options = parseArgs([]);
  assert.equal(options.output, "submission/video/semantic-spatial-webmcp-demo.mp4");
  assert.equal(options.receipt, "docs/demo-video-verification.json");
  assert.equal(options.timelineFrame, "submission/video/chrome-replay-timeline.png");
  assert.equal(options.outroFrame, "submission/video/chrome-replay-outro.png");
});
