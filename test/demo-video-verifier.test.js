import test from "node:test";
import assert from "node:assert/strict";

import { analyzeProbe, parseArgs, parseVolumeDetect } from "../scripts/verify-demo-video.mjs";

function validProbe(overrides = {}) {
  return {
    format: { duration: "175.25", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
    streams: [
      {
        codec_type: "video",
        codec_name: "h264",
        width: 1920,
        height: 1080,
        avg_frame_rate: "30/1"
      },
      {
        codec_type: "audio",
        codec_name: "aac",
        channels: 2,
        channel_layout: "stereo",
        sample_rate: "48000"
      }
    ],
    ...overrides
  };
}

const audible = { meanVolumeDb: -22.4, maxVolumeDb: -2.1 };

test("demo video analysis accepts an audible 1080p export below three minutes", () => {
  const receipt = analyzeProbe(validProbe(), audible);
  assert.equal(receipt.underThreeMinutes, true);
  assert.deepEqual(receipt.video, {
    codec: "h264",
    width: 1920,
    height: 1080,
    rotation: 0,
    frameRate: 30
  });
  assert.equal(receipt.audio.nonSilent, true);
});

test("demo video analysis rejects the three-minute boundary", () => {
  assert.throws(
    () => analyzeProbe(validProbe({ format: { duration: "180", format_name: "mp4" } }), audible),
    /shorter than 180 seconds/
  );
  assert.throws(
    () => analyzeProbe(validProbe({ format: { duration: "175", format_name: "matroska,webm" } }), audible),
    /MP4 container/
  );
});

test("demo video analysis rejects missing or effectively silent audio", () => {
  const noAudio = validProbe();
  noAudio.streams = noAudio.streams.filter((stream) => stream.codec_type !== "audio");
  assert.throws(() => analyzeProbe(noAudio, audible), /No audio stream/);
  assert.throws(() => analyzeProbe(validProbe(), { meanVolumeDb: -91, maxVolumeDb: -91 }), /appears silent/);
});

test("volume parser reads ffmpeg output and handles negative infinity", () => {
  assert.deepEqual(
    parseVolumeDetect("[Parsed_volumedetect] mean_volume: -24.8 dB\n[Parsed_volumedetect] max_volume: -1.4 dB"),
    { meanVolumeDb: -24.8, maxVolumeDb: -1.4 }
  );
  assert.equal(parseVolumeDetect("mean_volume: -inf dB\nmax_volume: -inf dB").maxVolumeDb, Number.NEGATIVE_INFINITY);
});

test("demo video CLI parses explicit limits", () => {
  assert.deepEqual(parseArgs([
    "--video", "submission/video/demo.mp4",
    "--output", "docs/demo-video-verification.json",
    "--max-duration", "178",
    "--min-width", "1920",
    "--min-height", "1080"
  ]), {
    video: "submission/video/demo.mp4",
    output: "docs/demo-video-verification.json",
    maxDurationSeconds: 178,
    minWidth: 1920,
    minHeight: 1080
  });
  assert.throws(
    () => parseArgs(["--video", "demo.mp4", "--max-duration", "181"]),
    /cannot weaken/
  );
});
