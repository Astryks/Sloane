#!/usr/bin/env python3
"""Corrected, EXPRESSIVE Chatterbox LoRA recipe (2026-09-30 realism pass).

Replaces scripts/07_finetune_new_voices.sh (paused). What changed and why
(full reasoning in docs/voice-lora-recipe.md):

  * NO vocab resize and NO text_emb / text_head retraining. The old recipe
    set new_vocab_size=2454 and lora_modules_to_save=["text_emb","text_head"],
    i.e. it re-learned how text maps to speech from ~30 min of podcast audio.
    Here the base English tokenizer (704 tokens) is kept and only the
    speech-side attention/MLP layers get a small adapter.
  * Disfluencies are KEPT in the transcripts. Whisper normally deletes
    "um", "uh", restarts and repeats; training on audio that HAS them against
    text that DOESN'T teaches the model that hesitations are noise, so it
    never produces them and reads everything fluently and flat. Clips are
    re-transcribed with a disfluency-preserving prompt (--retranscribe).
  * Fewer epochs (3, lr 5e-5, r=32) - enough to learn a timbre, not enough
    to overfit a single flat delivery.
  * Hard data gate: at least 30 minutes of CONSENTED, EXPRESSIVE speech
    (60+ recommended) from ONE speaker, with a consent record on file.
    Less than that -> zero-shot from a 60-120s reference instead (see
    docs/voice-reference-recording.md); a LoRA on less data mostly hurts.

Runs ON the training pod (RunPod / Modal GPU), never automatically, never
from the web app. Nothing here calls a paid API.

Usage (from the project root on the pod):
    python3 scripts/12_finetune_expressive_lora.py --voice voice_mia --check-only
    python3 scripts/12_finetune_expressive_lora.py --voice voice_mia --retranscribe
    python3 scripts/12_finetune_expressive_lora.py --voice voice_mia --train

Expects training_data/<voice>/clips/*.wav plus training_data/<voice>/consent.json:
    {"speaker": "Full Name", "signed": "2026-10-01", "scope": "Lucy voice model",
     "recorded_by": "...", "statement": "I agree that ..."}
"""
import argparse
import csv
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

PROJECT_ROOT = Path(os.environ.get("LUCY_PROJECT_ROOT", Path(__file__).resolve().parent.parent))
TRAINING_DATA = PROJECT_ROOT / "training_data"
BASE_TOOLKIT = Path(os.environ.get("LUCY_FT_TOOLKIT", "/workspace/sloane/chatterbox-finetuning"))
PYTHON = os.environ.get("LUCY_FT_PYTHON", "/workspace/sloane/.venv/bin/python")

MIN_MINUTES = 30.0  # hard floor
GOOD_MINUTES = 60.0  # recommended
BASE_VOCAB = 704  # Chatterbox English tokenizer - unchanged (was resized to 2454)
EPOCHS = 3  # was 10
LEARNING_RATE = 5e-5  # was 1e-4
LORA_R, LORA_ALPHA = 32, 32  # was 128 / 256
MIN_CLIP_S, MAX_CLIP_S = 2.0, 15.0

# Whisper keeps fillers when the prompt already contains them (known behaviour
# of the decoder's conditioning on the prompt's style).
DISFLUENT_PROMPT = "Umm, so, uh, I was- I was thinking, like, hmm... you know? Mm-hm. Yeah, I mean- okay."
FILLERS = ("um", "umm", "uh", "uhh", "hmm", "mm", "mm-hm", "er", "ah")
REQUIRED_CONSENT_KEYS = ("speaker", "signed", "statement")


def clip_seconds(path: Path) -> float:
    try:
        with wave.open(str(path), "rb") as w:
            return w.getnframes() / float(w.getframerate())
    except wave.Error:
        import soundfile as sf  # non-PCM wav

        info = sf.info(str(path))
        return info.frames / float(info.samplerate)


def check(voice: str) -> dict:
    """The data gate. Returns a report; raises SystemExit on a hard failure."""
    root = TRAINING_DATA / voice
    problems, warnings = [], []
    consent_path = root / "consent.json"
    consent = {}
    if not consent_path.exists():
        problems.append(f"no consent record at {consent_path} - never train a voice without the speaker's written consent")
    else:
        try:
            consent = json.loads(consent_path.read_text())
        except json.JSONDecodeError as err:
            problems.append(f"consent.json is not valid JSON: {err}")
        missing = [k for k in REQUIRED_CONSENT_KEYS if not str(consent.get(k, "")).strip()]
        if missing:
            problems.append(f"consent.json is missing {', '.join(missing)}")
    clips = sorted((root / "clips").glob("*.wav"))
    lengths = [clip_seconds(c) for c in clips]
    usable = [s for s in lengths if MIN_CLIP_S <= s <= MAX_CLIP_S]
    minutes = sum(usable) / 60.0
    if minutes < MIN_MINUTES:
        problems.append(f"only {minutes:.1f} min of usable speech ({len(usable)} clips of {MIN_CLIP_S:.0f}-{MAX_CLIP_S:.0f}s); the floor is {MIN_MINUTES:.0f} min - use zero-shot from a reference recording instead")
    elif minutes < GOOD_MINUTES:
        warnings.append(f"{minutes:.1f} min of speech - trains, but {GOOD_MINUTES:.0f}+ min of varied, acted delivery gives a much livelier voice")
    rates = set()
    for c in clips[:50]:
        try:
            with wave.open(str(c), "rb") as w:
                rates.add(w.getframerate())
        except wave.Error:
            pass
    if rates and min(rates) < 24000:
        warnings.append(f"clips at {sorted(rates)} Hz - record at 48 kHz (Chatterbox runs at 24 kHz; lower rates sound dull)")
    meta = root / "metadata.csv"
    if meta.exists():
        text = meta.read_text(encoding="utf-8").lower()
        hits = sum(text.count(f" {f} ") + text.count(f" {f},") for f in FILLERS)
        if hits == 0:
            warnings.append("metadata.csv has no fillers (um/uh) at all - transcripts were probably cleaned; re-run with --retranscribe")
    report = {"voice": voice, "clips": len(clips), "usable_clips": len(usable), "minutes": round(minutes, 1), "consent": bool(consent), "problems": problems, "warnings": warnings}
    print(json.dumps(report, indent=2))
    if problems:
        raise SystemExit(1)
    return report


def retranscribe(voice: str, model_name: str = "large-v3") -> None:
    """Re-transcribes every clip keeping disfluencies; writes metadata.csv (LJSpeech, no header)."""
    from faster_whisper import WhisperModel

    root = TRAINING_DATA / voice
    model = WhisperModel(model_name, device="cuda" if _has_cuda() else "cpu", compute_type="float16" if _has_cuda() else "int8")
    rows = []
    for clip in sorted((root / "clips").glob("*.wav")):
        segs, _ = model.transcribe(
            str(clip),
            language="en",
            initial_prompt=DISFLUENT_PROMPT,
            condition_on_previous_text=False,
            vad_filter=False,  # VAD trims the breaths and hesitations we want to keep
            suppress_tokens=[],  # don't suppress filler tokens
            temperature=0.0,
        )
        text = " ".join(s.text.strip() for s in segs).strip().replace("|", ",")
        if text:
            rows.append(f"{clip.name}|{text}|{text}")
    (root / "metadata.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")
    with open(root / "retranscribed.csv", "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([r.split("|")[:2] for r in rows])
    print(f"{voice}: wrote {len(rows)} disfluency-preserving rows -> {root / 'metadata.csv'}")


def _has_cuda() -> bool:
    try:
        import torch

        return torch.cuda.is_available()
    except ImportError:
        return False


def config_py(voice: str) -> str:
    root = TRAINING_DATA / voice
    return f'''from dataclasses import dataclass, field
from typing import List

# Written by scripts/12_finetune_expressive_lora.py (2026-09-30 expressive recipe).
@dataclass
class TrainConfig:
    model_dir: str = "./pretrained_models"
    csv_path: str = "{root / 'metadata.csv'}"
    wav_dir: str = "{root / 'clips'}"
    preprocessed_dir = "./preprocess_cache"
    output_dir: str = "./chatterbox_output"

    is_inference = False
    inference_prompt_path: str = "{sorted((root / 'clips').glob('*.wav'))[0] if (root / 'clips').exists() and any((root / 'clips').glob('*.wav')) else ''}"
    inference_test_text: str = "Um, okay - so here's the thing. I honestly didn't think it would work."

    ljspeech = True
    json_format = False
    preprocess = True

    is_turbo: bool = False
    is_lora: bool = True

    # Small adapter on the speech transformer only. No text_emb/text_head
    # retraining (lora_modules_to_save is empty) and no vocab resize.
    lora_r: int = {LORA_R}
    lora_alpha: int = {LORA_ALPHA}
    turbo_lora_target_modules: List[str] = field(default_factory=lambda: ["c_attn", "c_proj"])
    lora_target_modules: List[str] = field(default_factory=lambda: ["q_proj", "k_proj", "v_proj", "o_proj"])
    lora_modules_to_save: List[str] = field(default_factory=list)

    new_vocab_size: int = {BASE_VOCAB}  # the base tokenizer's size = no resize

    batch_size: int = 8
    grad_accum: int = 4
    learning_rate: float = {LEARNING_RATE}
    num_epochs: int = {EPOCHS}

    save_steps: int = 200
    save_total_limit: int = 3
    dataloader_num_workers: int = 8

    start_text_token = 255
    stop_text_token = 0
    max_text_len: int = 256
    max_speech_len: int = 850
    prompt_duration: float = 3.0
'''


def train(voice: str) -> None:
    check(voice)
    work = PROJECT_ROOT / f"chatterbox-ft-{voice}-expressive"
    if not work.exists():
        subprocess.run(["cp", "-r", str(BASE_TOOLKIT), str(work)], check=True)
        subprocess.run(["rm", "-rf", str(work / "pretrained_models")], check=True)
        (work / "pretrained_models").symlink_to(BASE_TOOLKIT / "pretrained_models")
    (work / "src" / "config.py").write_text(config_py(voice))
    subprocess.run([PYTHON, "train.py"], cwd=work, check=True)
    subprocess.run([PYTHON, "merge_lora.py"], cwd=work, check=True)
    print(f"done: {work / 'chatterbox_output'}")
    print("Before shipping: A/B it blind against zero-shot Chatterbox-Turbo from the same speaker's 60-120s reference.")
    print("Ship the LoRA only if listeners prefer it; the lucy-tts loader must load it WITHOUT resize_and_load_t3_weights' vocab resize.")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--voice", required=True)
    ap.add_argument("--check-only", action="store_true")
    ap.add_argument("--retranscribe", action="store_true")
    ap.add_argument("--whisper-model", default="large-v3")
    ap.add_argument("--train", action="store_true")
    ap.add_argument("--print-config", action="store_true")
    a = ap.parse_args(argv)
    if a.print_config:
        print(config_py(a.voice))
        return 0
    if a.retranscribe:
        retranscribe(a.voice, a.whisper_model)
    if a.check_only or not (a.train or a.retranscribe):
        check(a.voice)
    if a.train:
        train(a.voice)
    return 0


if __name__ == "__main__":
    sys.exit(main())
