import test from "node:test";
import assert from "node:assert/strict";

import { makeShots, parseArgs } from "../scripts/build-dynamic-demo-video.mjs";

function alignmentFixture() {
  const beats = Array.from({ length: 12 }, (_value, index) => ({
    id: `${String(index + 1).padStart(2, "0")}-beat`,
    speechStartSeconds: index * 13 + 0.3,
    speechEndSeconds: index * 13 + 12.3
  }));
  return { audio: { durationSeconds: 156.8 }, beats };
}

test("dynamic edit maps twelve narration beats to twenty-four bounded shots", () => {
  const shots = makeShots(alignmentFixture());
  assert.equal(shots.length, 24);
  assert.equal(shots[0].start, 0);
  assert.equal(shots.at(-1).end, 156.8);
  assert.ok(shots.every((shot) => shot.duration > 3 && shot.duration < 9));
  assert.equal(shots.filter((shot) => shot.title).length, 12);
  assert.equal(shots.filter((shot) => shot.image).length, 4);
});

test("dynamic edit CLI exposes repository-local defaults", () => {
  const options = parseArgs([]);
  assert.equal(options.source, "submission/video/chrome-replay-silent.mp4");
  assert.equal(options.output, "submission/video/semantic-spatial-webmcp-demo.mp4");
  assert.equal(options.receipt, "docs/demo-video-verification.json");
  assert.equal(options.dynamicsReceipt, "docs/demo-media-dynamics.json");
});
