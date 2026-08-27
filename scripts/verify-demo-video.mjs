#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, statSync, writeFileSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULTS = Object.freeze({
  maxDurationSeconds: 180,
  minWidth: 1920,
  minHeight: 1080,
  minAudioPeakDb: -60
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parsePositiveNumber(value, source) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${source} must be a positive number.`);
  return parsed;
}

function parseArgs(argv) {
  const options = {
    video: null,
    output: null,
    maxDurationSeconds: DEFAULTS.maxDurationSeconds,
    minWidth: DEFAULTS.minWidth,
    minHeight: DEFAULTS.minHeight
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (!["--video", "--output", "--max-duration", "--min-width", "--min-height"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    if (argument === "--max-duration") options.maxDurationSeconds = parsePositiveNumber(value, argument);
    else if (argument === "--min-width") options.minWidth = parsePositiveNumber(value, argument);
    else if (argument === "--min-height") options.minHeight = parsePositiveNumber(value, argument);
    else options[argument.slice(2)] = value;
    index += 1;
  }
  if (!options.help && !options.video) throw new Error("--video is required.");
  if (options.maxDurationSeconds > DEFAULTS.maxDurationSeconds) throw new Error("--max-duration cannot weaken the 180-second competition limit.");
  if (options.minWidth < DEFAULTS.minWidth) throw new Error("--min-width cannot weaken the 1920-pixel recording requirement.");
  if (options.minHeight < DEFAULTS.minHeight) throw new Error("--min-height cannot weaken the 1080-pixel recording requirement.");
  return options;
}

function usage() {
  return [
    "Usage: node scripts/verify-demo-video.mjs --video <mp4> [options]",
    "",
    "  --output <path>          Write the JSON receipt to this path",
    "  --max-duration <secs>   Require duration below this value (default: 180)",
    "  --min-width <pixels>    Minimum displayed width (default: 1920)",
    "  --min-height <pixels>   Minimum displayed height (default: 1080)",
    "  --help                   Show this help"
  ].join("\n");
}

function parseFrameRate(value) {
  if (typeof value !== "string") return 0;
  const [numerator, denominator = "1"] = value.split("/").map(Number);
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator
    : 0;
}

function displayedDimensions(stream) {
  const sideRotation = stream.side_data_list?.find((entry) => Number.isFinite(Number(entry.rotation)))?.rotation;
  const tagRotation = stream.tags?.rotate;
  const rotation = Number(sideRotation ?? tagRotation ?? 0);
  const quarterTurn = Number.isFinite(rotation) && Math.abs(rotation % 180) === 90;
  return quarterTurn
    ? { width: Number(stream.height), height: Number(stream.width), rotation }
    : { width: Number(stream.width), height: Number(stream.height), rotation };
}

export function parseVolumeDetect(output) {
  const parse = (label) => {
    const match = output.match(new RegExp(`${label}:\\s*(-?inf|-?\\d+(?:\\.\\d+)?)\\s*dB`, "i"));
    if (!match || /inf/i.test(match[1])) return Number.NEGATIVE_INFINITY;
    return Number(match[1]);
  };
  return {
    meanVolumeDb: parse("mean_volume"),
    maxVolumeDb: parse("max_volume")
  };
}

export function analyzeProbe(probe, volume, options = {}) {
  const limits = {
    ...DEFAULTS,
    ...options,
    maxDurationSeconds: Math.min(options.maxDurationSeconds ?? DEFAULTS.maxDurationSeconds, DEFAULTS.maxDurationSeconds),
    minWidth: Math.max(options.minWidth ?? DEFAULTS.minWidth, DEFAULTS.minWidth),
    minHeight: Math.max(options.minHeight ?? DEFAULTS.minHeight, DEFAULTS.minHeight),
    minAudioPeakDb: Math.max(options.minAudioPeakDb ?? DEFAULTS.minAudioPeakDb, DEFAULTS.minAudioPeakDb)
  };
  const containerNames = String(probe?.format?.format_name ?? "").split(",");
  assert(containerNames.includes("mp4"), `Video must use an MP4 container; got ${probe?.format?.format_name ?? "missing"}.`);
  const durationSeconds = Number(probe?.format?.duration);
  assert(Number.isFinite(durationSeconds) && durationSeconds > 0, "Video duration is missing or invalid.");
  assert(durationSeconds < limits.maxDurationSeconds, `Video must be shorter than ${limits.maxDurationSeconds} seconds; got ${durationSeconds.toFixed(3)}.`);

  const videoStream = probe?.streams?.find((stream) => stream.codec_type === "video");
  assert(videoStream, "No video stream was found.");
  const dimensions = displayedDimensions(videoStream);
  assert(dimensions.width >= limits.minWidth && dimensions.height >= limits.minHeight,
    `Video must be at least ${limits.minWidth}x${limits.minHeight}; got ${dimensions.width}x${dimensions.height}.`);
  const frameRate = parseFrameRate(videoStream.avg_frame_rate);
  assert(frameRate > 0, "Video frame rate is missing or invalid.");

  const audioStream = probe?.streams?.find((stream) => stream.codec_type === "audio");
  assert(audioStream, "No audio stream was found.");
  const channels = Number(audioStream.channels);
  const sampleRateHz = Number(audioStream.sample_rate);
  assert(Number.isInteger(channels) && channels > 0, "Audio channel count is missing or invalid.");
  assert(Number.isFinite(sampleRateHz) && sampleRateHz >= 22050, `Audio sample rate must be at least 22050 Hz; got ${audioStream.sample_rate ?? "missing"}.`);
  assert(Number.isFinite(volume.maxVolumeDb) && volume.maxVolumeDb > limits.minAudioPeakDb,
    `Audio appears silent: peak ${volume.maxVolumeDb} dB does not exceed ${limits.minAudioPeakDb} dB.`);

  return {
    durationSeconds,
    underThreeMinutes: durationSeconds < 180,
    video: {
      codec: videoStream.codec_name,
      width: dimensions.width,
      height: dimensions.height,
      rotation: dimensions.rotation,
      frameRate
    },
    audio: {
      codec: audioStream.codec_name,
      channels,
      channelLayout: audioStream.channel_layout ?? null,
      sampleRateHz,
      meanVolumeDb: volume.meanVolumeDb,
      maxVolumeDb: volume.maxVolumeDb,
      nonSilent: true
    },
    container: probe.format.format_name ?? null
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error?.code === "ENOENT") throw new Error(`${command} is required but was not found on PATH.`);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "unknown error").trim().split("\n").slice(-4).join(" ");
    throw new Error(`${command} failed: ${detail}`);
  }
  return result;
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function portablePath(path) {
  const fromCwd = relative(process.cwd(), path);
  return fromCwd.startsWith("..") ? basename(path) : fromCwd;
}

export async function verifyDemoVideo(videoPath, options = {}) {
  const absoluteVideoPath = resolve(videoPath);
  assert(extname(absoluteVideoPath).toLowerCase() === ".mp4", "Video filename must use the .mp4 extension.");
  const probeResult = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,format_name:stream=index,codec_type,codec_name,width,height,avg_frame_rate,channels,sample_rate,channel_layout:stream_tags=rotate:stream_side_data=rotation",
    "-of", "json",
    absoluteVideoPath
  ]);
  const probe = JSON.parse(probeResult.stdout);
  assert(probe?.streams?.some((stream) => stream.codec_type === "audio"), "No audio stream was found.");
  const volumeResult = run("ffmpeg", [
    "-hide_banner", "-nostats", "-i", absoluteVideoPath,
    "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"
  ]);
  const media = analyzeProbe(probe, parseVolumeDetect(volumeResult.stderr), options);
  const stats = statSync(absoluteVideoPath);
  assert(stats.isFile(), "Video path must refer to a file.");

  return {
    verifiedAt: new Date().toISOString(),
    artifact: {
      path: portablePath(absoluteVideoPath),
      bytes: stats.size,
      sha256: await sha256File(absoluteVideoPath)
    },
    ...media,
    result: "passed"
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  let receipt;
  try {
    receipt = await verifyDemoVideo(options.video, options);
  } catch (error) {
    receipt = {
      verifiedAt: new Date().toISOString(),
      artifact: { path: portablePath(resolve(options.video)) },
      result: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
  const encoded = `${JSON.stringify(receipt, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(options.output), encoded);
  process.stdout.write(encoded);
  if (receipt.result !== "passed") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Demo video verification failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { parseArgs };
