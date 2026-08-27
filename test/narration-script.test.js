import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const narration = JSON.parse(readFileSync(new URL("../submission/narration-script.json", import.meta.url)));
const attestation = JSON.parse(readFileSync(new URL("../docs/entrant-attestation.json", import.meta.url)));
const generation = JSON.parse(readFileSync(new URL("../docs/demo-narration-verification.json", import.meta.url)));
const alignment = JSON.parse(readFileSync(new URL("../docs/demo-narration-alignment.json", import.meta.url)));
const audioQuality = JSON.parse(readFileSync(new URL("../docs/demo-audio-quality.json", import.meta.url)));
const captions = readFileSync(new URL("../submission/demo-narration.srt", import.meta.url), "utf8");

test("narration is one story-driven full-track prompt", () => {
  assert.equal(narration.schemaVersion, 2);
  assert.equal(narration.beats.length, 12);
  assert.ok(narration.beats.every((beat) => beat.id && beat.text.trim() && beat.visualIntent));
  assert.ok(narration.minimumDurationSeconds >= 120);
  assert.ok(narration.maximumDurationSeconds < 180);
  assert.match(narration.voiceControl, /one clean foreground voice/i);
});

test("English captions cover all twelve aligned story beats", () => {
  const cueNumbers = [...captions.matchAll(/^\d+$/gm)].map(([value]) => Number(value));
  assert.deepEqual(cueNumbers, Array.from({ length: 12 }, (_value, index) => index + 1));
  assert.match(captions, /SceneIndex makes a place searchable/);
});

test("generation, alignment, and hum checks prove one continuous master", () => {
  assert.equal(generation.schemaVersion, 2);
  assert.equal(generation.generator.mode, "single-pass");
  assert.equal(generation.script.beatCount, 12);
  assert.equal(generation.result, "passed");
  assert.equal(alignment.schemaVersion, 2);
  assert.equal(alignment.singleContinuousTrack, true);
  assert.equal(alignment.beats.length, 12);
  assert.deepEqual(alignment.failures, []);
  assert.equal(audioQuality.result, "passed");
  assert.ok(audioQuality.silence.fraction <= audioQuality.limits.maximumSilenceFraction);
  assert.ok(audioQuality.persistentTone.medianProminenceDb <= audioQuality.limits.maximumHumProminenceDb);
});

test("entrant attestation records the owner decisions without storing the voice sample", () => {
  assert.equal(attestation.entrant.name, "Soh Wei Meng");
  assert.equal(attestation.entrant.eligibleRepresentative, "Soh Wei Meng");
  assert.deepEqual(attestation.entrant.teamMembers, []);
  assert.equal(attestation.confirmations.eligibilityUnderOfficialRulesSection3, true);
  assert.equal(attestation.confirmations.ownershipAndMediaRights, true);
  assert.equal(attestation.confirmations.keepApplicationPublicThroughJudging, true);
  assert.equal(attestation.voiceReference.includeSourceInRepository, false);
  assert.match(attestation.voiceReference.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(attestation.youtube.ownerWillUpload, true);
});
