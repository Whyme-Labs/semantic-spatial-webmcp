import test from "node:test";
import assert from "node:assert/strict";

import { atomOffsets, parseEbur128, parseSrt } from "../scripts/verify-youtube-upload.mjs";

test("upload verifier parses sequential SRT cues", () => {
  const cues = parseSrt("1\n00:00:00,100 --> 00:00:01,200\nFirst cue\n\n2\n00:00:01,300 --> 00:00:02,400\nSecond cue\n");
  assert.deepEqual(cues.map(({ cue }) => cue), [1, 2]);
  assert.equal(cues[0].startSeconds, 0.1);
  assert.equal(cues[1].endSeconds, 2.4);
});

test("upload verifier parses final ebur128 summary", () => {
  assert.deepEqual(parseEbur128("noise\nSummary:\n I: -16.3 LUFS\n LRA: 2.0 LU\n Peak: -1.0 dBFS\n"), {
    integratedLufs: -16.3,
    loudnessRangeLu: 2,
    truePeakDbfs: -1
  });
});

test("upload verifier locates MP4 fast-start atoms", () => {
  const atoms = atomOffsets(Buffer.from("0000ftyp1111moov2222mdat"));
  assert.ok(atoms.ftyp < atoms.moov);
  assert.ok(atoms.moov < atoms.mdat);
});
