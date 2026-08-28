import test from "node:test";
import assert from "node:assert/strict";

import { buildAudioFilter, buildFilter, makeShots, parseArgs } from "../scripts/build-dynamic-demo-video.mjs";

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
  assert.equal(shots.filter((shot) => shot.call).length, 14);
  assert.equal(shots.filter((shot) => shot.transitionInSeconds).length, 11);
  assert.equal(shots.filter((shot) => shot.transitionOutSeconds).length, 11);
  assert.ok(shots.some((shot) => shot.mode === "proof"));
  assert.ok(shots.some((shot) => shot.mode === "timelineTools"));
});

test("dynamic edit CLI exposes repository-local defaults", () => {
  const options = parseArgs([]);
  assert.equal(options.source, "submission/video/chrome-replay-silent.mp4");
  assert.equal(options.output, "submission/video/semantic-spatial-webmcp-demo.mp4");
  assert.equal(options.contactSheet, "submission/screenshots/demo-dynamic-contact-sheet.png");
  assert.equal(options.receipt, "docs/demo-video-verification.json");
  assert.equal(options.dynamicsReceipt, "docs/demo-media-dynamics.json");
});

test("dynamic edit renders exact live-call overlays and synthesized UI cues", () => {
  const shot = makeShots(alignmentFixture()).find(({ call }) => call);
  const videoFilter = buildFilter(shot, shot.duration, 0, 24);
  assert.match(videoFilter, /LIVE AGENT CALL/);
  assert.match(videoFilter, /set_entity_state/);
  assert.match(videoFilter, /0x37D4C6/);

  const audioFilter = buildAudioFilter([0.12, 13.5]);
  assert.match(audioFilter, /sine=frequency=880/);
  assert.match(audioFilter, /sine=frequency=1120/);
  assert.match(audioFilter, /amix=inputs=3/);
});
