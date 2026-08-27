#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verifyDemoVideo } from "./verify-demo-video.mjs";
import { analyzeVideo } from "./verify-media-dynamics.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FONT = "/System/Library/Fonts/HelveticaNeue.ttc";
const DEFAULTS = Object.freeze({
  source: "submission/video/chrome-replay-silent.mp4",
  narration: "submission/video/narration/demo-narration.wav",
  narrationReceipt: "docs/demo-narration-verification.json",
  alignmentReceipt: "docs/demo-narration-alignment.json",
  audioQualityReceipt: "docs/demo-audio-quality.json",
  captureReceipt: "submission/video/chrome-replay-receipt.json",
  timelineFrame: "submission/video/chrome-replay-timeline.png",
  contextComparison: "submission/screenshots/context-comparison.png",
  output: "submission/video/semantic-spatial-webmcp-demo.mp4",
  receipt: "docs/demo-video-verification.json",
  dynamicsReceipt: "docs/demo-media-dynamics.json",
  work: "submission/video/dynamic-edit"
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  const allowed = new Set(Object.keys(DEFAULTS).map((key) => `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`));
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
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

function readJson(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(resolve(ROOT, path))).digest("hex");
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  if (result.error?.code === "ENOENT") throw new Error(`${command} is required.`);
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  return result;
}

function cropFor(mode) {
  return {
    full: "crop=1920:1080:0:0",
    viewer: "crop=1280:720:40:250",
    right: "crop=960:540:960:180",
    evidence: "crop=960:540:960:480",
    timeline: "crop=1920:1080:0:0",
    header: "crop=1440:810:0:0",
    comparison: "crop=1440:810:0:45"
  }[mode];
}

function escapeDrawtext(value) {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'").replaceAll("%", "\\%");
}

function buildFilter(shot, duration, index, count) {
  const filters = [
    cropFor(shot.mode),
    "scale=2080:1170:force_original_aspect_ratio=increase",
    "crop=1920:1080:x='80+48*sin(t*0.31)':y='45+28*cos(t*0.23)'",
    "fps=30",
    "eq=contrast=1.025:saturation=1.04",
    "format=yuv420p"
  ];
  if (shot.title) {
    filters.push(
      "drawbox=x=58:y=826:w=960:h=166:color=0x111418@0.84:t=fill",
      `drawtext=fontfile='${FONT}':text='${escapeDrawtext(shot.title)}':x=92:y=856:fontsize=48:fontcolor=0xFAFBFC`,
      `drawtext=fontfile='${FONT}':text='${escapeDrawtext(shot.subtitle)}':x=94:y=923:fontsize=27:fontcolor=0xF2F4F6`,
      `drawtext=fontfile='${FONT}':text='${String(shot.beat).padStart(2, "0")} / 12':x=1740:y=955:fontsize=22:fontcolor=0x8A8F98`
    );
  }
  if (index === 0) filters.push("fade=t=in:st=0:d=0.55");
  if (index === count - 1) filters.push(`fade=t=out:st=${Math.max(0, duration - 0.7).toFixed(3)}:d=0.7`);
  return filters.join(",");
}

function beatBoundaries(alignment) {
  const beats = alignment.beats;
  const boundaries = [0];
  for (let index = 1; index < beats.length; index += 1) {
    boundaries.push((beats[index - 1].speechEndSeconds + beats[index].speechStartSeconds) / 2);
  }
  boundaries.push(alignment.audio.durationSeconds);
  return boundaries;
}

function shotTemplate() {
  return [
    { sources: [109.4, 0], modes: ["viewer", "header"], title: "ONE CLOSED LIFT", subtitle: "can break the route" },
    { sources: [9.5, 23.8], modes: ["full", "viewer"], title: "THE PLACE, INDEXED", subtitle: "appearance plus persistent meaning" },
    { sources: [44.4, 57.1], modes: ["right", "viewer"], title: "THE MISSION", subtitle: "Entrance A to Platform 2, without stairs" },
    { sources: [71.4, 87.2], modes: ["viewer", "right"], title: "THE BASELINE", subtitle: "the first route uses Lift 1" },
    { sources: [99.9, 111.0], modes: ["right", "viewer"], title: "LIFT 1 CLOSED", subtitle: "the original route is now invalid" },
    { sources: [123.7, 139.5], modes: ["viewer", "evidence"], title: "THE ALTERNATE", subtitle: "Lift 2 keeps the trip possible" },
    { sources: [155.4, 171.3], modes: ["evidence", "viewer"], title: "EVIDENCE: 56 PERCENT", subtitle: "known connection, unreadable sign" },
    { sources: [183.9, 198.2], modes: ["evidence", "viewer"], title: "RECAPTURE THE GAP", subtitle: "two concrete field positions" },
    { sources: [214.1, 225.2], modes: ["right", "full"], title: "HUMAN CONTROL", subtitle: "inspect, challenge, undo" },
    { image: true, asset: "timeline", modes: ["timeline", "timeline"], title: "10 WEBMCP CALLS", subtitle: "one shared scene and one visible timeline" },
    { image: true, asset: "comparison", modes: ["comparison", "comparison"], title: "FROM FIXTURE TO FIELDWORK", subtitle: "make uncertainty actionable" },
    { sources: [0, 9.5], modes: ["header", "full"], title: "SCENEINDEX", subtitle: "Search the place. See the reason." }
  ];
}

function makeShots(alignment) {
  const boundaries = beatBoundaries(alignment);
  const template = shotTemplate();
  assert(template.length === alignment.beats.length, "Edit template and narration beat count differ.");
  const shots = [];
  for (let beatIndex = 0; beatIndex < template.length; beatIndex += 1) {
    const start = boundaries[beatIndex];
    const end = boundaries[beatIndex + 1];
    const middle = (start + end) / 2;
    for (let half = 0; half < 2; half += 1) {
      const shotStart = half === 0 ? start : middle;
      const shotEnd = half === 0 ? middle : end;
      shots.push({
        beat: beatIndex + 1,
        beatId: alignment.beats[beatIndex].id,
        start: Number(shotStart.toFixed(3)),
        end: Number(shotEnd.toFixed(3)),
        duration: Number((shotEnd - shotStart).toFixed(3)),
        sourceStart: template[beatIndex].sources?.[half] ?? null,
        image: template[beatIndex].image === true,
        asset: template[beatIndex].asset ?? null,
        mode: template[beatIndex].modes[half],
        title: half === 0 ? template[beatIndex].title : null,
        subtitle: half === 0 ? template[beatIndex].subtitle : null
      });
    }
  }
  return shots;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node scripts/build-dynamic-demo-video.mjs [options]\n");
    return;
  }
  const narration = readJson(options.narrationReceipt);
  const alignment = readJson(options.alignmentReceipt);
  const audioQuality = readJson(options.audioQualityReceipt);
  const capture = readJson(options.captureReceipt);
  assert(narration.result === "passed" && narration.generator?.mode === "single-pass", "Narration is not a passing single-pass render.");
  assert(alignment.result === "passed" && alignment.singleContinuousTrack === true, "Full-track alignment did not pass.");
  assert(audioQuality.result === "passed", "Audio pacing or hum verification did not pass.");
  assert(capture.result === "passed" && capture.webmcp?.toolCount === 10, "Public WebMCP capture receipt did not pass.");
  assert(sha256File(options.narration) === narration.output.sha256, "Narration WAV differs from its receipt.");

  const shots = makeShots(alignment);
  assert(shots.length === 24, "Dynamic edit must contain 24 shots.");
  assert(shots.every((shot) => shot.duration > 3 && shot.duration < 9), "Shot durations must stay between 3 and 9 seconds.");
  const work = resolve(ROOT, options.work);
  assert(work.startsWith(resolve(ROOT, "submission/video/")), "Refusing to use a work directory outside submission/video.");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  const shotPaths = [];
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const output = resolve(work, `shot-${String(index + 1).padStart(2, "0")}.mp4`);
    const sourceDuration = Math.min(shot.duration, 7.5);
    const imagePath = shot.asset === "timeline" ? options.timelineFrame : options.contextComparison;
    const inputArgs = shot.image
      ? ["-loop", "1", "-framerate", "30", "-t", String(shot.duration), "-i", resolve(ROOT, imagePath)]
      : ["-ss", String(shot.sourceStart), "-t", String(sourceDuration), "-i", resolve(ROOT, options.source)];
    const timing = shot.image || Math.abs(sourceDuration - shot.duration) < 0.01
      ? "setpts=PTS-STARTPTS"
      : `setpts=${(shot.duration / sourceDuration).toFixed(9)}*PTS`;
    run("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error", ...inputArgs,
      "-vf", `${timing},${buildFilter(shot, shot.duration, index, shots.length)}`,
      "-t", String(shot.duration), "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18",
      "-r", "30", "-pix_fmt", "yuv420p", output
    ]);
    shotPaths.push(output);
    process.stdout.write(`Shot ${index + 1}/${shots.length} · ${shot.beatId} · ${shot.duration.toFixed(2)}s\n`);
  }

  const concatList = resolve(work, "concat.txt");
  writeFileSync(concatList, `${shotPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n")}\n`);
  const videoOnly = resolve(work, "video-only.mp4");
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", videoOnly]);
  run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", "-i", videoOnly, "-i", resolve(ROOT, options.narration),
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-t", String(alignment.audio.durationSeconds), "-movflags", "+faststart", resolve(ROOT, options.output)
  ]);

  const verification = await verifyDemoVideo(options.output);
  const dynamics = analyzeVideo(options.output, {
    sceneThreshold: 0.12,
    minimumSceneCuts: 8,
    freezeNoise: 0.001,
    freezeDuration: 2,
    maximumFreezeSeconds: 8
  });
  writeFileSync(resolve(ROOT, options.dynamicsReceipt), `${JSON.stringify(dynamics, null, 2)}\n`);
  assert(dynamics.result === "passed", `Dynamic edit failed: ${dynamics.failures.join(", ")}`);
  const beatCutMargins = shots
    .filter((_shot, index) => index > 0 && index % 2 === 0)
    .map((shot, index) => ({
      cutSeconds: shot.start,
      afterPreviousSpeechSeconds: Number((shot.start - alignment.beats[index].speechEndSeconds).toFixed(3)),
      beforeNextSpeechSeconds: Number((alignment.beats[index + 1].speechStartSeconds - shot.start).toFixed(3))
    }));
  const minimumCutMargin = Math.min(
    ...beatCutMargins.flatMap((margin) => [margin.afterPreviousSpeechSeconds, margin.beforeNextSpeechSeconds])
  );
  assert(minimumCutMargin > 0, "A story-beat cut overlaps spoken narration.");
  const receipt = {
    ...verification,
    sources: {
      sourceVideo: { path: options.source, sha256: sha256File(options.source) },
      captureReceipt: { path: options.captureReceipt, sha256: sha256File(options.captureReceipt) },
      narrationReceipt: { path: options.narrationReceipt, sha256: sha256File(options.narrationReceipt) },
      alignmentReceipt: { path: options.alignmentReceipt, sha256: sha256File(options.alignmentReceipt) },
      audioQualityReceipt: { path: options.audioQualityReceipt, sha256: sha256File(options.audioQualityReceipt) },
      timelineFrame: { path: options.timelineFrame, sha256: sha256File(options.timelineFrame) },
      contextComparison: { path: options.contextComparison, sha256: sha256File(options.contextComparison) }
    },
    evidence: {
      capture: {
        url: capture.url,
        artifact: capture.artifact,
        webmcpToolCount: capture.webmcp.toolCount,
        timeline: capture.flow.timeline,
        console: capture.console
      },
      narration: {
        generationMode: narration.generator.mode,
        generator: narration.generator,
        output: narration.output,
        audioQuality,
        alignmentMethod: alignment.method,
        beats: alignment.beats,
        failures: alignment.failures
      }
    },
    edit: {
      format: "story-driven hard-cut edit with continuous pan and zoom reframing",
      shotCount: shots.length,
      hardCutCount: shots.length - 1,
      maximumPlannedShotSeconds: Math.max(...shots.map((shot) => shot.duration)),
      minimumCutToSpeechMarginSeconds: minimumCutMargin,
      beatCutMargins,
      shots,
      dynamics
    }
  };
  writeFileSync(resolve(ROOT, options.receipt), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ result: receipt.result, artifact: receipt.artifact, durationSeconds: receipt.durationSeconds, edit: receipt.edit }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Dynamic demo build failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { beatBoundaries, makeShots, parseArgs };
