# Directed by Lucy: realism status (one page)

*Last updated 30 Sep 2026. Covers PRs #40–#43, which are all merged and live. The production deploy of `3ef51d4` was READY at 15:39 AEST.*

This page is the single entry point. It lists what shipped, every switch, where the research lives, the open issues, and how to dry-run the Neilson test. Details stay in the linked docs and aren't repeated here.

## What shipped

| PR | What | Main files |
|---|---|---|
| #40 realism pass | Per-model prompt formatters (Veo / Seedance 2.x / Kling 3) with word budgets. Continuity pass. Vertex `enhancePrompt:false` + negative prompt + seeds. Draft/Final. Auto Veo ingredients. Voice lock **off by default** (real uploaded recordings only). Chatterbox-Turbo. Film-level loudnorm + room-tone beds. Opt-in lip-sync + free sync check | `lib/director/formatters.ts`, `shotSchema.ts`, `videoQuality.ts`, `ingredients.ts`, `lipsync.ts`, `pipeline.ts`, `scripts/director_voice.py`, `scripts/director_stitch.py` |
| #41 | `fastapi[standard]<0.142` pin so the Modal voice image builds | `scripts/director_voice.py` |
| #42 coverage grammar | Speaker on camera, 180-degree rule (`plan.screenSides`), reaction shots, fixed cast look strings, refs = people in frame | `lib/director/grammar.ts`, `coverage.ts` |
| #43 cinematic engine | Beat → shot choice, scene recipes, per-model camera vocabulary, `safeStaging`, Director's review score + Apply fixes | `lib/director/beats.ts`, `recipes.ts`, `playbooks.ts`, `review.ts`, `components/DirectorReview.tsx` |

Order at plan time: Gemini planner (or `ruleBasedPlan` fallback) → `withShotChoices` (beats) → `withCoverageGrammar` → create route: Your cast, `assignSetups`, grammar again, `withContinuity`. At film time each shot's prompt is rebuilt by `formatShotPrompt` for the model actually called.

## What a film calls by default (no `DIRECTOR_*` flags set, which is how production runs today)

| Step | Service | Notes |
|---|---|---|
| Plan | Gemini on Vertex | Rules planner if Gemini fails |
| Cast sheet, anchor, storyboard frames | Gemini image models on Vertex (`GOOGLE_IMAGE_MODELS`, Pro first) | Reseller image endpoint only as a fallback if Vertex returns nothing |
| Video | The film's engine. `veo` = Veo 3.1 Fast, `veo31` = Veo 3.1, `veolite` = Lite, all on Vertex | Final = GA Veo 3.1 at 1080p, owner-only unless `DIRECTOR_FINAL_FOR_VEO31=1`. Ingredients (reference images) only on `veo31` or Final |
| Voice | **None**: the model's own voices | Voice lock needs the plan's lock turned on **and** an uploaded recording |
| Lip-sync / sync check | Paid lip-sync: **none**. Free sync check + wrong-voice check: **on** | See flags |
| Stitch | Modal `director-stitch` | Plain merge fallback |

## Flags (all read from the Vercel env unless marked Modal)

| Flag | Default | Effect | Read in |
|---|---|---|---|
| `DIRECTOR_TTS_ENGINE` | `turbo` | `standard` = Chatterbox standard instead of Turbo for lines spoken from a real recording (rollback) | `lipsync.ts` `ttsEngine()` |
| `DIRECTOR_LIPSYNC` | off | `kling` / `latentsync` / `sync2pro`: paid lip-sync per dubbed shot. **Only runs inside the voice lock** | `lipsync.ts` |
| `DIRECTOR_SYNC_CHECK` | **on** (since the 2026-09-30 review) | `0` turns it off. Free Whisper + MediaPipe check on our Modal CPU. Runs with or without the voice lock, flags bad takes for a retake, and includes the wrong-voice check (the speaker's expected register from their description vs the line's median pitch: `voice_mismatch`, a man's line >175 Hz or a woman's <150 Hz) | `lipsync.ts` `syncCheckEnabled()`, `voiceRegister()`; Modal `sync_check` |
| `DIRECTOR_FINAL_FOR_VEO31` | off | `1`: customers on `veo31` may pick Final (1080p, same price) | `videoQuality.ts` |
| `DIRECTOR_HERO_SAMPLES` | 1 | 2–4: owner-only, Final-only multi-takes of the hero shot (every take billed) | `videoQuality.ts` |
| `DIRECTOR_LOSSLESS_MASTER` | off | `1`: lossless Vertex output on Final | `videoQuality.ts` |
| `DIRECTOR_AUTO_INGREDIENTS` | on | `0`: stop auto reference-to-video for 2+ cast dialogue shots | `ingredients.ts` |
| `DIRECTOR_MODEL_FORMATTERS` | per model | `veo`: send the Veo dialect to every model (rollback) | `formatters.ts` |
| `DIRECTOR_LLM_SHORTEN` | on | `0`: never ask Gemini to shorten an over-budget prompt | `shortenPrompt.server.ts` |
| `DIRECTOR_SEEDANCE_REFS` | off | `1`: cast/set reference images on direct Seedance 2.x | `ingredients.ts` |
| `DIRECTOR_OWNER_SEEDANCE_2` | off | `1`: the owner's Seedance films use the 2.x model (billed). Seedance 2.x isn't activated on the account yet, so leave this off | `pipeline.ts` |
| `DIRECTOR_TTS_EXAGGERATION` / `DIRECTOR_TTS_CFG` | 0.7 / 0.3 | Expressive TTS settings | Modal, `director_voice.py` |
| `DIRECTOR_PRESET_SAFE` | on | Keeps the fine-tuned Lucy preset voices (Brad...) at exaggeration 0.48-0.72 / cfg 0.36-0.48 in `tts_acted`, because Sid's ear test found Brad distorted outside that. `0` removes the clamp. Turbo `speak()` from real recordings is never clamped | Modal, `director_voice.py` |
| `DIRECTOR_SYNC_MIN_SCORE` | 0.2 | Sync-check threshold | Modal, `director_voice.py` |
| Plan field `modelVoices` | unset = lock off | `false` = voice lock requested (studio checkbox) | `plan.ts` `voiceLockRequested` |

## Research and guides
- `docs/cinematic-grammar-playbook.md`: the cited rules behind PRs #42–#43.
- `docs/shot-pacing-research.md`, `docs/director-mode-cinematography-research.md`, `docs/seedance-2.5-official-prompt-guide-learnings.md`
- Voice: `docs/voice-reference-recording.md` (how to record the 60–120s acted reference) and `docs/voice-lora-recipe.md` (LoRA paused).
- The realism diagnosis and its example prompts (measured audio comparison of the gekko / chloe / Neilson clips, ranked root causes) are kept **out of this public repo**. Ask Sid for `lucy-realism-diagnosis.md` and `lucy-realism-example-prompts.md`.

## Open issues found in the 30 Sep review

Three of the four fixed on 2026-10-01 (see `STATUS.md`'s "2026-10-01" entry for the detail). Only #3 is still open, left intentionally.

1. ~~**Lines longer than Veo's 8s.**~~ **Fixed 2026-10-01.** `withCoverageGrammar`/`validateCoverage` now take an optional `engine` (`grammar.ts`'s `GrammarOptions.engine`) and clamp every shot to that engine's real cap (`VIDEO_PAYGO_ENGINES[engine].durationSeconds` from `videoEngines.ts`), with a new `engine_duration_cap` review issue when a line needs more time than the engine will ever grant. `grammar.MAX_LINE_WORDS` (20) is unchanged - it's a cross-engine ceiling, not the per-engine one - but the new check catches exactly the Veo-at-8s case regardless of word count.
2. ~~**Addressee in 3-person scenes.**~~ **Already fixed** (commit `9941949`, 30 Sep, same day as this review - the fix just predates this doc's last edit). `grammar.addresseeOf` now checks for a cast member's name said in the line itself before falling back to the neighbouring speaker. Re-verified 2026-10-01 with the dry run below: Liam's "Yes, Mr. Neilson." resolves to looking at Lawrence, not Jess.
3. **The rules fallback lighting can contradict the script** (e.g. "blue hour into night" in a "late afternoon" scene). This only happens when Gemini planning fails. **Still open** - left for later; lower priority and harder to verify without forcing a live Gemini failure.
4. ~~**Cast-sheet angles are always drawn.**~~ **Fixed 2026-10-01.** `AUTO_CAST_MAX_EXISTING` (`refs.ts`) is now 0, not 2: Lucy's auto cast sheet (1 face portrait + 3 `AUTO_CAST_ANGLES` stills) now only runs when the customer gave zero photos of their own - one photo is enough to skip it. The named "Your cast" flow already skipped this entirely (29 Sep), so this specifically fixes the direct-upload path.

## Neilson v2 test (dry run, free)
- Script: `web/src/lib/director/testdata/neilsonV2Test.ts`. v2 has 10 lines and a scene holds 8 shots, so it's split into two scenes. The **meeting** (6 shots, all three people, and Jess's MEFEE line that was garbled at 0:50–0:58) is the single test render. The **opening** (Lawrence on the phone, 4 lines) is a second scene for later.
- MEFEE is written "Mee-Fee" in the spoken line so both Veo's voice and Chatterbox say "mee-fee".
- Dry run (no network): `cd web && npx tsx src/lib/director/testdata/printNeilsonTestPlan.ts veo meeting`

## Sid to do
- Redeploy Modal after #40–#42 if that hasn't happened yet: `python3 -m modal deploy scripts/director_voice.py` and `scripts/director_stitch.py`.
- Record a 60–120s acted reference per recurring voice (see the voice doc) before turning the voice lock on.
- Pick which opt-in flags to enable. None are set in production.
