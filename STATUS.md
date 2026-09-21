# Sloane Project Status

## Latest update, 2026-09-21 - Director Mode, cinematic scene builder, voice-clone restrictions

- **Voice cloning restricted to paid tier + typed consent**, matching ElevenLabs' actual current protocol (verified, not assumed): removed the free-tier path from `/api/clone-voice` entirely (a real gap - anonymous visitors could clone any voice before this), replaced the consent checkbox with a typed, exact-match consent statement. Also fixed a pre-existing mobile bug found along the way: mobile's clone-voice screen never sent a consent field at all, so every mobile clone request was silently rejected.
- **Director Mode** (`web/src/lib/directorMode.ts`) - a deterministic engine (no LLM, matching this project's existing template-based-prompting convention) that expands a plain prompt into a structured cinematic prompt: focal length/aperture by emotional scale, camera rig/motion by kinetic energy, camera format/film stock/aspect ratio/lighting by genre (10 buckets), and a 5-step light-to-dark atmosphere gradient plus explicit color-tone detection (so "a greyish undertone" or "a summer day in Greece" are echoed directly, not just hoped-for). Grounded in real, sourced cinematography research (30 films, Scorsese/Tarantino, Super Bowl/UGC ad craft - full writeup in `docs/director-mode-cinematography-research.md`), which also caught and fixed 3 real regex bugs (single-sided word boundaries matching inside unrelated words, e.g. "cult\b" matching inside "difficult"). Wired into the grid-storyboard UI as a toggle with genre/atmosphere override controls.
- **"Build a cinematic scene"** - new feature: character photo + location photo + a simple prompt produces one hyper-realistic composite (correct anatomy from any angle, lighting/color matched to both the location and the stated intent), then hands the same prompt to Director Mode for the video step. One combined fal call, not two chained ones (avoids compounding ID drift), reusing the existing synchronous image-generation pattern - no new DB schema.
- **Competitive research**: `docs/higgsfield-competitive-research.md` - Higgsfield's real pricing ($19/$59 tiers + PAYG credit packs), their character-consistency approach (Soul ID - actual per-character trained models, not reference-image locking), and business traction ($400M Series B, $5.4B valuation). Recommendation: keep this project's existing PAYG video pricing as-is, defer building a trained-character system until reference-locking proves insufficient at real volume.
## Voice Engine & Audit
- **Hardware Acceleration:** Apple Silicon MPS (`mps`) fully operational locally.
- **Megan Baseline:** Restored to pre-tuning baseline; multi-sentence tests passing.
- **Word-Drop & Blanks Guard:** Whisper local verification active; rejects omitted words (e.g. "quiet rhythm") and auto-retries.
- **Recovery Engine:** Recursive chunking safely handles tricky phrases with a 2-word minimum boundary.
- **Emotion & Prosody:** Downward pitch contour applied at sentence ends; emotion tag mapping enabled.

## Legal Guardrails & Business
- **Voice Cloning:** Gated behind any paid tier (`starter`/`plus`/`video` - this project has no `pro`/`enterprise` tiers) with a typed, exact-match consent statement.
- **Unit Economics:** Cost per video minute modeled at ~$0.097 maintaining >65% margins.
