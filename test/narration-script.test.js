import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const narration = JSON.parse(readFileSync(new URL("../submission/narration-script.json", import.meta.url)));
const attestation = JSON.parse(readFileSync(new URL("../docs/entrant-attestation.json", import.meta.url)));
const captions = readFileSync(new URL("../submission/demo-narration.srt", import.meta.url), "utf8");

test("narration segments cover one continuous sub-three-minute timeline", () => {
  assert.equal(narration.schemaVersion, 1);
  assert.equal(narration.segments[0].start, 0);
  narration.segments.forEach((segment, index) => {
    assert.ok(segment.text.trim());
    assert.ok(segment.end > segment.start);
    if (index > 0) assert.equal(segment.start, narration.segments[index - 1].end);
  });
  assert.equal(narration.segments.at(-1).end, narration.targetDurationSeconds);
  assert.ok(narration.targetDurationSeconds < 180);
});

test("English captions cover all eleven narration segments through 2:55", () => {
  const cueNumbers = [...captions.matchAll(/^\d+$/gm)].map(([value]) => Number(value));
  assert.deepEqual(cueNumbers, Array.from({ length: 11 }, (_value, index) => index + 1));
  assert.match(captions, /00:02:44,000 --> 00:02:55,000/);
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
