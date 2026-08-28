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
const BRAND_TRANSITION_SECONDS = 0.22;
const DEFAULTS = Object.freeze({
  source: "submission/video/chrome-replay-silent.mp4",
  narration: "submission/video/narration/demo-narration.wav",
  narrationReceipt: "docs/demo-narration-verification.json",
  alignmentReceipt: "docs/demo-narration-alignment.json",
  audioQualityReceipt: "docs/demo-audio-quality.json",
  captureReceipt: "submission/video/chrome-replay-receipt.json",
  timelineFrame: "submission/video/chrome-replay-timeline.png",
  contextComparison: "submission/screenshots/context-comparison.png",
  contactSheet: "submission/screenshots/demo-dynamic-contact-sheet.png",
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
    proof: "crop=640:360:1280:200",
    timelineTools: "crop=1280:720:64:360",
    timelineResults: "crop=1280:720:576:360",
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
  if (shot.call) {
    const callFontSize = shot.call.tool.length > 30 ? 24 : 33;
    filters.push(
      "drawbox=x=1170:y=48:w=704:h=144:color=0x0D4D57@0.38:t=8",
      "drawbox=x=1180:y=58:w=684:h=124:color=0x111418@0.92:t=fill",
      "drawbox=x=1180:y=58:w=684:h=124:color=0x37D4C6@0.9:t=2",
      "drawbox=x=1208:y=82:w=12:h=12:color=0x37D4C6@0.96:t=fill:enable='lt(mod(t,1),0.58)'",
      `drawtext=fontfile='${FONT}':text='LIVE AGENT CALL':x=1234:y=75:fontsize=20:fontcolor=0x8A8F98`,
      `drawtext=fontfile='${FONT}':text='${escapeDrawtext(shot.call.tool)}':x=1208:y=111:fontsize=${callFontSize}:fontcolor=0xFAFBFC`,
      `drawtext=fontfile='${FONT}':text='${escapeDrawtext(shot.call.result)}':x=1209:y=151:fontsize=20:fontcolor=0x37D4C6`
    );
  }
  if (shot.title) {
    filters.push(
      "drawbox=x=0:y=816:w=1120:h=204:color=0x111418@0.94:t=fill",
      "drawbox=x=0:y=816:w=1120:h=4:color=0x0D4D57@0.95:t=fill",
      `drawtext=fontfile='${FONT}':text='${escapeDrawtext(shot.title)}':x=92:y=856:fontsize=48:fontcolor=0xFAFBFC`,
      `drawtext=fontfile='${FONT}':text='${escapeDrawtext(shot.subtitle)}':x=94:y=923:fontsize=27:fontcolor=0xF2F4F6`,
      `drawtext=fontfile='${FONT}':text='${String(shot.beat).padStart(2, "0")} / 12':x=1740:y=955:fontsize=22:fontcolor=0x8A8F98`
    );
  }
  if (index === 0) filters.push("fade=t=in:st=0:d=0.55");
  else if (shot.transitionInSeconds) {
    filters.push(`fade=t=in:st=0:d=${shot.transitionInSeconds.toFixed(3)}:color=0x111418`);
  }
  if (shot.transitionOutSeconds) {
    filters.push(`fade=t=out:st=${Math.max(0, duration - shot.transitionOutSeconds).toFixed(3)}:d=${shot.transitionOutSeconds.toFixed(3)}:color=0x111418`);
  }
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
    { sources: [109.4, 0], modes: ["viewer", "header"], title: "ONE CLOSED LIFT", subtitle: "can break the route", calls: [{ tool: "set_entity_state", result: "lift_1 = closed" }, null] },
    { sources: [9.5, 23.8], modes: ["full", "viewer"], title: "THE PLACE, INDEXED", subtitle: "appearance plus persistent meaning", calls: [{ tool: "get_scene_context", result: "shared scene state returned" }, null] },
    { sources: [44.4, 57.1], modes: ["right", "viewer"], title: "THE MISSION", subtitle: "Entrance A to Platform 2, without stairs", calls: [{ tool: "get_scene_context", result: "live camera and entities" }, { tool: "navigate_to_entity", result: "accessible_gate_1" }] },
    { sources: [71.4, 87.2], modes: ["viewer", "right"], title: "THE BASELINE", subtitle: "the first route uses Lift 1", calls: [{ tool: "find_semantic_route", result: "accessible route uses lift_1" }, null] },
    { sources: [99.9, 111.0], modes: ["right", "viewer"], title: "LIFT 1 CLOSED", subtitle: "the original route is now invalid", calls: [{ tool: "set_entity_state", result: "operational = closed" }, { tool: "find_semantic_route", result: "baseline route invalid" }] },
    { sources: [123.7, 139.5], modes: ["viewer", "right"], title: "THE ALTERNATE", subtitle: "Lift 2 keeps the trip possible", calls: [{ tool: "find_semantic_route", result: "reroute uses lift_2" }, { tool: "get_region_quality", result: "warning = west_corridor" }] },
    { sources: [155.4, 171.3], modes: ["proof", "viewer"], title: "EVIDENCE: 56 PERCENT", subtitle: "known connection, unreadable sign", calls: [{ tool: "get_region_quality", result: "readiness = 56 percent" }, null] },
    { sources: [183.9, 198.2], modes: ["evidence", "viewer"], title: "RECAPTURE THE GAP", subtitle: "two concrete field positions", calls: [{ tool: "get_region_quality", result: "2 recaptures · 6 markers" }, null] },
    { sources: [214.1, 225.2], modes: ["right", "full"], title: "HUMAN CONTROL", subtitle: "inspect, challenge, undo", calls: [{ tool: "undo_scene_change", result: "lift_1 = open" }, null] },
    { image: true, asset: "timeline", modes: ["timelineTools", "timelineResults"], title: "10 WEBMCP CALLS", subtitle: "one shared scene and one visible timeline", calls: [{ tool: "get_scene_context", result: "camera · entity · scene" }, { tool: "set_entity_state + find_semantic_route", result: "change · validate · reroute" }] },
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
        call: template[beatIndex].calls?.[half] ?? null,
        title: half === 0 ? template[beatIndex].title : null,
        subtitle: half === 0 ? template[beatIndex].subtitle : null
      });
    }
  }
  for (let beatIndex = 1; beatIndex < alignment.beats.length; beatIndex += 1) {
    const gapSeconds = alignment.beats[beatIndex].speechStartSeconds - alignment.beats[beatIndex - 1].speechEndSeconds;
    const transitionSeconds = Math.max(0.08, Math.min(BRAND_TRANSITION_SECONDS, gapSeconds / 2 - 0.03));
    shots[beatIndex * 2 - 1].transitionOutSeconds = transitionSeconds;
    shots[beatIndex * 2].transitionInSeconds = transitionSeconds;
  }
  return shots;
}

function buildAudioFilter(cueTimes) {
  const ticks = cueTimes.map((seconds, index) => {
    const frequency = index % 2 === 0 ? 880 : 1120;
    const delay = Math.max(0, Math.round(seconds * 1000));
    return `sine=frequency=${frequency}:sample_rate=48000:duration=0.055,afade=t=out:st=0.005:d=0.05,volume=0.035,adelay=${delay}|${delay}[tick${index}]`;
  });
  const inputs = cueTimes.map((_seconds, index) => `[tick${index}]`).join("");
  return [
    "[1:a]volume=1[voice]",
    ...ticks,
    `[voice]${inputs}amix=inputs=${cueTimes.length + 1}:normalize=0:dropout_transition=0,alimiter=limit=0.95[mixed]`
  ].join(";");
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
  const sfxCueTimes = shots.filter((shot) => shot.title && shot.call).map((shot) => shot.start + 0.12);
  run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", "-i", videoOnly, "-i", resolve(ROOT, options.narration),
    "-filter_complex", buildAudioFilter(sfxCueTimes),
    "-map", "0:v:0", "-map", "[mixed]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-t", String(alignment.audio.durationSeconds), "-movflags", "+faststart", resolve(ROOT, options.output)
  ]);
  const contactInputs = shots.flatMap((shot, index) => [
    "-ss", String(Math.max(0.1, shot.duration / 2)), "-i", shotPaths[index]
  ]);
  const scaledFrames = shots.map((_shot, index) => `[${index}:v]scale=480:270[v${index}]`).join(";");
  const layout = shots.map((_shot, index) => `${(index % 4) * 488}_${Math.floor(index / 4) * 278}`).join("|");
  const stackedFrames = shots.map((_shot, index) => `[v${index}]`).join("");
  run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", ...contactInputs,
    "-filter_complex", `${scaledFrames};${stackedFrames}xstack=inputs=${shots.length}:layout=${layout}:fill=0x111418,pad=1960:1676:8:8:color=0x111418[sheet]`,
    "-map", "[sheet]", "-frames:v", "1", resolve(ROOT, options.contactSheet)
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
      format: "story-driven edit with paced hard cuts, brand-color beat fades, live tool callouts, and continuous pan and zoom reframing",
      shotCount: shots.length,
      hardCutCount: alignment.beats.length,
      brandFadeTransitionCount: alignment.beats.length - 1,
      maximumBrandFadeSeconds: BRAND_TRANSITION_SECONDS,
      liveToolCalloutCount: shots.filter((shot) => shot.call).length,
      synthesizedUiCueCount: sfxCueTimes.length,
      music: false,
      contactSheet: { path: options.contactSheet, sha256: sha256File(options.contactSheet) },
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

export { beatBoundaries, buildAudioFilter, buildFilter, makeShots, parseArgs };
