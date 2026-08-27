#!/usr/bin/env python3
"""Generate a timed VoxCPM2 demo narration from an owner-authorized voice sample."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCRIPT = ROOT / "submission" / "narration-script.json"
DEFAULT_OUTPUT_DIR = ROOT / "submission" / "video" / "narration"
DEFAULT_RECEIPT = ROOT / "docs" / "demo-narration-verification.json"
DEFAULT_ATTESTATION = ROOT / "docs" / "entrant-attestation.json"
MODEL_ID = "openbmb/VoxCPM2"
PYTORCH_MODEL_REVISION = "bffb3df5a29440629464e5e839f4d214c8714c3d"
GGUF_MODEL_ID = "DennisHuang648/VoxCPM2-GGUF"
GGUF_MODEL_REVISION = "169f64d8b98bbaab1761e4ca3a83e6af653456cc"
GGUF_ENGINE_COMMIT = "64d092c60db4b4ee45768476bd752f03fdcc98ea"
DEFAULT_GGUF_ROOT = Path.home() / ".cache" / "voxcpm2-metal"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True)


def probe_duration(path: Path) -> float:
    result = run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ])
    return float(result.stdout.strip())


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


def preprocess_reference(source: Path, target: Path, start: float, duration: float) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", str(start), "-t", str(duration), "-i", str(source),
        "-ac", "1", "-ar", "16000",
        "-af", "highpass=f=80,lowpass=f=7800,loudnorm=I=-20:TP=-3:LRA=11",
        "-c:a", "pcm_s16le", str(target),
    ])


def fit_chunk(source: Path, target: Path, target_duration: float, maximum_speedup: float) -> dict[str, float]:
    raw_duration = probe_duration(source)
    speedup = raw_duration / target_duration if raw_duration > target_duration else 1.0
    if speedup > maximum_speedup:
        raise ValueError(
            f"{source.name} needs {speedup:.3f}x speedup to fit {target_duration:.3f}s; "
            f"maximum is {maximum_speedup:.3f}x"
        )
    fade_out_start = max(target_duration - 0.08, 0)
    filters = ["highpass=f=80", "lowpass=f=16000"]
    if speedup > 1.0:
        filters.append(f"atempo={speedup:.8f}")
    filters.extend([
        "apad",
        f"atrim=duration={target_duration:.6f}",
        "afade=t=in:st=0:d=0.03",
        f"afade=t=out:st={fade_out_start:.6f}:d=0.08",
    ])
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(source),
        "-af", ",".join(filters), "-ac", "1", "-ar", "48000", "-c:a", "pcm_s24le", str(target),
    ])
    return {
        "rawDurationSeconds": round(raw_duration, 3),
        "targetDurationSeconds": round(target_duration, 3),
        "speedup": round(speedup, 6),
        "fittedDurationSeconds": round(probe_duration(target), 3),
    }


def stitch(paths: list[Path], output: Path) -> None:
    parts: list[np.ndarray] = []
    sample_rate: int | None = None
    for path in paths:
        audio, rate = sf.read(path, dtype="float32", always_2d=True)
        if sample_rate is None:
            sample_rate = rate
        elif rate != sample_rate:
            raise ValueError(f"Sample-rate mismatch: {path} has {rate}, expected {sample_rate}")
        parts.append(audio.mean(axis=1))
    if not parts or sample_rate is None:
        raise ValueError("No fitted narration chunks were produced")
    sf.write(output, np.concatenate(parts), sample_rate, subtype="PCM_24")


def portable_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return path.name


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference-audio", type=Path, required=True)
    parser.add_argument("--script", type=Path, default=DEFAULT_SCRIPT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--receipt", type=Path, default=DEFAULT_RECEIPT)
    parser.add_argument("--attestation", type=Path, default=DEFAULT_ATTESTATION)
    parser.add_argument("--backend", choices=["auto", "gguf", "pytorch"], default="auto")
    parser.add_argument("--gguf-root", type=Path, default=DEFAULT_GGUF_ROOT)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--steps", type=int, default=10)
    parser.add_argument("--max-decode-steps", type=int, default=600)
    parser.add_argument("--cfg-value", type=float, default=2.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--reference-start", type=float, default=0.0)
    parser.add_argument("--reference-duration", type=float, default=20.0)
    parser.add_argument("--maximum-speedup", type=float, default=1.3)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    reference_source = args.reference_audio.resolve()
    if not reference_source.is_file():
        raise FileNotFoundError(reference_source)
    script_path = args.script.resolve()
    script = json.loads(script_path.read_text(encoding="utf-8"))
    if script.get("schemaVersion") != 1 or not script.get("segments"):
        raise ValueError("Narration script must use schemaVersion 1 and contain segments")

    output_dir = args.output_dir.resolve()
    raw_dir = output_dir / "raw"
    fitted_dir = output_dir / "fitted"
    raw_dir.mkdir(parents=True, exist_ok=True)
    fitted_dir.mkdir(parents=True, exist_ok=True)
    reference_wav = output_dir / "reference-16k.wav"
    preprocess_reference(reference_source, reference_wav, args.reference_start, args.reference_duration)

    source_hash = sha256_file(reference_source)
    attestation = json.loads(args.attestation.resolve().read_text(encoding="utf-8"))
    authorized_hash = attestation.get("voiceReference", {}).get("sourceSha256")
    if source_hash != authorized_hash:
        raise ValueError(
            f"Voice reference SHA-256 {source_hash} does not match the owner-authorized sample {authorized_hash}"
        )
    reference_hash = sha256_file(reference_wav)
    script_hash = sha256_file(script_path)
    voice_control = script["voiceControl"]
    gguf_root = args.gguf_root.resolve()
    gguf_cli = gguf_root / "llama.cpp-omni" / "build" / "bin" / "voxcpm2-cli"
    gguf_base = gguf_root / "models" / "VoxCPM2-BaseLM-Q8_0.gguf"
    gguf_acoustic = gguf_root / "models" / "VoxCPM2-Acoustic-F16.gguf"
    gguf_ready = all(path.is_file() for path in [gguf_cli, gguf_base, gguf_acoustic])
    backend = "gguf" if args.backend == "auto" and gguf_ready else args.backend
    if backend == "auto":
        backend = "pytorch"
    if backend == "gguf" and not gguf_ready:
        missing_paths = [str(path) for path in [gguf_cli, gguf_base, gguf_acoustic] if not path.is_file()]
        raise FileNotFoundError(f"Missing GGUF runtime artifact(s): {', '.join(missing_paths)}")
    generation_config = {
        "backend": backend,
        "model": MODEL_ID,
        "revision": GGUF_MODEL_REVISION if backend == "gguf" else PYTORCH_MODEL_REVISION,
        "inferenceTimesteps": args.steps,
        "maxDecodeSteps": args.max_decode_steps if backend == "gguf" else None,
        "cfgValue": args.cfg_value,
        "seed": args.seed,
        "voiceControl": voice_control,
        "referenceSha256": reference_hash,
    }

    chunk_jobs = []
    for segment in script["segments"]:
        fingerprint = hashlib.sha256(
            json.dumps({**generation_config, "text": segment["text"]}, sort_keys=True).encode("utf-8")
        ).hexdigest()[:12]
        raw_path = raw_dir / f"{segment['id']}-{fingerprint}.wav"
        fitted_path = fitted_dir / f"{segment['id']}.wav"
        chunk_jobs.append((segment, raw_path, fitted_path))

    missing = [job for job in chunk_jobs if args.force or not job[1].exists()]
    model = None
    torch_module = None
    if missing and backend == "pytorch":
        import torch as torch_module
        from voxcpm import VoxCPM

        model_snapshot = (
            Path.home()
            / ".cache"
            / "huggingface"
            / "hub"
            / "models--openbmb--VoxCPM2"
            / "snapshots"
            / PYTORCH_MODEL_REVISION
        )
        if not model_snapshot.is_dir():
            raise FileNotFoundError(
                f"Missing pinned VoxCPM2 snapshot {model_snapshot}. Download {MODEL_ID}@{PYTORCH_MODEL_REVISION} first."
            )
        print(f"Loading {MODEL_ID}@{PYTORCH_MODEL_REVISION} on {args.device}…", flush=True)
        model = VoxCPM.from_pretrained(
            str(model_snapshot),
            load_denoiser=False,
            optimize=False,
            device=args.device,
        )
        print(f"Model ready · sample_rate={model.tts_model.sample_rate}", flush=True)
    elif missing:
        print(
            f"Using Metal GGUF backend · engine={GGUF_ENGINE_COMMIT[:7]} model={GGUF_MODEL_REVISION[:7]}",
            flush=True,
        )

    fitted_paths = []
    segment_receipts = []
    for index, (segment, raw_path, fitted_path) in enumerate(chunk_jobs, start=1):
        if args.force or not raw_path.exists():
            print(f"Generate {index}/{len(chunk_jobs)} · {segment['id']}: {segment['text']}", flush=True)
            prompted_text = f"({voice_control}) {segment['text']}"
            if backend == "gguf":
                result = run([
                    str(gguf_cli),
                    "-t", prompted_text,
                    "-o", str(raw_path),
                    "-r", str(reference_wav),
                    "--steps", str(args.max_decode_steps),
                    "--timesteps", str(args.steps),
                    "--cfg", str(args.cfg_value),
                    "--seed", str(args.seed + index),
                    str(gguf_base),
                    str(gguf_acoustic),
                ])
                summary = " ".join((result.stdout + result.stderr).strip().splitlines()[-3:])
                if summary:
                    print(f"GGUF · {summary}", flush=True)
            else:
                assert model is not None and torch_module is not None
                np.random.seed(args.seed + index)
                torch_module.manual_seed(args.seed + index)
                wav = model.generate(
                    text=prompted_text,
                    reference_wav_path=str(reference_wav),
                    cfg_value=args.cfg_value,
                    inference_timesteps=args.steps,
                )
                sf.write(raw_path, np.asarray(wav, dtype=np.float32), model.tts_model.sample_rate)
        else:
            print(f"Reuse {index}/{len(chunk_jobs)} · {raw_path.name}", flush=True)

        target_duration = float(segment["end"] - segment["start"])
        timing = fit_chunk(raw_path, fitted_path, target_duration, args.maximum_speedup)
        fitted_paths.append(fitted_path)
        segment_receipts.append({
            "id": segment["id"],
            "start": segment["start"],
            "end": segment["end"],
            "text": segment["text"],
            **timing,
            "rawSha256": sha256_file(raw_path),
            "fittedSha256": sha256_file(fitted_path),
        })
        print(f"Fit {segment['id']} · raw={timing['rawDurationSeconds']}s target={target_duration}s", flush=True)

    unmastered = output_dir / "demo-narration-unmastered.wav"
    final_output = output_dir / "demo-narration.wav"
    stitch(fitted_paths, unmastered)
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(unmastered),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", "48000",
        "-c:a", "pcm_s24le", str(final_output),
    ])

    final_duration = probe_duration(final_output)
    target_duration = float(script["targetDurationSeconds"])
    if abs(final_duration - target_duration) > 0.05:
        raise ValueError(f"Final narration is {final_duration:.3f}s, expected {target_duration:.3f}s")
    metrics = volume_metrics(final_output)
    if metrics["maxVolumeDb"] <= -12:
        raise ValueError(f"Final narration peak is unexpectedly low: {metrics['maxVolumeDb']} dB")

    receipt = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "authorization": "Owner-authorized voice reference; source audio is not stored in the repository",
        "reference": {
            "sourceFilename": reference_source.name,
            "sourceSha256": source_hash,
            "derivedReferenceSha256": reference_hash,
            "derivedReferenceDurationSeconds": round(probe_duration(reference_wav), 3),
        },
        "generator": {
            "backend": backend,
            "package": "llama.cpp-omni" if backend == "gguf" else "voxcpm",
            "packageVersion": GGUF_ENGINE_COMMIT if backend == "gguf" else importlib.metadata.version("voxcpm"),
            "model": MODEL_ID,
            "modelRevision": GGUF_MODEL_REVISION if backend == "gguf" else PYTORCH_MODEL_REVISION,
            "conversionModel": GGUF_MODEL_ID if backend == "gguf" else None,
            "baseModelSha256": sha256_file(gguf_base) if backend == "gguf" else None,
            "acousticModelSha256": sha256_file(gguf_acoustic) if backend == "gguf" else None,
            "device": "metal" if backend == "gguf" else args.device,
            "cfgValue": args.cfg_value,
            "inferenceTimesteps": args.steps,
            "maxDecodeSteps": args.max_decode_steps if backend == "gguf" else None,
            "seed": args.seed,
        },
        "script": {
            "path": portable_path(script_path),
            "sha256": script_hash,
            "targetDurationSeconds": target_duration,
        },
        "segments": segment_receipts,
        "output": {
            "path": portable_path(final_output),
            "bytes": final_output.stat().st_size,
            "sha256": sha256_file(final_output),
            "durationSeconds": round(final_duration, 3),
            "sampleRateHz": sf.info(final_output).samplerate,
            "channels": sf.info(final_output).channels,
            **metrics,
        },
        "result": "passed",
    }
    args.receipt.resolve().parent.mkdir(parents=True, exist_ok=True)
    args.receipt.resolve().write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {final_output}", flush=True)
    print(f"Wrote {args.receipt.resolve()}", flush=True)


if __name__ == "__main__":
    main()
