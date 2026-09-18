#!/usr/bin/env python3
"""Generate and completeness-check every customer-facing voice on Apple MPS.

This is deliberately local-only. It does not import Modal or RunPod and it
refuses to run unless PyTorch reports that Apple's Metal backend is active.
Each accepted take has already passed lucy_tts_engine's per-chunk checks;
this script then transcribes the joined WAV again to catch any integration
or repeated-word omission across chunk boundaries.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import soundfile as sf
import torch


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_ROOT = PROJECT_ROOT / ".local-models"
OUTPUT_DIR = PROJECT_ROOT / "local_voice_tests"

os.environ.setdefault("LUCY_MODEL_ROOT", str(MODEL_ROOT))
os.environ.setdefault("LUCY_VOICE_REFERENCE_DIR", str(PROJECT_ROOT / "scripts" / "voice_references"))
os.environ.setdefault("LUCY_DEVICE", "mps")
os.environ.setdefault("LUCY_MAX_CACHED_VOICES", "1")
os.environ.setdefault("LUCY_EXPERIMENTAL_DSP", "0")

if not torch.backends.mps.is_built() or not torch.backends.mps.is_available():
    raise SystemExit("Apple MPS is unavailable; refusing to run this local-GPU audit on CPU or a paid cloud GPU.")
if not MODEL_ROOT.is_dir():
    raise SystemExit(f"Local model directory is missing: {MODEL_ROOT}")

from lucy_tts_engine import (  # noqa: E402
    DEVICE,
    ENABLE_EXPERIMENTAL_DSP,
    MIN_WORD_OVERLAP_RATIO,
    PRESET_VOICES,
    ZERO_SHOT_PRESET_VOICES,
    ends_abruptly,
    generate_preset,
    has_unexpected_internal_silence,
    omitted_word_count,
    unexpected_word_count,
    verifier_model,
    word_overlap_ratio,
)


VOICE_LABELS = {
    "art_instructor": "Vicky",
    "music_instructor": "Patrick",
    "voice_business": "Alice",
    "voice_finance": "Megan",
    "voice_broadcast": "Katie",
    "voice_tech": "Brad",
    "voice_comedy": "Izzy",
    "voice_sales": "Robbo",
    "voice_mark": "Mark",
    "voice_adam": "Adam",
    "voice_rachel": "Rachel",
    "harper": "Harper",
    "jess": "Jess",
    "liam": "Liam",
    "ryan": "Ryan",
    "tyler": "Tyler",
    "voice_mia": "Mia",
    "voice_dave": "Dave",
}

DEFAULT_TEXT = (
    "Speak with a quiet rhythm and read every word clearly. "
    "Today I feel hopeful because careful work can turn a difficult moment into a better one. "
    "Say steady, steady, steady, then finish with calm confidence."
)


def transcribe(audio, sample_rate: int) -> str:
    segments, _ = verifier_model.transcribe(audio, language="en", word_timestamps=True)
    return " ".join(segment.text.strip() for segment in segments).strip()


def write_report(path: Path, payload: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".part")
    temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voices", help="Comma-separated voice ids; defaults to all 18 product voices")
    parser.add_argument("--text", default=DEFAULT_TEXT, help="Audit script to read")
    parser.add_argument("--force", action="store_true", help="Regenerate voices already marked passed")
    args = parser.parse_args()

    if DEVICE != "mps":
        raise SystemExit(f"Engine selected {DEVICE!r}, not 'mps'; refusing to continue.")
    if ENABLE_EXPERIMENTAL_DSP:
        raise SystemExit("LUCY_EXPERIMENTAL_DSP must stay disabled for the restored native voice path.")

    available = set(PRESET_VOICES) | set(ZERO_SHOT_PRESET_VOICES)
    if available != set(VOICE_LABELS):
        missing = sorted(available - set(VOICE_LABELS))
        stale = sorted(set(VOICE_LABELS) - available)
        raise SystemExit(f"Voice roster drifted; missing labels={missing}, stale labels={stale}")

    voices = list(VOICE_LABELS)
    if args.voices:
        voices = [voice.strip() for voice in args.voices.split(",") if voice.strip()]
        unknown = sorted(set(voices) - available)
        if unknown:
            raise SystemExit(f"Unknown voice ids: {unknown}")

    OUTPUT_DIR.mkdir(exist_ok=True)
    report_path = OUTPUT_DIR / "report.json"
    if report_path.exists():
        report = json.loads(report_path.read_text(encoding="utf-8"))
    else:
        report = {}
    report.update(
        {
            "started_at": report.get("started_at", datetime.now(timezone.utc).isoformat()),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "device": DEVICE,
            "model_root": str(MODEL_ROOT),
            "experimental_dsp": ENABLE_EXPERIMENTAL_DSP,
            "megan_restored_to_native_path": not ENABLE_EXPERIMENTAL_DSP,
            "text": args.text,
            "minimum_overlap_ratio": MIN_WORD_OVERLAP_RATIO,
            "voices": report.get("voices", {}),
        }
    )

    for index, voice_id in enumerate(voices, start=1):
        previous = report["voices"].get(voice_id, {})
        if previous.get("passed") and not args.force:
            print(f"[{index}/{len(voices)}] {VOICE_LABELS[voice_id]}: already passed; skipping", flush=True)
            continue

        label = VOICE_LABELS[voice_id]
        print(f"[{index}/{len(voices)}] {label} ({voice_id}) on {DEVICE}...", flush=True)
        started = time.monotonic()
        try:
            audio, sample_rate = generate_preset(args.text, voice_id)
            if audio is None or sample_rate is None:
                raise RuntimeError("generation returned no audio")
            output_path = OUTPUT_DIR / f"{index:02d}_{voice_id}.wav"
            sf.write(output_path, audio, sample_rate)
            transcript = transcribe(audio, sample_rate)
            overlap = word_overlap_ratio(args.text, transcript)
            omitted = omitted_word_count(args.text, transcript)
            unexpected = unexpected_word_count(args.text, transcript)
            internal_silence = has_unexpected_internal_silence(audio, sample_rate)
            abrupt_ending = ends_abruptly(audio, sample_rate)
            passed = (
                omitted == 0
                and unexpected == 0
                and overlap >= MIN_WORD_OVERLAP_RATIO
                and not internal_silence
                and not abrupt_ending
            )
            result = {
                "label": label,
                "passed": passed,
                "duration_seconds": round(len(audio) / sample_rate, 3),
                "elapsed_seconds": round(time.monotonic() - started, 3),
                "ordered_word_overlap": round(overlap, 4),
                "omitted_words": omitted,
                "unexpected_words": unexpected,
                "unexpected_internal_silence": internal_silence,
                "abrupt_ending": abrupt_ending,
                "transcript": transcript,
                "audio_file": str(output_path),
                "error": None,
            }
        except Exception as exc:  # keep auditing the remaining roster
            result = {
                "label": label,
                "passed": False,
                "elapsed_seconds": round(time.monotonic() - started, 3),
                "error": f"{type(exc).__name__}: {exc}",
            }
        report["voices"][voice_id] = result
        report["updated_at"] = datetime.now(timezone.utc).isoformat()
        write_report(report_path, report)
        status = "PASS" if result["passed"] else "FAIL"
        print(f"  {status}: {result.get('transcript') or result.get('error')}", flush=True)

    selected_results = [report["voices"].get(voice_id, {}) for voice_id in voices]
    failed = [result.get("label", "unknown") for result in selected_results if not result.get("passed")]
    report["completed_at"] = datetime.now(timezone.utc).isoformat()
    report["selected_voice_count"] = len(voices)
    report["selected_pass_count"] = len(voices) - len(failed)
    report["selected_failures"] = failed
    write_report(report_path, report)
    print(f"\nReport: {report_path}")
    print(f"Result: {len(voices) - len(failed)}/{len(voices)} passed on Apple MPS")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
