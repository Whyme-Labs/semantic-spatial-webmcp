#!/usr/bin/env python3
"""Clean one continuous narration master without splitting or replacing speech."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIO = ROOT / "submission" / "video" / "narration" / "demo-narration.wav"
DEFAULT_ALIGNMENT = ROOT / "docs" / "demo-narration-alignment.json"
DEFAULT_RECEIPT = ROOT / "docs" / "demo-narration-verification.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def portable_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return path.name


def volume_metrics(path: Path) -> dict[str, float]:
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
        check=True,
        capture_output=True,
        text=True,
    )

    def read_metric(name: str) -> float:
        match = re.search(rf"{name}:\s*(-?\d+(?:\.\d+)?)\s*dB", result.stderr)
        if not match:
            raise ValueError(f"Could not read {name} from ffmpeg output")
        return float(match.group(1))

    return {"meanVolumeDb": read_metric("mean_volume"), "maxVolumeDb": read_metric("max_volume")}


def gap_ranges(alignment: dict, guard_seconds: float) -> list[tuple[float, float]]:
    ranges = []
    for previous, following in zip(alignment["beats"], alignment["beats"][1:]):
        start = float(previous["speechEndSeconds"]) + guard_seconds
        end = float(following["speechStartSeconds"]) - guard_seconds
        if end - start >= 0.08:
            ranges.append((start, end))
    if not ranges:
        raise ValueError("Alignment contains no safe inter-beat gaps")
    return ranges


def spectral_cleanup(
    samples: np.ndarray,
    sample_rate: int,
    ranges: list[tuple[float, float]],
    strength: float,
    minimum_gain: float,
) -> np.ndarray:
    fft_size = 2048
    hop = 512
    window = np.hanning(fft_size).astype(np.float32)
    padded_size = fft_size + math.ceil(max(0, len(samples) - fft_size) / hop) * hop
    padded = np.pad(samples, (0, padded_size - len(samples)))
    frames = np.lib.stride_tricks.sliding_window_view(padded, fft_size)[::hop].copy()
    spectra = np.fft.rfft(frames * window, axis=1)
    magnitude = np.abs(spectra)
    centers = (np.arange(len(frames)) * hop + fft_size / 2) / sample_rate

    profiles = []
    profile_times = []
    for start, end in ranges:
        selected = (centers >= start) & (centers <= end)
        if selected.any():
            profiles.append(np.percentile(magnitude[selected], 65, axis=0))
            profile_times.append((start + end) / 2)
    if not profiles:
        raise ValueError("No STFT frames fall inside the aligned noise-profile gaps")
    profiles_array = np.asarray(profiles)
    nearest = np.abs(centers[:, None] - np.asarray(profile_times)[None, :]).argmin(axis=1)
    local_noise = profiles_array[nearest]
    gain = 1 - strength * local_noise / (magnitude + 1e-9)
    gain = np.clip(gain, minimum_gain, 1)
    gain[1:] = 0.25 * gain[:-1] + 0.75 * gain[1:]
    gain[:, 1:] = 0.25 * gain[:, :-1] + 0.75 * gain[:, 1:]

    frequencies = np.fft.rfftfreq(fft_size, 1 / sample_rate)
    gain[:, (frequencies >= 320) & (frequencies <= 360)] *= 0.22
    gain[:, (frequencies >= 650) & (frequencies <= 710)] *= 0.55
    cleaned_spectra = spectra * gain
    cleaned_frames = np.fft.irfft(cleaned_spectra, n=fft_size, axis=1).real * window

    output = np.zeros(padded_size, dtype=np.float64)
    weights = np.zeros(padded_size, dtype=np.float64)
    window_squared = window.astype(np.float64) ** 2
    for index, frame in enumerate(cleaned_frames):
        start = index * hop
        output[start:start + fft_size] += frame
        weights[start:start + fft_size] += window_squared
    output /= np.maximum(weights, 1e-8)
    return output[:len(samples)].astype(np.float32)


def mute_gaps(
    samples: np.ndarray,
    sample_rate: int,
    ranges: list[tuple[float, float]],
    fade_seconds: float,
) -> np.ndarray:
    envelope = np.ones(len(samples), dtype=np.float32)
    fade_samples = max(1, round(fade_seconds * sample_rate))
    for start_seconds, end_seconds in ranges:
        start = max(0, round(start_seconds * sample_rate))
        end = min(len(samples), round(end_seconds * sample_rate))
        if end <= start:
            continue
        fade = min(fade_samples, (end - start) // 2)
        if fade:
            envelope[start:start + fade] = np.cos(np.linspace(0, np.pi / 2, fade, endpoint=False)) ** 2
            envelope[end - fade:end] = np.sin(np.linspace(0, np.pi / 2, fade, endpoint=False)) ** 2
        envelope[start + fade:end - fade] = 0
    return samples * envelope


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, default=DEFAULT_AUDIO)
    parser.add_argument("--alignment", type=Path, default=DEFAULT_ALIGNMENT)
    parser.add_argument("--receipt", type=Path, default=DEFAULT_RECEIPT)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--gap-guard", type=float, default=0.08)
    parser.add_argument("--gap-fade", type=float, default=0.04)
    parser.add_argument("--spectral-strength", type=float, default=1.15)
    parser.add_argument("--minimum-gain", type=float, default=0.14)
    args = parser.parse_args()

    audio_path = args.audio.resolve()
    output_path = args.output.resolve() if args.output else audio_path
    alignment_path = args.alignment.resolve()
    receipt_path = args.receipt.resolve()
    alignment = json.loads(alignment_path.read_text(encoding="utf-8"))
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    input_sha = sha256_file(audio_path)
    if receipt.get("cleanup", {}).get("outputSha256") == input_sha and output_path == audio_path:
        print(f"Already cleaned: {audio_path}")
        return
    if receipt.get("output", {}).get("sha256") != input_sha:
        raise ValueError("Narration input does not match the generation receipt")

    audio, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
    if audio.shape[1] != 1 or sample_rate != 48000:
        raise ValueError("Narration cleanup expects mono 48 kHz audio")
    samples = audio[:, 0]
    ranges = gap_ranges(alignment, args.gap_guard)
    cleaned = spectral_cleanup(samples, sample_rate, ranges, args.spectral_strength, args.minimum_gain)
    cleaned = mute_gaps(cleaned, sample_rate, ranges, args.gap_fade)
    peak = float(np.max(np.abs(cleaned)))
    if peak > 0.98:
        cleaned *= 0.98 / peak

    archive = audio_path.parent / "full" / f"narration-{input_sha[:12]}-pre-clean.wav"
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        shutil.copyfile(audio_path, archive)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", dir=output_path.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        sf.write(temporary, cleaned, sample_rate, subtype="PCM_24")
        temporary.replace(output_path)
    finally:
        temporary.unlink(missing_ok=True)

    output_sha = sha256_file(output_path)
    metrics = volume_metrics(output_path)
    receipt["cleanup"] = {
        "processedAt": datetime.now(timezone.utc).isoformat(),
        "mode": "single-track adaptive spectral subtraction with aligned gap envelopes",
        "inputPath": portable_path(archive),
        "inputSha256": input_sha,
        "outputSha256": output_sha,
        "alignmentSha256": sha256_file(alignment_path),
        "gapCount": len(ranges),
        "gapGuardSeconds": args.gap_guard,
        "gapFadeSeconds": args.gap_fade,
        "spectralStrength": args.spectral_strength,
        "minimumGain": args.minimum_gain,
        "notchBandsHz": [[320, 360], [650, 710]],
    }
    receipt["output"].update({
        "path": portable_path(output_path),
        "bytes": output_path.stat().st_size,
        "sha256": output_sha,
        "durationSeconds": round(len(cleaned) / sample_rate, 3),
        "sampleRateHz": sample_rate,
        "channels": 1,
        **metrics,
    })
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": receipt["output"], "cleanup": receipt["cleanup"]}, indent=2))


if __name__ == "__main__":
    main()
