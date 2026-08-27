import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs } from "../scripts/verify-webmcp-chrome.mjs";

test("Chrome verifier parses a paced headed replay", () => {
  assert.deepEqual(parseArgs([
    "--url", "https://example.com/",
    "--headed",
    "--start-delay", "15000",
    "--step-delay", "11000",
    "--hold", "25000",
    "--output", "receipt.json"
  ]), {
    url: "https://example.com/",
    chrome: null,
    output: "receipt.json",
    screenshot: null,
    video: null,
    videoFps: 10,
    timelineFrame: null,
    outroFrame: null,
    headed: true,
    startDelayMs: 15000,
    stepDelayMs: 11000,
    stepDelaysMs: null,
    outroUrl: null,
    outroDelayMs: 0,
    holdMs: 25000
  });
});

test("Chrome verifier rejects unsafe replay delays", () => {
  assert.throws(() => parseArgs(["--step-delay", "60001"]), /0 to 60000/);
  assert.throws(() => parseArgs(["--hold", "600001"]), /0 to 600000/);
  assert.throws(() => parseArgs(["--start-delay", "1.5"]), /must be an integer/);
  assert.throws(() => parseArgs(["--video-fps", "4"]), /5 to 30/);
  assert.throws(() => parseArgs(["--step-delays", "1,2,3"]), /exactly ten/);
  assert.deepEqual(
    parseArgs(["--step-delays", "1,2,3,4,5,6,7,8,9,10"]).stepDelaysMs,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  assert.equal(
    parseArgs(["--outro-url", "https://example.com/"]).outroUrl,
    "https://example.com/"
  );
  assert.equal(parseArgs(["--timeline-frame", "timeline.png"]).timelineFrame, "timeline.png");
  assert.equal(parseArgs(["--outro-frame", "outro.png"]).outroFrame, "outro.png");
});
