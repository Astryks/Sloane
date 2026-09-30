# Recording a voice reference (Directed by Lucy)

*2026-09-30, realism pass.* A cast member's voice is locked from a real
recording of that person, uploaded on the Cast card ("Use my own voice").
Chatterbox (Turbo or standard) clones from it zero-shot, so **the recording
is the voice**: flat in, flat out. Nothing synthetic is ever used as a
reference any more (the old "preset" TTS references are retired).

## Consent first

- Only record, or upload, a voice whose owner has agreed to it being used to
  generate speech in Lucy. The upload route requires the consent checkbox and
  stores who agreed and when.
- Never upload a celebrity, a client's voice without their written OK, or
  audio pulled from someone else's video.
- For a **LoRA** voice (see `docs/voice-lora-recipe.md`), also file a signed
  `training_data/<voice>/consent.json` before training.

## What to record

| | |
|---|---|
| Length | **60-120 seconds** of speech (the upload accepts 10s-5min; Turbo needs more than 5s, but 60s+ holds the voice far better). |
| Content | **Acted**, not read: tell a short story, argue a point, react to good and bad news. Include a laugh, a sigh, a question, a quiet line and a louder one. Keep your natural "um"s and restarts - they are part of the voice. |
| One speaker | Only the person being cloned. No music, no TV, no second voice. |
| Format | **48 kHz**, 24-bit WAV (or the phone's highest-quality setting; lossless if it offers it). Avoid heavy MP3/AAC compression and Bluetooth mics. |
| Room | A **quiet, soft room** (bedroom with curtains, a wardrobe full of clothes). No echoey kitchens or bathrooms. Turn off fans and air-con. |
| Mic | 15-25 cm from the mouth, slightly off-axis to avoid pops. Same distance throughout. Phone mics are fine at this distance. |
| Levels | Peaks around -12 to -6 dBFS; never clipping. No noise suppression, auto-gain, or "voice enhance" filters - they strip the breath and texture that make a voice sound human. |
| Silence | Leave 1-2 seconds of room silence at the start (used as room tone). |

## A script that works

Read it once to learn it, then **perform** it in your own words:

> So I have to tell you what happened this morning. *(beat)* Um, I get to
> the office, and the door's just... open. Nobody there. And I'm thinking -
> okay, that's weird, right? *(laugh)* Then Sam walks in holding two coffees
> like nothing's wrong. And I said, "Where have you BEEN?" *(quietly)* He
> just looked at me. *(sigh)* Honestly? I don't even want to know.
> *(brighter)* Anyway! Good news - we got the contract.

## Checking the recording

Play it back on headphones. Re-record if you hear: a second voice, music,
echo, clipping/crackle, a fan hum, or a very even, "reading" delivery.

## Where it's used

- **Voice lock** (Studio: "Keep each person's voice the same"): every shot the
  person speaks in is re-voiced to this recording with the shot's timing kept.
- **Voice-first** (Seedance 2.x): the line is spoken from this recording with
  Chatterbox-Turbo (including `[chuckle]`, `[sigh]`… from the acting pass),
  and the video lip-syncs to it.
- **Optional lip-sync** (`DIRECTOR_LIPSYNC`, off by default): when a shot's
  final audio isn't the model's own, the mouth is re-synced to the new audio.
