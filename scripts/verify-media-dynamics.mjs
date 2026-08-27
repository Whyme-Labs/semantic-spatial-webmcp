#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const options = {
    video: null,
    output: null,
    sceneThreshold: 0.12,
    minimumSceneCuts: 8,
    freezeNoise: 0.001,
    freezeDuration: 2,
    maximumFreezeSeconds: 8
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    const key = {
      "--video": "video",
      "--output": "output",
      "--scene-threshold": "sceneThreshold",
      "--minimum-scene-cuts": "minimumSceneCuts",
      "--freeze-noise": "freezeNoise",
      "--freeze-duration": "freezeDuration",
      "--maximum-freeze": "maximumFreezeSeconds"
    }[argument];
    if (!key) throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    options[key] = ["video", "output"].includes(key) ? value : Number(value);
    index += 1;
  }
  return options;
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") throw new Error("ffmpeg is required for media dynamics verification.");
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim());
  return `${result.stdout}${result.stderr}`;
}

function analyzeVideo(video, options) {
  const sceneOutput = runFfmpeg([
    "-hide_banner", "-i", resolve(video),
    "-vf", `select='gt(scene,${options.sceneThreshold})',metadata=print`,
    "-an", "-f", "null", "-"
  ]);
  const sceneCuts = [...sceneOutput.matchAll(/pts_time:([\d.]+)/g)].map((match) => Number(match[1]));

  const freezeOutput = runFfmpeg([
    "-hide_banner", "-i", resolve(video),
    "-vf", `freezedetect=n=${options.freezeNoise}:d=${options.freezeDuration},metadata=print`,
    "-an", "-f", "null", "-"
  ]);
  const freezeDurations = [...freezeOutput.matchAll(/lavfi\.freezedetect\.freeze_duration=([\d.]+)/g)]
    .map((match) => Number(match[1]));
  const maximumFreeze = freezeDurations.length ? Math.max(...freezeDurations) : 0;
  const checks = {
    sceneCuts: sceneCuts.length >= options.minimumSceneCuts,
    maximumFreeze: maximumFreeze <= options.maximumFreezeSeconds
  };
  return {
    schemaVersion: 1,
    video,
    sceneDetection: {
      threshold: options.sceneThreshold,
      cutCount: sceneCuts.length,
      cutsSeconds: sceneCuts
    },
    freezeDetection: {
      noise: options.freezeNoise,
      minimumDurationSeconds: options.freezeDuration,
      eventCount: freezeDurations.length,
      durationsSeconds: freezeDurations,
      maximumDurationSeconds: maximumFreeze
    },
    limits: {
      minimumSceneCuts: options.minimumSceneCuts,
      maximumFreezeSeconds: options.maximumFreezeSeconds
    },
    checks,
    failures: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name),
    result: Object.values(checks).every(Boolean) ? "passed" : "failed"
  };
}

function usage() {
  return "Usage: node scripts/verify-media-dynamics.mjs --video <path> [--output <path>]";
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!options.video) throw new Error("--video is required.");
  const report = analyzeVideo(options.video, options);
  const payload = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(payload);
  if (options.output) writeFileSync(resolve(options.output), payload);
  if (report.result !== "passed") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

export { analyzeVideo, parseArgs };
