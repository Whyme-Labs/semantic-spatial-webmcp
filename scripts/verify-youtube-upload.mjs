#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULTS = Object.freeze({
  video: "submission/video/semantic-spatial-webmcp-demo.mp4",
  captions: "submission/demo-narration.srt",
  metadata: "submission/youtube-upload.md",
  videoReceipt: "docs/demo-video-verification.json",
  output: "docs/youtube-upload-verification.json"
});

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error?.code === "ENOENT") throw new Error(`${command} is required.`);
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  return result;
}

function srtSeconds(value) {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(value);
  if (!match) throw new Error(`Invalid SRT time: ${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function parseSrt(text) {
  return text.trim().split(/\r?\n\s*\r?\n/).map((block) => {
    const lines = block.split(/\r?\n/);
    const cue = Number(lines[0]);
    const timing = /^(\S+)\s+-->\s+(\S+)$/.exec(lines[1] ?? "");
    if (!Number.isInteger(cue) || !timing || lines.slice(2).join(" ").trim() === "") {
      throw new Error(`Invalid SRT cue: ${block}`);
    }
    return {
      cue,
      startSeconds: srtSeconds(timing[1]),
      endSeconds: srtSeconds(timing[2]),
      text: lines.slice(2).join(" ").trim()
    };
  });
}

function parseEbur128(text) {
  const summary = text.slice(text.lastIndexOf("Summary:"));
  const integrated = /I:\s*(-?\d+(?:\.\d+)?)\s+LUFS/.exec(summary);
  const range = /LRA:\s*(\d+(?:\.\d+)?)\s+LU/.exec(summary);
  const peak = /Peak:\s*(-?\d+(?:\.\d+)?)\s+dBFS/.exec(summary);
  if (!integrated || !range || !peak) throw new Error("Could not parse ebur128 summary");
  return {
    integratedLufs: Number(integrated[1]),
    loudnessRangeLu: Number(range[1]),
    truePeakDbfs: Number(peak[1])
  };
}

function atomOffsets(buffer) {
  return Object.fromEntries(["ftyp", "moov", "mdat"].map((name) => [name, buffer.indexOf(Buffer.from(name))]));
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { ...options, help: true };
    const key = argument.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    if (!argument.startsWith("--") || !(key in options)) throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function verify(options) {
  const videoPath = resolve(ROOT, options.video);
  const captionsPath = resolve(ROOT, options.captions);
  const metadataPath = resolve(ROOT, options.metadata);
  const receiptPath = resolve(ROOT, options.videoReceipt);
  const probe = JSON.parse(run("ffprobe", [
    "-v", "error", "-show_entries",
    "format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,avg_frame_rate,sample_rate,channels",
    "-of", "json", videoPath
  ]).stdout);
  const loudness = parseEbur128(run("ffmpeg", [
    "-hide_banner", "-nostats", "-i", videoPath, "-af", "ebur128=peak=true", "-f", "null", "-"
  ]).stderr);
  const videoReceipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  const metadata = readFileSync(metadataPath, "utf8");
  const cues = parseSrt(readFileSync(captionsPath, "utf8"));
  const durationSeconds = Number(probe.format.duration);
  const video = probe.streams.find(({ codec_type: type }) => type === "video");
  const audio = probe.streams.find(({ codec_type: type }) => type === "audio");
  const atoms = atomOffsets(readFileSync(videoPath));
  const captions = {
    cueCount: cues.length,
    firstStartSeconds: cues[0].startSeconds,
    lastEndSeconds: cues.at(-1).endSeconds,
    sequential: cues.every(({ cue }, index) => cue === index + 1),
    nonOverlapping: cues.every((cue, index) => index === 0 || cues[index - 1].endSeconds <= cue.startSeconds),
    withinVideo: cues.at(-1).endSeconds <= durationSeconds
  };
  const checks = {
    receiptMatchesVideo: videoReceipt.artifact.sha256 === sha256(videoPath),
    fastStart: atoms.ftyp >= 0 && atoms.moov >= 0 && atoms.mdat >= 0 && atoms.moov < atoms.mdat,
    durationBelowThreeMinutes: durationSeconds < 180,
    videoFormat: video?.codec_name === "h264" && video.width === 1920 && video.height === 1080 && video.avg_frame_rate === "30/1",
    audioFormat: audio?.codec_name === "aac" && audio.sample_rate === "48000" && audio.channels === 1,
    loudness: loudness.integratedLufs >= -20 && loudness.integratedLufs <= -12,
    truePeakHeadroom: loudness.truePeakDbfs <= -0.8,
    captions: captions.cueCount === 12 && captions.sequential && captions.nonOverlapping && captions.withinVideo,
    metadata: metadata.includes("SceneIndex | Semantic Spatial Browser | WebMCP Challenge")
      && metadata.includes("Visibility: **Public**")
      && metadata.includes("https://semantic-spatial-webmcp.swmengappdev.workers.dev/")
      && metadata.includes("https://github.com/Whyme-Labs/semantic-spatial-webmcp")
  };
  return {
    schemaVersion: 1,
    verifiedAt: new Date().toISOString(),
    video: {
      path: options.video,
      sha256: sha256(videoPath),
      bytes: Number(probe.format.size),
      durationSeconds,
      codec: video.codec_name,
      width: video.width,
      height: video.height,
      frameRate: video.avg_frame_rate,
      fastStartAtoms: atoms
    },
    audio: { ...loudness, codec: audio.codec_name, sampleRateHz: Number(audio.sample_rate), channels: audio.channels },
    captions: { path: options.captions, sha256: sha256(captionsPath), ...captions },
    metadata: { path: options.metadata, sha256: sha256(metadataPath) },
    checks,
    failures: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name),
    result: Object.values(checks).every(Boolean) ? "passed" : "failed"
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node scripts/verify-youtube-upload.mjs [options]\n");
    return;
  }
  const receipt = verify(options);
  writeFileSync(resolve(ROOT, options.output), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.result !== "passed") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { atomOffsets, parseEbur128, parseSrt, verify };
