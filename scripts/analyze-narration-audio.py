#!/usr/bin/env python3
"""Measure pacing gaps and persistent low vocal tones in a narration master."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parents[1]


def portable_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return path.name


def frame_rms_db(samples: np.ndarray, sample_rate: int, frame_seconds: float = 0.02) -> np.ndarray:
    frame_size = max(1, round(sample_rate * frame_seconds))
    usable = len(samples) - (len(samples) % frame_size)
    if usable == 0:
        raise ValueError("Audio is shorter than one analysis frame")
    frames = samples[:usable].reshape(-1, frame_size)
    rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms + 1e-12)


def silence_metrics(samples: np.ndarray, sample_rate: int, threshold_db: float) -> dict[str, float]:
    frame_seconds = 0.02
    quiet = frame_rms_db(samples, sample_rate, frame_seconds) < threshold_db
    longest = current = 0
    for value in quiet:
        current = current + 1 if value else 0
        longest = max(longest, current)
    return {
        "thresholdDb": threshold_db,
        "fraction": round(float(quiet.mean()), 4),
        "totalSeconds": round(float(quiet.sum() * frame_seconds), 3),
        "longestSeconds": round(float(longest * frame_seconds), 3),
    }


def hum_metrics(samples: np.ndarray, sample_rate: int, start_hz: float, end_hz: float) -> dict[str, float]:
    fft_size = 8192 if sample_rate >= 44100 else 4096
    hop = fft_size // 8
    if len(samples) < fft_size:
        raise ValueError("Audio is too short for spectral analysis")
    frames = np.lib.stride_tricks.sliding_window_view(samples, fft_size)[::hop]
    active_db = 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-12)
    frames = frames[active_db > -45]
    if len(frames) == 0:
        raise ValueError("Audio has no active speech frames")
    power = np.abs(np.fft.rfft(frames * np.hanning(fft_size), axis=1)) ** 2 + 1e-20
    frequencies = np.fft.rfftfreq(fft_size, 1 / sample_rate)
    core = (frequencies >= start_hz) & (frequencies <= end_hz)
    nearby = (
        (frequencies >= start_hz - 50)
        & (frequencies <= end_hz + 50)
        & ~((frequencies >= start_hz - 10) & (frequencies <= end_hz + 10))
    )
    core_db = 10 * np.log10(power[:, core].mean(axis=1))
    nearby_db = 10 * np.log10(np.median(power[:, nearby], axis=1))
    prominence = core_db - nearby_db
    return {
        "bandHz": [start_hz, end_hz],
        "medianProminenceDb": round(float(np.median(prominence)), 3),
        "p75ProminenceDb": round(float(np.percentile(prominence, 75)), 3),
        "framesOver8DbPercent": round(float((prominence > 8).mean() * 100), 3),
        "activeFrames": int(len(frames)),
    }


def analyze(path: Path, args: argparse.Namespace) -> dict:
    audio, sample_rate = sf.read(path, dtype="float32", always_2d=True)
    samples = audio.mean(axis=1)
    duration = len(samples) / sample_rate
    silence = silence_metrics(samples, sample_rate, args.silence_threshold_db)
    hum = hum_metrics(samples, sample_rate, args.hum_start_hz, args.hum_end_hz)
    checks = {
        "durationInRange": args.minimum_duration <= duration < args.maximum_duration,
        "silenceFraction": silence["fraction"] <= args.maximum_silence_fraction,
        "longestSilence": silence["longestSeconds"] <= args.maximum_longest_silence,
        "humProminence": hum["medianProminenceDb"] <= args.maximum_hum_prominence_db,
    }
    return {
        "schemaVersion": 1,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "audio": {
            "path": portable_path(path),
            "durationSeconds": round(duration, 3),
            "sampleRateHz": sample_rate,
            "channels": audio.shape[1],
        },
        "silence": silence,
        "persistentTone": hum,
        "limits": {
            "minimumDurationSeconds": args.minimum_duration,
            "maximumDurationSeconds": args.maximum_duration,
            "maximumSilenceFraction": args.maximum_silence_fraction,
            "maximumLongestSilenceSeconds": args.maximum_longest_silence,
            "maximumHumProminenceDb": args.maximum_hum_prominence_db,
        },
        "checks": checks,
        "failures": [name for name, passed in checks.items() if not passed],
        "result": "passed" if all(checks.values()) else "failed",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--minimum-duration", type=float, default=145)
    parser.add_argument("--maximum-duration", type=float, default=178)
    parser.add_argument("--silence-threshold-db", type=float, default=-50)
    parser.add_argument("--maximum-silence-fraction", type=float, default=0.12)
    parser.add_argument("--maximum-longest-silence", type=float, default=2.0)
    parser.add_argument("--hum-start-hz", type=float, default=330)
    parser.add_argument("--hum-end-hz", type=float, default=346)
    parser.add_argument("--maximum-hum-prominence-db", type=float, default=8.0)
    args = parser.parse_args()

    audio_path = args.audio.resolve()
    if not audio_path.is_file():
        raise FileNotFoundError(audio_path)
    report = analyze(audio_path, args)
    payload = json.dumps(report, indent=2) + "\n"
    print(payload, end="")
    if args.output:
        args.output.resolve().parent.mkdir(parents=True, exist_ok=True)
        args.output.resolve().write_text(payload, encoding="utf-8")
    if report["result"] != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
