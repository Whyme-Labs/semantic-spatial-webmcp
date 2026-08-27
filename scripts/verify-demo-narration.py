#!/usr/bin/env python3
"""Force-align one continuous narration and derive beat timings and captions."""

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
DEFAULT_AUDIO = ROOT / "submission" / "video" / "narration" / "demo-narration.wav"
DEFAULT_OUTPUT = ROOT / "docs" / "demo-narration-alignment.json"
DEFAULT_CAPTIONS = ROOT / "submission" / "demo-narration.srt"
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


def srt_time(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def write_captions(path: Path, beats: list[dict], duration: float) -> None:
    cues = []
    for index, beat in enumerate(beats):
        start = beat["speechStartSeconds"]
        next_start = beats[index + 1]["speechStartSeconds"] if index + 1 < len(beats) else duration
        end = min(beat["speechEndSeconds"] + 0.3, next_start - 0.05, duration)
        if end <= start:
            end = min(start + 0.5, duration)
        cues.extend([
            str(index + 1),
            f"{srt_time(start)} --> {srt_time(end)}",
            beat["text"],
            "",
        ])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(cues), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", type=Path, default=DEFAULT_SCRIPT)
    parser.add_argument("--audio", type=Path, default=DEFAULT_AUDIO)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--captions", type=Path, default=DEFAULT_CAPTIONS)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--minimum-confidence", type=float, default=0.3)
    args = parser.parse_args()

    script_path = args.script.resolve()
    script = json.loads(script_path.read_text(encoding="utf-8"))
    if script.get("schemaVersion") != 2 or not script.get("beats"):
        raise ValueError("Narration script must use schemaVersion 2 and contain beats")
    audio_path = args.audio.resolve()
    if not audio_path.is_file():
        raise FileNotFoundError(audio_path)

    transcript_by_beat = [words(beat["text"]) for beat in script["beats"]]
    transcript = [word for beat_words in transcript_by_beat for word in beat_words]
    bundle = torchaudio.pipelines.MMS_FA
    print(f"Loading {bundle.__class__.__name__} forced aligner on {args.device}…", flush=True)
    model = bundle.get_model(with_star=False).to(args.device).eval()
    tokenizer = bundle.get_tokenizer()
    aligner = bundle.get_aligner()
    waveform, duration = load_waveform(audio_path, bundle.sample_rate)
    with torch.inference_mode():
        emission, _ = model(waveform.to(args.device))
    spans = aligner(emission[0].cpu(), tokenizer(transcript))
    if len(spans) != len(transcript) or any(not item for item in spans):
        raise ValueError("Incomplete full-track alignment")

    samples_per_emission = waveform.shape[1] / emission.shape[1]
    seconds_per_emission = samples_per_emission / bundle.sample_rate
    beat_receipts = []
    failures = []
    cursor = 0
    for beat, beat_words in zip(script["beats"], transcript_by_beat):
        beat_spans = spans[cursor:cursor + len(beat_words)]
        cursor += len(beat_words)
        confidences = [mean(float(token.score) for token in word_span) for word_span in beat_spans]
        mean_confidence = mean(confidences)
        if mean_confidence < args.minimum_confidence:
            failures.append(beat["id"])
        start = beat_spans[0][0].start * seconds_per_emission
        end = beat_spans[-1][-1].end * seconds_per_emission
        beat_receipts.append({
            "id": beat["id"],
            "text": beat["text"],
            "wordCount": len(beat_words),
            "alignedWordCount": len(beat_spans),
            "speechStartSeconds": round(start, 3),
            "speechEndSeconds": round(end, 3),
            "meanConfidence": round(mean_confidence, 4),
            "minimumWordConfidence": round(min(confidences), 4),
            "maximumWordConfidence": round(max(confidences), 4),
        })
        print(
            f"{beat['id']} · {len(beat_words)} words · {start:.2f}-{end:.2f}s · confidence={mean_confidence:.4f}",
            flush=True,
        )

    caption_path = args.captions.resolve()
    write_captions(caption_path, beat_receipts, duration)
    receipt = {
        "schemaVersion": 2,
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "method": "Torchaudio MMS_FA CTC forced alignment over one continuous checked-in narration",
        "model": "torchaudio.pipelines.MMS_FA",
        "device": args.device,
        "singleContinuousTrack": True,
        "script": {
            "path": "submission/narration-script.json",
            "sha256": sha256_file(script_path),
            "wordCount": len(transcript),
            "beatCount": len(script["beats"]),
        },
        "audio": {
            "path": "submission/video/narration/demo-narration.wav",
            "sha256": sha256_file(audio_path),
            "durationSeconds": round(duration, 3),
        },
        "captions": {
            "path": "submission/demo-narration.srt",
            "sha256": sha256_file(caption_path),
            "cueCount": len(beat_receipts),
        },
        "minimumMeanConfidence": args.minimum_confidence,
        "beats": beat_receipts,
        "failures": failures,
        "result": "passed" if not failures else "failed",
    }
    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output_path}", flush=True)
    print(f"Wrote {caption_path}", flush=True)
    if failures:
        raise RuntimeError(f"Low-confidence narration beat(s): {', '.join(failures)}")


if __name__ == "__main__":
    main()
