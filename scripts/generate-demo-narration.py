#!/usr/bin/env python3
"""Generate one continuous VoxCPM2 narration from an authorized voice sample."""

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
LONG_FORM_PATCH = ROOT / "patches" / "voxcpm2-long-form-graph.patch"
WORD_RE = re.compile(r"[a-z]+(?:'[a-z]+)?", re.IGNORECASE)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        captured = result.stdout + result.stderr
        lines = captured.strip().splitlines()
        detail = "\n".join([*lines[:80], "...", *lines[-80:]])
        raise RuntimeError(f"Command failed with exit code {result.returncode}:\n{detail}")
    return result


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


def preprocess_reference(source: Path, target: Path, start: float, duration: float) -> str:
    target.parent.mkdir(parents=True, exist_ok=True)
    filters = (
        "highpass=f=90,"
        "afftdn=nr=14:nf=-38:tn=1:gs=8,"
        "lowpass=f=7800,"
        "loudnorm=I=-22:TP=-4:LRA=9"
    )
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", str(start), "-t", str(duration), "-i", str(source),
        "-ac", "1", "-ar", "16000", "-af", filters,
        "-c:a", "pcm_s16le", str(target),
    ])
    return filters


def trim_generated(source: Path, target: Path) -> str:
    filters = (
        "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-50dB,"
        "areverse,"
        "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB,"
        "areverse"
    )
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(source),
        "-af", filters, "-ac", "1", "-ar", "48000", "-c:a", "pcm_s24le", str(target),
    ])
    return filters


def master_generated(source: Path, target: Path, tempo: float) -> str:
    filters = []
    if abs(tempo - 1) > 1e-6:
        filters.append(f"atempo={tempo:.8f}")
    filters.extend([
        "highpass=f=90",
        "afftdn=nr=12:nf=-42:tn=1:gs=8",
        "equalizer=f=338:t=q:w=10:g=-15",
        "loudnorm=I=-16:TP=-1.5:LRA=9",
        "afade=t=in:st=0:d=0.04",
        "adelay=250",
        "apad=pad_dur=0.55",
    ])
    chain = ",".join(filters)
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(source),
        "-af", chain, "-ac", "1", "-ar", "48000", "-c:a", "pcm_s24le", str(target),
    ])
    return chain


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
    parser.add_argument("--max-decode-steps", type=int, default=1400)
    parser.add_argument("--cfg-value", type=float, default=2.0)
    parser.add_argument("--temperature", type=float, default=0.75)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--reference-start", type=float, default=0.0)
    parser.add_argument("--reference-duration", type=float, default=20.0)
    parser.add_argument("--minimum-tempo", type=float, default=0.86)
    parser.add_argument("--maximum-speedup", type=float, default=1.08)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    reference_source = args.reference_audio.resolve()
    if not reference_source.is_file():
        raise FileNotFoundError(reference_source)
    script_path = args.script.resolve()
    script = json.loads(script_path.read_text(encoding="utf-8"))
    if script.get("schemaVersion") != 2 or not script.get("beats"):
        raise ValueError("Narration script must use schemaVersion 2 and contain beats")
    minimum_duration = float(script["minimumDurationSeconds"])
    maximum_duration = float(script["maximumDurationSeconds"])
    full_text = "\n\n".join(beat["text"].strip() for beat in script["beats"])
    word_count = len(WORD_RE.findall(full_text))

    source_hash = sha256_file(reference_source)
    attestation = json.loads(args.attestation.resolve().read_text(encoding="utf-8"))
    authorized_hash = attestation.get("voiceReference", {}).get("sourceSha256")
    if source_hash != authorized_hash:
        raise ValueError(
            f"Voice reference SHA-256 {source_hash} does not match the owner-authorized sample {authorized_hash}"
        )

    output_dir = args.output_dir.resolve()
    full_dir = output_dir / "full"
    full_dir.mkdir(parents=True, exist_ok=True)
    reference_wav = full_dir / "reference-clean-16k.wav"
    reference_filter = preprocess_reference(
        reference_source, reference_wav, args.reference_start, args.reference_duration
    )

    gguf_root = args.gguf_root.resolve()
    gguf_cli = gguf_root / "llama.cpp-omni" / "build" / "bin" / "voxcpm2-cli"
    gguf_base = gguf_root / "models" / "VoxCPM2-BaseLM-Q8_0.gguf"
    gguf_acoustic = gguf_root / "models" / "VoxCPM2-Acoustic-F16.gguf"
    gguf_ready = all(path.is_file() for path in [gguf_cli, gguf_base, gguf_acoustic])
    backend = "gguf" if args.backend == "auto" and gguf_ready else args.backend
    if backend == "auto":
        backend = "pytorch"
    if backend == "gguf" and not gguf_ready:
        missing = [str(path) for path in [gguf_cli, gguf_base, gguf_acoustic] if not path.is_file()]
        raise FileNotFoundError(f"Missing GGUF runtime artifact(s): {', '.join(missing)}")

    generation_config = {
        "mode": "single-pass",
        "backend": backend,
        "model": MODEL_ID,
        "revision": GGUF_MODEL_REVISION if backend == "gguf" else PYTORCH_MODEL_REVISION,
        "inferenceTimesteps": args.steps,
        "maxDecodeSteps": args.max_decode_steps if backend == "gguf" else None,
        "cfgValue": args.cfg_value,
        "temperature": args.temperature if backend == "gguf" else None,
        "seed": args.seed,
        "voiceControl": script["voiceControl"],
        "referenceSha256": sha256_file(reference_wav),
    }
    fingerprint = hashlib.sha256(
        json.dumps({**generation_config, "text": full_text}, sort_keys=True).encode("utf-8")
    ).hexdigest()[:12]
    raw_path = full_dir / f"narration-{fingerprint}-raw.wav"
    trimmed_path = full_dir / f"narration-{fingerprint}-trimmed.wav"
    final_output = output_dir / "demo-narration.wav"
    prompted_text = f"({script['voiceControl']}){full_text}"

    if args.force or not raw_path.exists():
        print(f"Generate one continuous track · {word_count} words · backend={backend}", flush=True)
        if backend == "gguf":
            result = run([
                str(gguf_cli), "-t", prompted_text, "-o", str(raw_path), "-r", str(reference_wav),
                "--steps", str(args.max_decode_steps), "--timesteps", str(args.steps),
                "--cfg", str(args.cfg_value), "--temperature", str(args.temperature),
                "--seed", str(args.seed), str(gguf_base), str(gguf_acoustic),
            ])
            summary = " ".join((result.stdout + result.stderr).strip().splitlines()[-3:])
            if summary:
                print(f"GGUF · {summary}", flush=True)
        else:
            import torch
            from voxcpm import VoxCPM

            model_snapshot = (
                Path.home() / ".cache" / "huggingface" / "hub" / "models--openbmb--VoxCPM2"
                / "snapshots" / PYTORCH_MODEL_REVISION
            )
            if not model_snapshot.is_dir():
                raise FileNotFoundError(f"Missing pinned VoxCPM2 snapshot {model_snapshot}")
            model = VoxCPM.from_pretrained(
                str(model_snapshot), load_denoiser=False, optimize=False, device=args.device
            )
            np.random.seed(args.seed)
            torch.manual_seed(args.seed)
            wav = model.generate(
                text=prompted_text,
                reference_wav_path=str(reference_wav),
                cfg_value=args.cfg_value,
                inference_timesteps=args.steps,
            )
            sf.write(raw_path, np.asarray(wav, dtype=np.float32), model.tts_model.sample_rate)
    else:
        print(f"Reuse continuous track · {raw_path.name}", flush=True)

    trim_filter = trim_generated(raw_path, trimmed_path)
    raw_duration = probe_duration(raw_path)
    trimmed_duration = probe_duration(trimmed_path)
    target_duration = min(max(trimmed_duration, minimum_duration + 1.0), maximum_duration - 1.0)
    tempo = trimmed_duration / target_duration
    if tempo < args.minimum_tempo:
        raise ValueError(
            f"Continuous narration needs {tempo:.3f}x tempo; minimum is {args.minimum_tempo:.3f}x"
        )
    if tempo > args.maximum_speedup:
        raise ValueError(
            f"Continuous narration needs {tempo:.3f}x speedup; maximum is {args.maximum_speedup:.3f}x"
        )
    mastering_filter = master_generated(trimmed_path, final_output, tempo)
    final_duration = probe_duration(final_output)
    if not minimum_duration <= final_duration < maximum_duration:
        raise ValueError(
            f"Final narration is {final_duration:.3f}s, expected {minimum_duration:.3f}s to under {maximum_duration:.3f}s"
        )
    metrics = volume_metrics(final_output)
    if metrics["maxVolumeDb"] <= -12:
        raise ValueError(f"Final narration peak is unexpectedly low: {metrics['maxVolumeDb']} dB")

    receipt = {
        "schemaVersion": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "authorization": "Owner-authorized voice reference; source audio is not stored in the repository",
        "reference": {
            "sourceFilename": reference_source.name,
            "sourceSha256": source_hash,
            "cleanReferencePath": portable_path(reference_wav),
            "cleanReferenceSha256": sha256_file(reference_wav),
            "cleanReferenceDurationSeconds": round(probe_duration(reference_wav), 3),
            "filter": reference_filter,
        },
        "generator": {
            **generation_config,
            "package": "llama.cpp-omni" if backend == "gguf" else "voxcpm",
            "packageVersion": GGUF_ENGINE_COMMIT if backend == "gguf" else importlib.metadata.version("voxcpm"),
            "binarySha256": sha256_file(gguf_cli) if backend == "gguf" else None,
            "longFormGraphPatch": portable_path(LONG_FORM_PATCH) if backend == "gguf" else None,
            "longFormGraphPatchSha256": sha256_file(LONG_FORM_PATCH) if backend == "gguf" else None,
            "conversionModel": GGUF_MODEL_ID if backend == "gguf" else None,
            "baseModelSha256": sha256_file(gguf_base) if backend == "gguf" else None,
            "acousticModelSha256": sha256_file(gguf_acoustic) if backend == "gguf" else None,
            "device": "metal" if backend == "gguf" else args.device,
        },
        "script": {
            "path": portable_path(script_path),
            "sha256": sha256_file(script_path),
            "wordCount": word_count,
            "beatCount": len(script["beats"]),
            "minimumDurationSeconds": minimum_duration,
            "maximumDurationSeconds": maximum_duration,
        },
        "generation": {
            "rawPath": portable_path(raw_path),
            "rawSha256": sha256_file(raw_path),
            "rawDurationSeconds": round(raw_duration, 3),
            "trimmedPath": portable_path(trimmed_path),
            "trimmedSha256": sha256_file(trimmed_path),
            "trimmedDurationSeconds": round(trimmed_duration, 3),
            "trimFilter": trim_filter,
            "tempo": round(tempo, 6),
            "masteringFilter": mastering_filter,
        },
        "beats": [{"id": beat["id"], "text": beat["text"]} for beat in script["beats"]],
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
