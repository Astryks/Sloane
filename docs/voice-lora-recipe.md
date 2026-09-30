# Lucy voice LoRA recipe - paused and corrected (2026-09-30)

## Status

- `scripts/07_finetune_new_voices.sh` is **paused**. It exits unless
  `LUCY_ALLOW_LEGACY_LORA=1` is set.
- The corrected recipe is `scripts/12_finetune_expressive_lora.py`.
- Until a voice has **30-60+ minutes of consented, expressive audio from one
  speaker**, use zero-shot Chatterbox-Turbo from a 60-120s reference
  recording instead (`docs/voice-reference-recording.md`). That is the
  director's voice-first/voice-lock path today.

## What was wrong with the old recipe

| Old (07) | Problem | New (12) |
|---|---|---|
| `new_vocab_size = 2454` | Resized the English text embedding (704 tokens) to the multilingual size, so the new rows started from random init and were learned from ~30 min of audio. | `704`: the base tokenizer, no resize. |
| `lora_modules_to_save = ["text_emb", "text_head"]` | Fully retrained how text maps to speech tokens on one speaker's podcast. This loses the base model's prosody knowledge and flattens delivery. | Empty: only a small adapter on the attention projections. |
| `lora_r 128 / alpha 256`, 10 epochs, lr 1e-4, MLP + `spkr_enc` targets | Enough capacity and steps to memorise one flat podcast delivery. | r 32 / alpha 32, **3 epochs**, lr 5e-5, attention (q/k/v/o) only. |
| Whisper transcripts (`03_chunk_by_speech.py`) with fillers removed | The audio has "um", restarts and repeats, but the text doesn't. The model learns that hesitations are noise to skip, so it never produces them. | `--retranscribe` re-transcribes with a disfluency-preserving prompt, no VAD trimming and no suppressed tokens. |
| Any amount of audio (voice_dave had 6.4 min), no consent record | Thin data plus a big adapter causes artefacts. There was no record that the speaker agreed. | A hard gate: at least 30 min (60+ recommended) of usable 2-15s clips **and** a `consent.json`. |

## Steps (on the training pod)

```bash
# 1. clips from 01-03 as before, then:
python3 scripts/12_finetune_expressive_lora.py --voice voice_x --retranscribe
python3 scripts/12_finetune_expressive_lora.py --voice voice_x --check-only
python3 scripts/12_finetune_expressive_lora.py --voice voice_x --train
```

Then run a **blind A/B test** of the merged LoRA against zero-shot Turbo from
the same speaker's reference (the same 10 acted lines). Ship it only if it
wins. The `lucy-tts` loader (`resize_and_load_t3_weights` in the vendored
model) must load these checkpoints at the base vocab of 704, not the resized
2454. Check this before deploying `scripts/modal_app.py`.

## What makes a good training set

- Acted, varied speech: laughs, questions, anger, whispers. Not one monotone
  podcast.
- One speaker, one mic, and a quiet room. Recorded at 48 kHz.
- Transcripts that match the audio **word for word**, including fillers.
