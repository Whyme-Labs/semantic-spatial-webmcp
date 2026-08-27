#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verifyDemoVideo } from "./verify-demo-video.mjs";

const DEFAULTS = Object.freeze({
  capture: "submission/video/chrome-replay-silent.mp4",
  captureReceipt: "submission/video/chrome-replay-receipt.json",
  timelineFrame: "submission/video/chrome-replay-timeline.png",
  outroFrame: "submission/video/chrome-replay-outro.png",
  narration: "submission/video/narration/demo-narration.wav",
  narrationReceipt: "docs/demo-narration-verification.json",
  alignmentReceipt: "docs/demo-narration-alignment.json",
  output: "submission/video/semantic-spatial-webmcp-demo.mp4",
  receipt: "docs/demo-video-verification.json"
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  const allowed = new Set([
    "--capture", "--capture-receipt", "--timeline-frame", "--outro-frame", "--narration", "--narration-receipt",
    "--alignment-receipt", "--output", "--receipt"
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (!allowed.has(argument)) throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    const key = argument.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    options[key] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return [
    "Usage: node scripts/assemble-demo-video.mjs [options]",
    "",
    "  --capture <path>             Silent Chrome replay MP4",
    "  --capture-receipt <path>     Chrome replay JSON receipt",
    "  --timeline-frame <path>      Verified timeline viewport PNG",
    "  --outro-frame <path>         Public repository viewport PNG",
    "  --narration <path>           Timed narration WAV",
    "  --narration-receipt <path>   VoxCPM2 generation receipt",
    "  --alignment-receipt <path>   Exact-transcript alignment receipt",
    "  --output <path>              Final narrated MP4",
    "  --receipt <path>             Final exact-file verification receipt",
    "  --help                       Show this help"
  ].join("\n");
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
}

export function validateSources(capture, narration, alignment) {
  assert(capture.result === "passed", "Chrome replay receipt did not pass.");
  assert(capture.artifact?.dirty === false, "Chrome replay did not use a clean deployed artifact.");
  assert(capture.webmcp?.toolCount === 10, "Chrome replay did not expose ten WebMCP tools.");
  assert(capture.flow?.timeline?.entryCount === 10, "Chrome replay did not execute ten calls.");
  assert(capture.flow?.timeline?.allSourceLabelledAgent === true, "Chrome replay calls were not all agent-labelled.");
  assert(capture.flow?.timeline?.allSuccessful === true, "Chrome replay contains a failed call.");
  assert(Array.isArray(capture.console?.errors) && capture.console.errors.length === 0, "Chrome replay contains console errors.");
  assert(narration.result === "passed", "VoxCPM2 narration receipt did not pass.");
  assert(narration.output?.durationSeconds > 0 && narration.output.durationSeconds < 180, "Narration duration is invalid.");
  assert(alignment.result === "passed" && alignment.failures?.length === 0, "Narration alignment did not pass.");
  assert(alignment.segments?.length === narration.segments?.length, "Narration alignment segment count differs from generation.");
  assert(capture.videoCapture?.durationSeconds > 0, "Chrome replay duration is invalid.");
  const timeScale = narration.output.durationSeconds / capture.videoCapture.durationSeconds;
  assert(timeScale >= 0.25 && timeScale <= 4,
    `Chrome replay requires an unsafe ${timeScale.toFixed(4)}x timestamp scale.`);
  return {
    durationSeconds: narration.output.durationSeconds,
    captureDurationSeconds: capture.videoCapture.durationSeconds,
    timeScale
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const capture = readJson(options.captureReceipt);
  const narration = readJson(options.narrationReceipt);
  const alignment = readJson(options.alignmentReceipt);
  const timing = validateSources(capture, narration, alignment);
  assert(sha256File(options.narration) === narration.output.sha256, "Narration WAV SHA-256 differs from its receipt.");

  const videoFilter = [
    `[0:v]setpts=${timing.timeScale.toFixed(12)}*PTS[scaled]`,
    "[2:v]scale=1920:1080,format=yuv420p[timeline]",
    "[3:v]scale=1920:1080,format=yuv420p[outro]",
    "[scaled][timeline]overlay=enable='between(t,147,164)'[withtimeline]",
    "[withtimeline][outro]overlay=enable='gte(t,164)'[video]"
  ].join(";");
  const result = spawnSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", resolve(options.capture), "-i", resolve(options.narration),
    "-loop", "1", "-framerate", "30", "-i", resolve(options.timelineFrame),
    "-loop", "1", "-framerate", "30", "-i", resolve(options.outroFrame),
    "-filter_complex", videoFilter,
    "-map", "[video]", "-map", "1:a:0",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", "30",
    "-c:a", "aac", "-b:a", "192k", "-t", String(timing.durationSeconds),
    "-movflags", "+faststart", resolve(options.output)
  ], { encoding: "utf8" });
  if (result.error?.code === "ENOENT") throw new Error("ffmpeg is required to assemble the demo.");
  if (result.status !== 0) throw new Error(`ffmpeg assembly failed: ${(result.stderr || result.stdout).trim()}`);

  const verification = await verifyDemoVideo(options.output);
  const receipt = {
    ...verification,
    sources: {
      captureReceipt: { path: options.captureReceipt, sha256: sha256File(options.captureReceipt) },
      timelineFrame: { path: options.timelineFrame, sha256: sha256File(options.timelineFrame) },
      outroFrame: { path: options.outroFrame, sha256: sha256File(options.outroFrame) },
      narrationReceipt: { path: options.narrationReceipt, sha256: sha256File(options.narrationReceipt) },
      alignmentReceipt: { path: options.alignmentReceipt, sha256: sha256File(options.alignmentReceipt) }
    },
    assembly: {
      ...timing,
      timelineFrameIntervalSeconds: [147, 164],
      outroFrameIntervalSeconds: [164, 175]
    },
    evidence: {
      capture: {
        url: capture.url,
        artifact: capture.artifact,
        timing: capture.timing,
        webmcpToolCount: capture.webmcp.toolCount,
        flow: capture.flow,
        console: capture.console,
        videoCapture: capture.videoCapture,
        replay: capture.replay
      },
      narration: {
        reference: narration.reference,
        generator: narration.generator,
        script: narration.script,
        output: narration.output,
        alignmentMethod: alignment.method,
        alignmentMinimumMeanConfidence: alignment.minimumMeanConfidence,
        alignmentSegments: alignment.segments,
        alignmentFailures: alignment.failures
      }
    }
  };
  writeFileSync(resolve(options.receipt), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Demo assembly failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { parseArgs };
