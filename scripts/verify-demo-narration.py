#!/usr/bin/env python3
"""Force-align the exact narration script against generated VoxCPM2 audio."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import re
from pathlib import Path
from statistics import mean

import soundfile as sf
import torch
import torchaudio


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCRIPT = ROOT / "submission" / "narration-script.json"
DEFAULT_AUDIO_DIR = ROOT / "submission" / "video" / "narration" / "fitted"
DEFAULT_OUTPUT = ROOT / "docs" / "demo-narration-alignment.json"
WORD_RE = re.compile(r"[a-z]+(?:'[a-z]+)?")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def words(text: str) -> list[str]:
    normalized = text.lower().replace("\u2018", "'").replace("\u2019", "'")
    return WORD_RE.findall(normalized)


def load_waveform(path: Path, sample_rate: int) -> tuple[torch.Tensor, float]:
    samples, source_rate = sf.read(path, dtype="float32", always_2d=True)
    waveform = torch.from_numpy(samples.mean(axis=1)).unsqueeze(0)
    duration = waveform.shape[1] / source_rate
    if source_rate != sample_rate:
        waveform = torchaudio.functional.resample(waveform, source_rate, sample_rate)
    return waveform, duration


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", type=Path, default=DEFAULT_SCRIPT)
    parser.add_argument("--audio-dir", type=Path, default=DEFAULT_AUDIO_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--minimum-confidence", type=float, default=0.3)
    args = parser.parse_args()

    script_path = args.script.resolve()
    script = json.loads(script_path.read_text(encoding="utf-8"))
    bundle = torchaudio.pipelines.MMS_FA
    print(f"Loading {bundle.__class__.__name__} forced aligner on {args.device}…", flush=True)
    model = bundle.get_model(with_star=False).to(args.device).eval()
    tokenizer = bundle.get_tokenizer()
    aligner = bundle.get_aligner()

    segments = []
    failures = []
    for segment in script["segments"]:
        audio_path = args.audio_dir.resolve() / f"{segment['id']}.wav"
        if not audio_path.is_file():
            raise FileNotFoundError(audio_path)
        transcript = words(segment["text"])
        waveform, duration = load_waveform(audio_path, bundle.sample_rate)
        with torch.inference_mode():
            emission, _ = model(waveform.to(args.device))
        spans = aligner(emission[0].cpu(), tokenizer(transcript))
        if len(spans) != len(transcript) or any(not item for item in spans):
            raise ValueError(f"Incomplete alignment for {segment['id']}")
        confidences = [mean(float(span.score) for span in item) for item in spans]
        mean_confidence = mean(confidences)
        if mean_confidence < args.minimum_confidence:
            failures.append(segment["id"])
        segments.append({
            "id": segment["id"],
            "audioSha256": sha256_file(audio_path),
            "durationSeconds": round(duration, 3),
            "wordCount": len(transcript),
            "alignedWordCount": len(spans),
            "meanConfidence": round(mean_confidence, 4),
            "minimumWordConfidence": round(min(confidences), 4),
            "maximumWordConfidence": round(max(confidences), 4),
        })
        print(f"{segment['id']} · {len(transcript)} words · confidence={mean_confidence:.4f}", flush=True)

    receipt = {
        "schemaVersion": 1,
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "method": "Torchaudio MMS_FA CTC forced alignment against the exact checked-in narration",
        "model": "torchaudio.pipelines.MMS_FA",
        "device": args.device,
        "script": {
            "path": "submission/narration-script.json",
            "sha256": sha256_file(script_path),
        },
        "minimumMeanConfidence": args.minimum_confidence,
        "segments": segments,
        "failures": failures,
        "result": "passed" if not failures else "failed",
    }
    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output_path}", flush=True)
    if failures:
        raise RuntimeError(f"Low-confidence narration segment(s): {', '.join(failures)}")


if __name__ == "__main__":
    main()
