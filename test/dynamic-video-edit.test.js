import test from "node:test";
import assert from "node:assert/strict";

import { buildAudioFilter, buildFilter, buildSyncAnchors, makeShots, parseArgs } from "../scripts/build-dynamic-demo-video.mjs";

function alignmentFixture() {
  const beats = Array.from({ length: 12 }, (_value, index) => ({
    id: `${String(index + 1).padStart(2, "0")}-beat`,
    speechStartSeconds: index * 13 + 0.3,
    speechEndSeconds: index * 13 + 12.7,
    words: []
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
  assert.equal(shots.filter((shot) => shot.image).length, 6);
  assert.equal(shots.filter((shot) => shot.call).length, 14);
  assert.equal(shots.reduce((count, shot) => count + (shot.focus?.length ?? 0), 0), 4);
  assert.equal(shots.filter((shot) => shot.transitionInSeconds).length, 11);
  assert.equal(shots.filter((shot) => shot.transitionOutSeconds).length, 11);
  assert.ok(shots.some((shot) => shot.mode === "proof"));
  assert.ok(shots.some((shot) => shot.mode === "timelineTools"));
  assert.ok(shots.some((shot) => shot.mode === "recapture"));
  assert.ok(shots.some((shot) => shot.mode === "outro"));
});

test("dynamic edit CLI exposes repository-local defaults", () => {
  const options = parseArgs([]);
  assert.equal(options.source, "submission/video/chrome-replay-silent.mp4");
  assert.equal(options.output, "submission/video/semantic-spatial-webmcp-demo.mp4");
  assert.equal(options.contactSheet, "submission/screenshots/demo-dynamic-contact-sheet.png");
  assert.equal(options.outroFrame, "submission/video/chrome-replay-outro.png");
  assert.equal(options.music, "submission/video/music/sceneindex-ambient.wav");
  assert.equal(options.receipt, "docs/demo-video-verification.json");
  assert.equal(options.dynamicsReceipt, "docs/demo-media-dynamics.json");
});

test("key visuals stay within 450 milliseconds of their narration anchors", () => {
  const fixture = alignmentFixture();
  fixture.beats[3].id = "04-baseline-route";
  fixture.beats[4].id = "05-lift-closure";
  fixture.beats[5].id = "06-alternate-route";
  fixture.beats[5].words = [{ text: "wayfinding", startSeconds: 73.1 }];
  fixture.beats[9].id = "10-webmcp";
  const shots = makeShots(fixture);
  assert.ok(buildSyncAnchors(shots, fixture).every(({ offsetSeconds }) => Math.abs(offsetSeconds) <= 0.45));
});

test("dynamic edit renders opaque titles, animated call focus, music ducking, and UI cues", () => {
  const shot = makeShots(alignmentFixture()).find(({ call }) => call);
  const videoFilter = buildFilter(shot, shot.duration, 0, 24);
  assert.match(videoFilter, /LIVE AGENT CALL/);
  assert.match(videoFilter, /set_entity_state/);
  assert.match(videoFilter, /0x37D4C6/);
  assert.match(videoFilter, /drawbox=x=0:y=808:w=1140:h=212:color=0x111418:t=fill/);
  assert.match(videoFilter, /crop=1280:720:0:250/);
  assert.match(videoFilter, /crop=1920:1080:x='40\+20\*sin/);

  const focusShot = makeShots(alignmentFixture()).find(({ focus }) => focus);
  const focusFilter = buildFilter(focusShot, focusShot.duration, 18, 24);
  assert.match(focusFilter, /WEBMCP CALL/);
  assert.match(focusFilter, /navigate_to_entity/);
  assert.match(focusFilter, /RESULT/);

  const audioFilter = buildAudioFilter([0.12, 13.5]);
  assert.match(audioFilter, /sine=frequency=880/);
  assert.match(audioFilter, /sine=frequency=1120/);
  assert.match(audioFilter, /sidechaincompress/);
  assert.match(audioFilter, /volume=0\.34/);
  assert.match(audioFilter, /amix=inputs=4/);
});
