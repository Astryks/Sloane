#!/usr/bin/env python3
"""
Phase 3: zero-shot Chatterbox sanity check.

Picks one reference clip per instructor (already chosen by hand from the
longest clean utterances) and generates a few test sentences in each voice,
with no fine-tuning. Validates voice-identity capture before any training
investment, and doubles as the first real (non-mock) test of the API's
generation path.

Usage:
    python3 scripts/04_zeroshot_test.py
"""
import argparse
from pathlib import Path

import torch
import torchaudio
from chatterbox.tts import ChatterboxTTS

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRAINING_DATA = PROJECT_ROOT / "training_data"
OUT_DIR = PROJECT_ROOT / "zeroshot_test_output"

REFERENCE_CLIPS = {
    "harper": PROJECT_ROOT / "scripts" / "voice_references" / "harper.wav",
}

TEST_SENTENCES = [
    "Hello, my name is Sloane, and I'm excited to help you create something today.",
    "Welcome back. Let's pick up right where we left off last time.",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a local Chatterbox zero-shot TTS test")
    parser.add_argument("--reference", type=Path, help="WAV reference used for the clone")
    parser.add_argument("--text", help="Text to synthesize")
    args = parser.parse_args()

    device = (
        "cuda" if torch.cuda.is_available()
        else "mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()
        else "cpu"
    )
    print(f"device: {device}")
    model = ChatterboxTTS.from_pretrained(device=device)

    references = {"custom": args.reference} if args.reference else REFERENCE_CLIPS
    sentences = [args.text] if args.text else TEST_SENTENCES
    OUT_DIR.mkdir(exist_ok=True)
    for speaker, ref_path in references.items():
        if not ref_path.is_file():
            raise FileNotFoundError(f"Reference WAV not found: {ref_path}")
        print(f"\n=== {speaker} (reference: {ref_path.name}) ===")
        for i, sentence in enumerate(sentences, start=1):
            print(f"  generating [{i}]: {sentence[:60]}...")
            wav = model.generate(sentence, audio_prompt_path=str(ref_path))
            out_path = OUT_DIR / f"{speaker}_{i:02d}.wav"
            torchaudio.save(str(out_path), wav, model.sr)
            print(f"  -> {out_path.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
