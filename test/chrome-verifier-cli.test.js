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
    headed: true,
    startDelayMs: 15000,
    stepDelayMs: 11000,
    holdMs: 25000
  });
});

test("Chrome verifier rejects unsafe replay delays", () => {
  assert.throws(() => parseArgs(["--step-delay", "60001"]), /0 to 60000/);
  assert.throws(() => parseArgs(["--hold", "600001"]), /0 to 600000/);
  assert.throws(() => parseArgs(["--start-delay", "1.5"]), /must be an integer/);
});
