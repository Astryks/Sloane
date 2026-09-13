# Vendored upstream dependencies

Mirrors of the open-source projects this build depends on or is evaluating,
kept here in case the upstream repos disappear, go private, or change
license terms. Snapshots as of 2026-09-07, not kept in sync automatically —
re-pull manually if a newer version is needed.

- **`chatterbox-upstream/`** — [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox),
  MIT licensed. The actual TTS model we fine-tune (see PROJECT_CONTEXT.md
  Phase 3/6). Not directly imported by our code (we use the vendored copy
  inside `chatterbox-finetuning-upstream/src/chatterbox_/` for
  training/inference — see below), but kept for reference and as a backup
  of the canonical upstream.
- **`chatterbox-finetuning-upstream/`** — [gokhaneraslan/chatterbox-finetuning](https://github.com/gokhaneraslan/chatterbox-finetuning),
  Apache-2.0 licensed. The LoRA fine-tuning toolkit actually used in Phase 6
  — a smaller community project, higher disappearance risk than Chatterbox
  itself, so worth mirroring.
- **`hallo3-upstream/`** — [fudan-generative-vision/hallo3](https://github.com/fudan-generative-vision/hallo3),
  code MIT licensed. Kept as a secondary reference — see below for why it's
  not the active Feature C pick.
- **`echomimic_v3-upstream/`** — [antgroup/echomimic_v3](https://github.com/antgroup/echomimic_v3)
  (AAAI 2026), Apache-2.0 covering the models/weights explicitly, not just
  the code. **Active Feature C candidate for inference/zero-shot.** Demo
  assets (`datasets/`, ~30MB of sample images/audio) were dropped before
  committing — not needed to preserve, we only care about the code.
- **`hallo2-upstream/`** — [fudan-generative-vision/hallo2](https://github.com/fudan-generative-vision/hallo2),
  MIT licensed. **Active Feature C candidate for fine-tuning/training** —
  unlike EchoMimicV3 (and unlike EchoMimic v1/v2 and Hallo3), Hallo2
  actually ships working training code (`scripts/train_stage1.py`,
  `scripts/train_stage2_long.py`), not just inference. Earlier
  reference-network architecture than Hallo3, plausibly why Hallo3
  regressed on identity preservation. See PROJECT_CONTEXT.md for the
  plan: zero-shot compare against EchoMimicV3 first, then run a real
  fine-tune on whichever wins once real source video is available.
  Demo assets (`examples/`, ~12MB of sample audio/video) dropped before
  committing.
- **`wan2.2-upstream/`** — [Wan-Video/Wan2.2](https://github.com/Wan-Video/Wan2.2),
  Apache-2.0 licensed, public weights (e.g. `Wan-AI/Wan2.2-TI2V-5B` on
  Hugging Face, not gated). Open video generation model - vendored 2026-09-10
  while considering whether a narrow fine-tune (our own avatar/character
  look specifically, not general-purpose parity with Kling/Veo) could be a
  future self-hosted option for the Ads video mode. Not integrated or
  fine-tuned yet - see STATUS.md/PROJECT_CONTEXT.md Sec 17 for why this is
  scoped as a real future R&D project, not something to jump into. Demo
  media (`assets/`, `examples/` - sample images/audio/video) dropped before
  committing, same as the other entries here.
- **`qwen3-tts-upstream/`** — [QwenLM/Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS),
  Apache-2.0 licensed, public weights (e.g. `Qwen/Qwen3-TTS-12Hz-0.6B-Base`,
  not gated). Open, multilingual TTS with zero-shot cloning and per-voice
  fine-tuning support - vendored 2026-09-10 as a possible alternative or
  supplement to Chatterbox (the model this product actually fine-tunes and
  runs in production today). A real side-by-side speed/quality test was run
  against fal.ai's hosted endpoint (not this vendored code) the same day -
  see STATUS.md for the result. Kept `examples/` (real usage scripts) and
  the technical report PDF; nothing dropped.
- **`moshi-upstream/`** — [kyutai-labs/moshi](https://github.com/kyutai-labs/moshi),
  dual MIT/Apache-2.0 licensed. Real-time full-duplex speech-to-speech
  foundation model (~200ms latency, raw audio in -> raw audio out, no
  separate ASR/LLM/TTS stages) - vendored 2026-09-13 while researching
  whether a real-time "video call with an AI" product is buildable. English-
  only today; a real, exploratory candidate for the conversational "brain +
  ears" half of that idea, not yet evaluated hands-on or integrated. Demo
  audio samples (`data/`, ~1.8MB) dropped before committing.
- **`musetalk-upstream/`** — [TMElyralab/MuseTalk](https://github.com/TMElyralab/MuseTalk),
  MIT licensed (Tencent Music Entertainment). Real-time-capable open-source
  lip-sync model (30fps+ on a single GPU) that edits the mouth region of an
  existing photo/video to match new audio - the realistic open-source
  candidate for the "face" half of a real-time avatar, since it's built for
  live speed rather than the slower cinematic-diffusion talking-head models
  already vendored above (Hallo2/Hallo3/EchoMimicV3). Not yet evaluated
  hands-on or integrated. Demo assets (`assets/demo`, `assets/figs`,
  `data/audio`, `data/video`) dropped before committing.
- **`liveportrait-upstream/`** — [KwaiVGI/LivePortrait](https://github.com/KwaiVGI/LivePortrait),
  MIT licensed (Kuaishou Visual Generation and Interaction Center). Fast
  portrait animation/expression-retargeting model (~13ms/frame on an RTX
  4090) - complementary to MuseTalk above (expression/pose control rather
  than audio-driven lip-sync specifically). Vendored 2026-09-13 for the same
  real-time-avatar research as Moshi/MuseTalk; not yet evaluated hands-on or
  integrated. Demo assets (`assets/examples`, `assets/docs`) dropped before
  committing; `pretrained_weights/` is an empty placeholder directory in the
  upstream repo, kept as-is.

- **`llamacpp-upstream/`** — [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp),
  MIT licensed. Real, verified-best choice for a **fast, single-user,
  self-hosted LLM "brain"** (a personal-clone assistant idea researched
  2026-09-13 - see below) - real benchmarks show ~62-71 tok/s single-stream
  on an RTX 4090 (our own GPU) for an 8B model, genuinely fast enough for
  phone-call-speed conversation. Chosen over vLLM, which optimizes for
  many-concurrent-users throughput, not single-user latency - the wrong
  axis for this use case. This is the inference **engine**, not a specific
  model - actual model weights (e.g. a small Llama/Mistral/Qwen chat model)
  get pulled from HuggingFace on-demand later, same as everything else.
  Test vocab fixtures (`models/`, ~75MB of tokenizer-only GGUF files, not
  real model weights) and auto-generated operator-support tables
  (`docs/ops/`, ~36MB of CSVs) dropped before committing - neither needed
  to actually build/run it.

## Real-time AI avatar research, 2026-09-13 - not yet built, revisit later

While discussing whether a live, emotionally-responsive "video call with an
AI" product is buildable, checked what's real vs. announced-but-inaccessible
in the open-source space (same diligence as the Feature C search below).
**EMO** ("Emote Portrait Alive", Alibaba's Institute for Intelligent
Computing) was checked and found to be paper-only, same situation as
OmniTalker: [HumanAIGC/EMO](https://github.com/HumanAIGC/EMO) is just a
README with a citation and links to the paper/project page/a YouTube demo -
no runnable code, no weights, nothing to vendor. Not cloned.
The three real, vendorable candidates above (Moshi, MuseTalk, LivePortrait)
map roughly onto the three real pieces a live avatar needs: a full-duplex
conversational engine, and two options for the real-time face. A genuinely
relevant existing discovery from a real, independent reference
implementation ([PunithVT/ai-avatar-system](https://github.com/PunithVT/ai-avatar-system),
not vendored here, just noted): it combines Whisper + Chatterbox + MuseTalk
- the same TTS engine and ASR toolkit already used in this project's own
production pipeline. This is flagged for a later session, not started -
see STATUS.md.

## Feature C model selection: OmniTalker → Hallo3 → EchoMimicV3

PROJECT_CONTEXT.md originally named OmniTalker (Alibaba/HumanAIGC) as the
Feature C candidate. Checked 2026-09-07 while vendoring: **OmniTalker has no
public model code or weights** — its GitHub repo
([HumanAIGC/omnitalker](https://github.com/HumanAIGC/omnitalker)) is only a
project page (paper links, demo videos), and its Hugging Face Space
(`Mrwrichard/OmniTalker`) is a thin Gradio UI that forwards requests to a
private internal Alibaba backend (`OMNITALKER_URL`, not publicly reachable)
— nothing runnable to self-host, and no commercial API/DashScope listing
found either. Completely inaccessible.

First pivoted to Hallo3 (real repo, MIT code, downloadable weights) — then
superseded the same day once actually compared against alternatives rather
than just taking the first available option: a benchmark comparison flagged
Hallo3 with "severe limitations in preserving character identity" (a
dealbreaker here — the product needs the video to look like the *specific*
real person), and it's a heavier CogVideoX-5B-backed model. **EchoMimicV3**
won the comparison: Apache-2.0 explicitly covering the weights (not just
code, unlike Hallo3), lighter (1.3B params, a "Flash" variant runs on as
little as 12GB VRAM), and no identity-preservation red flag found against
it. See PROJECT_CONTEXT.md Sec 8 for the full writeup.

## Personal-clone assistant research, 2026-09-13 - not yet built, revisit later

A different idea from the real-time avatar research above: an assistant
that sounds like *you specifically* (your own voice, cloned from your own
phone-call audio) and responds in your own conversational style (fine-tuned
from your own exported WhatsApp messages), reachable by an approved circle
of family - explicitly your own voice/data/permission, not impersonating
anyone else. Real architecture, pieces mapped to what's already in this
repo:
- **Voice**: already solved - the same Chatterbox LoRA fine-tune pipeline
  used for every preset voice in this project. If source call recordings
  have two speakers, `scripts/08_isolate_speaker.py`'s existing k=2
  clustering isolates your side first.
- **Understanding + generating a sensible reply ("the brain")**: a general-
  purpose open-source chat LLM (Llama/Mistral/Qwen-chat - not Qwen3-TTS,
  which is audio-only) already has real language understanding baked in
  from its own pretraining; a personality fine-tune on your WhatsApp
  history (via `llamacpp-upstream`'s tooling) would only need to nudge
  *how* it responds, not teach it to understand language for the first
  time. Real, honest limit: this gets a strong stylistic impression, not
  literally your own current thoughts - it will guess on topics your real
  messages never covered, and that guess will still sound like you.
- **Speed**: chose `llamacpp-upstream` specifically because Path B (self-
  hosted) was chosen over a paid API, with an explicit "needs to be quick,
  like a phone call" requirement - real benchmarks confirm single-user
  low-latency performance on the same RTX 4090 already used throughout
  this project, unlike vLLM which optimizes for many-concurrent-users
  throughput instead.
- **Reaching family by an actual phone number** (not just an in-app voice
  chat) is the one piece that genuinely needs a third party - no one
  self-hosts a connection to the real phone network; would need a
  telephony API (e.g. Twilio) for just that piece if a real phone number
  is wanted, not needed at all if an in-app voice chat is acceptable
  instead.
Nothing built or fine-tuned yet - code only, saved to revisit later.
