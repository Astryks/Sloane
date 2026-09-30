# Sloane Project Status

## Latest update, 2026-09-30 - Prompt Guide: Higgsfield car-commercial case study

- New credited entry in the home-page Prompt Guide (`web/src/components/PromptGuide.tsx`, anchor `/#higgsfield-car-commercial`): "Cinematic car commercial — dealership key handoff (Higgsfield)".
- Includes a short Lucy-voice breakdown (7 shots / 6 cuts; reference definitions + technical block + shot list + SFX; @names are locked reference images; best beats stitched from 4 generations), the official YouTube embed (youtube-nocookie, Higgsfield AI channel, `GNxmt_4IifA`, opens on the finished ad), the full prompt verbatim with a Copy button, and the credit "Prompt and video: Higgsfield Academy" linking to the source lesson.
- The prompt text lives in `web/src/lib/promptGuideHiggsfield.ts`. Embed only, no rehosted video. A hash deep link opens the collapsed "More tools" section.

## Latest update, 2026-09-30 - Coverage grammar: speaker on camera, 180-degree rule, character consistency (PR `director-coverage-grammar`)

Fixes Sid's "a character is speaking but the camera is on someone else" and shoots scenes like a proper movie. No paid calls were made, and there are no credit, pricing, Stripe or claiming changes. Shot counts never change.

- **New `grammar.ts`** (`withCoverageGrammar` + `validateCoverage`). Runs after planning (`planFilm`, `revisePlan`) and again in `/api/director/create`. It:
  - puts the speaker on camera (OTS or single on the speaker, or a two-shot with them in it); otherwise it turns the shot into a marked reaction shot (`setup: reaction:<Listener>`, `offscreenSpeaker: true`);
  - opens each scene on a wide master with everyone in it;
  - uses shot/reverse-shot, with sizes going wide → MCU → CU at the climax;
  - adds a reaction cutaway at a key beat;
  - removes back-to-back identical setups (jump cuts);
  - makes each line fit its shot.
- **180-degree rule:** `plan.screenSides` holds each character's side ("left"/"right") and per-shot `sides`. Eyelines point across the line, and every prompt and still says e.g. "Lawrence (…) on the left of frame looking right".
- **Planner:** the system prompt has a "Coverage grammar" section, and the rule-based fallback builds master → OTS reverse singles.
- **Prompts (Veo / Seedance / Kling):**
  - The line is attributed to the on-screen speaker by name, side and wardrobe, and says who stays silent ("Liam stays silent, mouth closed").
  - Reaction shots say the speaker is off-screen and the listener's lips stay still.
  - Each character has a fixed look string (`plan.castLook`) repeated verbatim in every prompt they appear in.
  - Group shots get +10 words of budget per person beyond two.
- **References:** each shot's refs are exactly the people in frame (speaker first, the same anchor photo every shot, never an off-screen speaker), then the set if a slot is free. Anyone in frame without a photo is flagged (`missingRefs`, `plan.refWarnings`, shown in the studio).
- **Voices:**
  - Reaction shots with the voice lock on: the line is recorded in the speaker's voice first and the listener is filmed silent.
  - `director_stitch.py` lays the line over the cutaway (ducking the clip's audio, up to 0.75s spill) and runs a 1s L-cut when the same speaker carries on over a reaction.
  - Reaction shots are never lip-synced.
  - Frames and continuous takes are keyed by camera + size family.
- **Sync check** (`DIRECTOR_SYNC_CHECK=1`, free, also runs without the voice lock):
  - `director_voice.py` tracks up to 3 faces and flags `mouth_on_non_speaker` / `speaker_mouth_closed`, using the speaker's screen side.
  - Flagged shots show "Lip-sync looks off … tap Retake".
- **Tests:** `grammar.test.ts` (13 tests) plus the Neilson idea fixture. `npm test` passes 49/49; tsc, build and py_compile are clean; eslint is no worse than main.

## Latest update, 2026-09-30 - Realism pass (PR `lucy-realism-v1`, NOT merged, nothing deployed)

Implements the realism diagnosis (§6 checklist) and Sid's Neilson review. No paid calls were made, and there are no credit, pricing, Stripe or claiming changes. Every new paid path is off by default.

- **Voices:**
  - Voice lock is **off by default**. It only runs for cast members with a real, consented uploaded recording (`/api/director/voice-sample`). Synthetic preset VC targets are retired (410).
  - Chatterbox 0.1.2 → **0.1.7 with Turbo** in `director_voice.py`. The new `speak` mode works zero-shot from the real recording, with `[chuckle]`/`[sigh]`… tags mapped from the acting intent.
  - Expressive defaults: exaggeration 0.7 / cfg 0.3, widened ranges.
  - Takes are joined with room tone and crossfades; atempo ≤1.1; scripted "um"s are no longer rejected.
- **LoRA:**
  - `07_finetune_new_voices.sh` is paused.
  - Corrected recipe: `12_finetune_expressive_lora.py`.
  - Guides: `docs/voice-lora-recipe.md` and `docs/voice-reference-recording.md`.
- **Prompts:**
  - Per-model formatters (Veo / Seedance 2.x / Kling 3.0) with word budgets, the line in the first third, and no brand stacks.
  - Gemini shortening only when clauses had to be trimmed.
  - A new director planner with a per-shot JSON schema (`shotSchema.ts`).
  - A continuity pass: every visible cast member on every shot, wardrobe held in `keep`, props carried over.
  - Steady hands (no clasped hands).
  - "Nobody speaks" on silent shots.
- **Vertex:**
  - `enhancePrompt:false` (with a retry without it), `negativePrompt`, and per-shot seeds.
  - Draft/Final quality: Final = 1080p on GA Veo 3.1, owner-only unless `DIRECTOR_FINAL_FOR_VEO31=1`.
  - Automatic Veo 3.1 ingredients for 2+ cast dialogue shots.
  - Opt-in hero multi-takes with a Take picker.
  - Opt-in lossless master.
- **Stitch:**
  - One film-level loudnorm (-16 LUFS).
  - Per-location room-tone beds from the model's own ambience.
  - Soft cuts, and L-cuts where a clip was trimmed.
  - Long 8s clips trimmed to the planned length.
- **Lip-sync (opt-in):**
  - `DIRECTOR_LIPSYNC=kling|latentsync|sync2pro`, plus a free sync check (`DIRECTOR_SYNC_CHECK=1`: Whisper word timing vs MediaPipe mouth-open, plus a gibberish check).
- **Seedance:**
  - Bug fixed: the reference audio never reached direct ModelArk.
  - Opt-in cast/set reference images (`DIRECTOR_SEEDANCE_REFS=1`).
  - Opt-in owner 2.x (`DIRECTOR_OWNER_SEEDANCE_2=1`).
- **Sid to do:**
  - Redeploy Modal (`python3 -m modal deploy scripts/director_voice.py`, `python3 -m modal deploy scripts/director_stitch.py`; `scripts/modal_app.py` for the `lucy_tts_engine` changes).
  - Record 60–120s acted reference voices.
  - Verify Veo 1080p pricing.
  - A/B test the expressive TTS settings (0.7/0.3 vs 0.6/0.4 - an old note says Brad distorted at extremes).
  - Choose which opt-in flags to enable.

## Latest update, 2026-09-29 (late) - Script clarity, speaker/off-screen, continuing lines; queued work

- **Shipped:**
  - Scripts up to 4,000 characters.
  - Every shot names who speaks. Off-screen lines ("heard but not seen") keep the on-screen person's mouth closed. (bracket) directions become delivery.
  - Shot prompts are rebuilt from the plan at filming time.
  - Lines running across a cut get no pause at the start and no falling ending ("↪ continues from shot N" on the card).
  - Calm, realistic background people doing ordinary desk work.
  - Labelled shot cards (Camera: framing/angle/move/length; What happens; Who speaks; Says; Where).
  - Remove button for saved cast/sets; saved cards can have their pictures replaced; set edit mode.
  - Liam redrawn in a navy suit, patterned tie and pocket square (old: "Liam (blue shirt)").
- **"Your movie" presets (LIVE):**
  - `director_presets` stores style/model/shape, cast ids, set id, movie notes (prepended to every scene) and the locked film look (the plan route overrides `plan.look`).
  - The last-used movie re-opens automatically (localStorage).
  - Sid's saved movie: "Astryks film" (Cinematic, Veo, 16:9, Liam + Jess, Astryks floor, LOOK/LIFE/SET notes, mid-morning 35mm look).
- **Planner fix:** output cap raised to 12288 (7-shot scripts had overflowed 4096 and fallen back); the fallback planner reads SHOT blocks. Shot cards warn when a line is over ~18 words (one 8s shot).
- **Queued item 2 is partly done:** the film look is now locked per movie. Loudness normalisation in the stitch is still to do.
- **Queued - do AFTER Sid's current film finishes (touches create/approve/stitch):**
  1. Free storyboards: charge only on Approve; 3 free per account per day, then $1 each; walk-away fee removed. Checkout moves to the Approve step.
  2. "Movie look" presets: save a film's look (stock, grade, palette, lighting, sound bed) and reuse it for every scene so 100 films feel like one movie; loudness normalisation (loudnorm) in the Modal stitch.
  3. New step 1: text or reference MP4 (Lucy analyses shots/camera/pace into a shot list); "?" guide with Claude/ChatGPT/Gemini links and a copy-paste prompt; optional in-app writing helper (our own AI account, priced first).

## Latest update, 2026-09-29 (night) - Realism fixes; cast and sets redrawn for review

- **Realism (code):**
  - Every shot now says "real-time, natural speed, never slow motion".
  - Shot length fits its line (about 2.6 words/sec, 4-8s), so short lines no longer stretch into slow motion.
  - The cinematic style's motion wording no longer says "slow".
  - Diagnosis of the "fake" test: Veo Lite, slow camera wording, empty backgrounds, glossy stills.
- **Reference scene studied** (`~/Downloads/gekko.mp4`, 22 shots in 2:44): handheld/Steadicam following, 2-15s shots, busy backgrounds, warm practical light, 35mm grain. Folded into Sid's paste-ready script (LOOK / LIFE lines).
- **Sets can have background extras** (`extras: true`). The back view is literal: same outfit, closed back.
- **Redrawn on support@:**
  - Jess (ivory long-sleeved V-neck knit, black trousers, belt; voice Harper; correct back).
  - Liam (full/back fixed to navy chinos).
  - Astryks floor, Astryks office (clothed Kirsty-style portraits - one nude painting was rejected) and Classic corner office, all with people.
  - Old versions renamed "(white shirt)", "(old trousers)", "(empty)".
- **Local copies:** `~/Documents/Lucy Movie` (Cast/, Sets/, Astryks logo.png; Old versions/).
- **Known limit:** with the room as a reference, the image model keeps redrawing the same view, so sets are saved as one strong view each.
- **Update:** Astryks office now has Rothko-style colour-field abstracts (Kirsty art version renamed "(Kirsty art)") and modern multi-screen trading desks. Astryks floor now has modern trading pods; the logo was fixed (the mark first, then the word) on the second draw; the old version was renamed "(80s terminals)". The Mac folder is updated.
- **Update:** Astryks office paintings are now green/purple Rothko-style, made with the new set **edit mode** (`edit` + one photo: change one thing, keep the rest). Text prompts kept producing classic red/orange Rothko colours. The saved card was updated in place (PATCH now accepts `photos`); the red version was renamed "(red Rothko)". All three characters are on the Veo voice, locked, with voice descriptions in their profiles.
- **Update:** Astryks office art is now three different pieces, made with three chained edits: a red/orange Rothko-style colour field, Monet's The Magpie (public domain, 1869; wide, with the magpie on the gate), and an original Cubist abstract. Picasso isn't copied, since it's still in copyright. The green version is kept as "Astryks office (green Rothko)".
- The Director form on lucylabs.app is pre-filled for Sid (script, Liam + Jess, Astryks floor, Cinematic/7/Veo/16:9). Not filmed.

## Latest update, 2026-09-29 (evening) - Voice lock across shots, office redraw, art in sets

- **Voice lock (LIVE, verified end to end):**
  - `scripts/director_voice.py` is the Modal app `director-voice` (L4, https://mehta-siddharth09--director-voice-web.modal.run; URL defaulted in code, auth `MODAL_SHARED_SECRET`).
  - How it works: Demucs splits speech from the room sound, Chatterbox VC converts the speech to a locked reference with the same timing (lip-sync kept), then it's level-matched and remixed on the untouched video.
  - New film stage `voicing` (named cast only). Each speaker's reference is their chosen Lucy voice (`saved_characters.voice_id`, picker on Your cast) or the speech from their first speaking shot, which keeps its audio. The planner outputs `speaker` per shot; the fallback is the name closest before "says".
  - Failures keep Veo's audio and never block the film.
  - Test: 2-shot Veo Lite film, Jess speaking in both. Shot 1 was extracted as the reference, shot 2 converted, stitched and completed. Standalone test on a 14s clip: identical timing.
- **Astryks office redrawn** (support@):
  - Central desk, modern dual-monitor trading desks with charts and tickers, no CRTs.
  - Backlit brushed-steel Astryks sign; Kirsty's portrait painting (astryks.com/art-preview) hung as art via the new `art` + `artPlacement` set option.
  - Old version renamed "Astryks office (old, 80s terminals)".
  - With 3 references the image model tends to copy the first view; explicit camera directions in the description fix that.
- **Also:** rename cast/sets from the picker; cast descriptions (voice/accent) go verbatim into every shot.

## Latest update, 2026-09-29 - Multi-character cast, Your sets + "Draw this place", scripts verbatim, /make-a-movie guide

- **Multi-character cast:** up to 3 people from Your cast per film.
  - They share the 8 character photo slots.
  - A who-is-who legend is added to every master-still and storyboard prompt, built from the final image order.
  - The planner gets the cast names, and `plan.character` lists each person.
- **Your sets:** saved locations (`saved_characters.kind='location'`). "Draw this place" makes a wide view from words, then main and reverse angles of the same room (`/api/director/location-sheet`).
- **Scripts:** pasted lines are kept word for word, in order, across up to 8 shots (`MAX_SHOTS` 5 -> 8).
- **Owner accounts** are uncapped on character and location sheets.
- **New `/make-a-movie` guide:**
  - Free helpers (ChatGPT, Gemini, Claude for scripts).
  - Characters once: photo rules, copy-paste prompt, how to describe a character.
  - Places once.
  - Script format and camera words, filming, joining scenes.
  - Linked from the Director panel, `/character-sheet` and the sitemap.
- **Sid's cast: saved** to his personal-email account.
  - Your cast: The Mentor (7 photos), The Broker (7), The Trainer (6; redrawn in a white open-collar shirt with a pendant via the new outfit option).
  - Your sets: "Astryks office" (2 angles). A vast dark office with the Astryks logo as a backlit brushed-steel sign, via the new logo option.
  - Note: `OWNER_EMAILS` is `support@astryks.com` only. On the personal email the sheet caps apply and films charge credit.
- **Copied to support@astryks.com (owner):**
  - Your cast: Jess (ex-Trainer; Australian voice), Liam (Brooklyn), Lawrence Neilson (soft husky British narrator voice). Voices are in the descriptions.
  - Your sets: Astryks office, Classic corner office, Astryks floor (lobby with brushed-steel logo -> office floor -> doors to the corner office).
- **Code:** cast descriptions (including voice/accent) go into every shot verbatim; rename cast/sets from the picker (PATCH); the "main" set angle is forced to a different camera position.
- **New options:** outfit change on character sheets (same face, new clothes); a logo built into drawn sets (`logo` + `logoPlacement`).
- **Next:** Sid sends the scene script -> plan and storyboard with Mentor + Broker in the office, review before filming.

## Latest update, 2026-09-27 (end of day) - Spec audit + pending list

Checked against the original spec (`~/Downloads/lucylabs_orchestration_engine.v2-original.md`).

- **Built:**
  - Intent planner and style classifier.
  - Style profiles: cameras, lenses, colour science, lighting, catchlights.
  - 25 emotion-mapped camera moves.
  - Anti-green-screen embedding.
  - Structured shot plan.
  - Async pipeline with status polling.
  - Character/product/location references (14 photos plus the auto character sheet).
  - FFmpeg stitch at 24fps with 192k audio and colour match (Modal).
- **Built differently, on purpose:**
  - The FastAPI/Docker/in-memory backend became Next.js API routes on Vercel with Postgres, with FFmpeg on Modal. The spec's code was mock only.
  - Gemini on Vertex replaces OpenAI for the planner (Google credits).
- **Missing from the spec:**
  1. Per-shot model routing (Veo wides / Seedance movement / Kling macro). We use one model per film so faces and grade stay consistent; could be an optional mode once Seedance is direct.
  2. Lucy Voices voiceover/narration and a music bed mixed into Director films. Only native model audio today.
  3. Fast ad pacing (~1.8s ASL). Veo's minimum is 4s, so shots need trimming at stitch.
- **Pending (outside the spec):**
  - Seedance direct: BytePlus activation / accelerator; then flip `NEXT_PUBLIC_SEEDANCE_DIRECT=1`.
  - Google for Startups credits: awaiting reply.
  - Google free trial (~$415 left): upgrade the billing account before it runs out, or Veo stops.
  - Offered, not started: masterclass batch tool (6 hours of video); H3 speed/cost benchmark on Modal.
  - Google image 429s under concurrent load: consider Provisioned Throughput when traffic grows.
  - As-built spec doc (`docs/lucylabs_orchestration_engine.md` + Downloads copy) needs today's features: 14 photos, auto character sheet, one-tap, recipes gallery, no-person prompt fix.

## Latest update, 2026-09-27 (late night, 2) - One-tap "Just make it", Lucy makes every character sheet, recipes gallery, cleaner copy

- **🎬 Just make it:** one sentence and one tap. Lucy plans, charges, casts, draws, films and stitches with no stops (`director_films.auto_approve` skips the review). It survives checkout. "Or check each step first" keeps full control.
- **Lucy makes the character sheet for every film with a person** (`cast_status`, a step before the master still):
  - No photo: a face portrait from the plan, then 3/4 left, 3/4 right and full body.
  - 1-2 photos: just the angles.
  - 3+ photos: skipped.
  - Failures never block the film. Finished films offer "Save to Your cast".
- **Bug fixed: no-person films were getting a person.** Face framing, "as they speak" moves, default micro-expressions and skin/eye realism made Veo add a woman to a pure perfume ad. There are now object-first sizes, moves, realism and placement rules. Verified: the remade perfume ad is product only.
- **Stronger no-captions rule.** A "TikTok ad" idea had drawn garbled caption text; verified clean on the remake.
- **"What you can make with one sentence"** gallery on the home page:
  - UGC, product, cinematic and explainer recipes, each with a real example made by one-tap on Lucy (`public/examples/recipe-*.mp4`), photos to add (with limits), 2 tips, and "Use this recipe" (fills the form).
  - "Borrow a movie's look": 6 official trailers (studio channels, oEmbed-verified: Dune Part Two, Blade Runner 2049, Mad Max: Fury Road, La La Land, Oppenheimer, Everything Everywhere), 2 shown, with "Try this look".
- **Cleaner copy (written for a 5-year-old):**
  - "Write one sentence. Get a finished film."
  - A "Who + does what + where + how it feels" formula with tap-to-try examples.
  - Photos and Settings collapsed, shorter tips, shorter comparison text.
- **Watch:** running 4 films at once hit Google image 429s on all three models (shared capacity for our project). They recovered via retries and the fallback, but it was slower. At volume, consider Provisioned Throughput, or send the fallback to the reseller sooner.

## Latest update, 2026-09-27 (late night) - Up to 14 reference photos, one-tap character sheet, easy guides

- **Several photos per slot:** Character (up to 8), Product (3), Location (3), 14 in total. 14 is the per-prompt image limit of `gemini-3-pro-image`, `3.1-flash-image` and `3.1-flash-lite-image` (7MB each).
  - The browser shrinks each photo to 1600px JPEG and uploads it on its own (`/api/director/upload`, 120/day per visitor). Vercel caps a request at 4.5MB, so they can't all go in one.
  - Photos now survive the Stripe checkout redirect, because their links are kept in the draft.
  - The master still gets every photo. Each storyboard frame gets `[redraw source, master, products, character angles, locations]` (`lib/director/refs.ts`).
- **"Make my character sheet":** from one photo, Lucy draws face, 3/4 left, 3/4 right, profile, full body and back on a plain background (`/api/director/character-sheet`, Google image, 3:4). It's free, with 18 angles per visitor per day, and runs 2 at a time.
- **Your cast** keeps the whole sheet (`saved_characters.photo_urls`).
- **Guides:**
  - "New here? 6 easy steps" in the Director panel.
  - "Which photos should I add?" tips.
  - A new `/character-sheet` page: angles diagram, a real example made on Lucy, 3 ways to make a sheet, copy-paste prompts, what goes in each box, location embedding explained, checklist, FAQ. It's in the sitemap and linked from `/consistent-character`.
- **Verified live:**
  - Uploaded 1 photo, generated the 6-angle sheet in about a minute (same face in every angle), saved to cast with 7 photos.
  - Drew a 2-shot storyboard from all 7 photos: both frames came from Google and show the same person in a new scene.
  - Cancelled, refunded $5.48, and deleted the test character.
- **Watch:** props in the source photo can leak into scenes; the guide tells users to use photos with nothing in their hands.

## Latest update, 2026-09-27 (night) - Director: Google storyboard frames, colour-matched stitch, character library, faster API

All four are live and were tested in production with a real 2-shot Veo Lite film:
- **Faster API:** database setup now runs once per server instance instead of on every request. The first call after a deploy takes ~17s; after that calls take 0.3-0.5s (they took 10-20s before).
- **Storyboard frames on Google (Vertex):** the models are tried in order: `gemini-3-pro-image` (Nano Banana Pro), then `gemini-3.1-flash-image`, then `gemini-3.1-flash-lite-image`. The old reseller image path is kept as the fallback. Override the list with `GOOGLE_IMAGE_MODELS`.
  - The first deploy used the wrong ID (`...-preview`, 404), and Lite hit a 429 quota error, so frames fell back; this is fixed in 496ea2f.
  - Confirmed: frames are now 1376x768 PNGs from Google and no errors are logged.
  - There is no Lite quota to raise: Gemini image models run on Google's shared capacity. Pro's limit is 34M requests/min. When Google returns a 429 ("busy"), the code retries after 2s and again after 5s, within a 40s total budget, then falls back (60f5515). Re-verified live: 2/2 frames came from Google.
- **Colour-matched stitch:** `scripts/director_stitch.py` is a Modal app (`director-stitch`, async `/start` and `/result`, Bearer `MODAL_SHARED_SECRET`).
  - It keeps audio (adding silence to shots that have none), conforms size and 24fps, and nudges each shot's colour toward shot 1, by at most 10% per channel.
  - Vercel env: `MODAL_DIRECTOR_STITCH_URL`. If Modal fails, the plain merge is used instead.
  - Confirmed: the production film was stitched on Modal (10s, 720x1280, AAC stereo).
- **Character library:** "Your cast" lets users save a person (photo, name, description) and tap them into any film. It is available to guests too, and merges into their account at sign-in.
  - Confirmed: saving, reusing (the same face carried into a new film), deleting.
- **Walk-away refund** re-verified: a $7.98 2-shot film cancelled at review refunded $5.48.

Next:
- Seedance direct: waiting on BytePlus activation/accelerator; flip `NEXT_PUBLIC_SEEDANCE_DIRECT=1` when it is live.
- Films stay on the current storage (decided 2026-09-27: no move to Blob).

## Latest update, 2026-09-27 (evening) - "Directed by Lucy" live: intent-aware multi-shot films with storyboard approval

- **What it is**: homepage generator now has "One video" / "🎬 Directed by Lucy". One idea (+ optional character/product/location photos) -> Gemini 3.8 Flash on Vertex plans goal (sell/story/explain/promote/entertain), style, one film look, per-shot setting/lighting, shot size/angle/one camera move, dialogue -> customer edits (fields or plain-words revisions, free, 20/day/visitor) -> pays -> master still + per-shot storyboard frames -> **review** (5 redraws/film, text edits, cancel) -> approve -> one model films every shot from its frame -> stitched film with audio. Full spec: `docs/lucylabs_orchestration_engine.md` (also copied over the user's `~/Downloads/lucylabs_orchestration_engine.md`; original kept as `...v2-original.md`).
- **Pricing**: per shot = tier price + $1 direction fee ($3.99 standard / $4.99 premium). Worst-case filmed profit $1.67/shot (intl card, all redraws); walk-away keeps $1/shot, min $2.50 (>= $0.44/shot). Exact-amount Stripe checkout for films.
- **Verified live**: planner outputs for ad/UGC/cinematic ideas; full UGC film run incl. one redraw and approval; homepage "Directed by Lucy vs. a plain prompt" section with the real violinist comparison (files in `web/public/examples/`). Veo 3.1 Lite added (standard tier, ~$0.46 cost).
- **Fixes from live testing**: Veo `personGeneration` now `allow_all` (children were silently filtered; auto-fallback to adults-only), Veo filter reasons logged; storyboard prompts forbid collages/grids.
- **Known limits / next**: no colour-match pass at stitch yet; frames via Nano Banana Pro (reseller) - consider Google's image model; status polls are ~15-20s each (initSchema on every request - worth caching); character library + trained identity on the roadmap.

## Latest update, 2026-09-27 - Veo direct on Google (live + verified), two price tiers, Seedance fallback, startup credit applications

- **Veo -> Google Vertex AI directly (LIVE, verified)**: first production Veo 3.1 Fast clip generated end to end on lucylabs.app (8s, 1280x720, native audio, served from `/api/media/...`, stored in Vercel Blob `lucy-generations`, billed to Google credits). Code: `web/src/lib/vertexVeo.ts` (routing token `vertex:<model>`), keyless auth = Vercel OIDC -> Google Workload Identity Federation (org policy blocks SA key files and SA-bound API keys).
  - GCP project `project-3aa3e7a0-d347-4b12-a73` (number 473780390380, org `support-org`, owner support@astryks.com), billing account `017D56-E283EC-17DA08` (free trial, ~A$417 / 90 days). APIs enabled: Agent Platform (aiplatform), IAM Service Account Credentials. SA `lucy-labs-veo@...` (role Agent Platform User). WIF pool/provider `vercel` (issuer `https://oidc.vercel.com/astryks`, audience `https://vercel.com/astryks`, `google.subject=assertion.sub`); SA grants Workload Identity User ONLY to `owner:astryks:project:sloane:environment:production`.
  - Vercel prod env: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=us-central1`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID=vercel`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel`, `OWNER_EMAILS=support@astryks.com`.
  - Budget alert "Lucy Labs - monthly Google spend": A$150/month, gross usage (credits NOT netted), emails at 50/90/100%, alerts only (no spend cap - a cap would pause Veo for customers).
  - New engine `veo31` (Veo 3.1 standard, 4s cap; ~$0.40/s w/ audio). Available but not yet wired: **Veo 3.1 Lite** (`veo-3.1-lite-generate-001`, ~$0.05/s w/ audio at 720p per the Studio page) - strong candidate for a cheap standard-tier engine.
- **Two price tiers + USD-cent wallet**: standard $2.99 (MiniMax, Grok, Veo 3.1 Fast; Seedance 2.0 when direct), premium $3.99 (Kling 2.1, Kling v3, Veo 3.1, Seedance 2.5; Seedance 2.0 while on fallback). `video_credits.balance_cents` (old credits converted at $3.99), jobs store `price_cents`, Checkout `price_data` packs: single standard/premium, $20-for-$18, $40-for-$35. SQL verified on PGlite (found+fixed a guest-merge zeroing bug).
- **Owner test mode**: `OWNER_EMAILS` accounts generate paygo videos without Stripe (vendor still bills).
- **Seedance**: back on the reseller path until BytePlus activates the models; flip `NEXT_PUBLIC_SEEDANCE_DIRECT=1` in Vercel + redeploy to go direct (then Seedance 2.0 -> standard tier, 2.5 -> 8s). BytePlus account: $10 prepaid balance ("Pay by credits" - switch to automatic billing before going direct or it stops at $0), card on file, Free Credits Only Mode ON (turn off when going direct). Cheapest pack: Seedance 2.5 "Light Plan" $32 / 5M tokens / 3 months / non-refundable (~16-29 8s 720p clips). Monthly Savings Plans exclude Seedance - skip.
- **Startup credits applied (2026-09-27)**: Google for Startups Cloud Program (Start tier, AI startup; reply in 3-5 business days, up to $2k to billing account above) and BytePlus AI Startups Accelerator ($2k non-threshold, up to $100k; "we will be in touch").
- **White-label**: mediaProxy also proxies BytePlus/volces/GCS/Vercel Blob URLs and scrubs ModelArk/BytePlus/Vertex names; Vertex error bodies are logged server-side only.
- **MiniMax H3 (open weights)**: license excludes US/EU/UK/KR (we host in the US) - not used; Mac inference ~45min+/clip. LTX-2 is the better open option if ever needed.
- **Director layer**: knowledge base `web/src/lib/director/filmScience.ts` committed (unused yet); planner/compiler/pipeline/UI next.

## Latest update, 2026-09-24 - ModelArk key live; Seedance activation blocked on ~$30 pack

- **Code**: [#39](https://github.com/Astryks/Sloane/pull/39) on `main` (squash `60ed3dc`); STATUS note `be4c37f`. Production redeploy with new env **READY** (`dpl_5rEznALtKLwhweqspgmR3zh6VGEp` → lucylabs.app).
- **Routing**: Seedance 2.0 (`seedance`) + 2.5 (`seedance25`) → BytePlus ModelArk (`web/src/lib/modelArk.ts` + `videoInference.ts`). Kling / Veo / MiniMax / Grok stay on fal.
- **Vercel env (set, all targets)**:
  - `BYTEPLUS_ARK_API_KEY` (sensitive) — key name in ModelArk console: `lucy-labs-production`
  - `BYTEPLUS_ARK_BASE_URL` = `https://ark.ap-southeast.bytepluses.com/api/v3`
  - `BYTEPLUS_SEEDANCE_20_MODEL` = `dreamina-seedance-2-0-fast-260128`
  - `BYTEPLUS_SEEDANCE_25_MODEL` = `dreamina-seedance-2-5-260628`
- **ModelArk account**: Region **ap-southeast-1**; ~$10 USD credits; Free Credits Only Mode enabled; **no** Resource Pack / AI Savings Plan purchased (Sid: do not buy yet).
- **Activation gate (blocker)**: Console left Dreamina Seedance **2.0 / 2.0-fast / 2.5** as **Not activated**. Confirm after Free Credits Only Mode still requires purchasing a **$30+ AI Savings Plan or Resource Pack**. No purchase made.
- **Smoke test**: `POST …/contents/generations/tasks` → HTTP **404** `ModelNotOpen` (key + path OK; model not open). No task ID.
- **Billing / UX**: Users still buy Lucy Stripe credits only. Prefer ModelArk PAYG once models open; treasury notes ModelArk funding on video-credit purchase. No Fal/BytePlus/ModelArk in user-facing copy. Missing ARK key → Lucy-branded 503 before credit spend.
- **COGS** (ModelArk 720p +15% buffer): seedance Fast 8s ≈ **$1.10** (~$2.47 after Stripe); seedance25 8s ≈ **$2.13** (~$1.44). Flat $3.99; Seedance 2.5 default 8s. ACR ~$14k/yr (faces/QPM) **not** required for basic API — not purchased.
- **Next steps (Sid)**:
  1. When ready: buy smallest ~$30 Resource Pack / AI Savings Plan in ModelArk, then activate Seedance 2.0 / 2.0-fast / 2.5.
  2. Re-run smoke test until a task ID returns (not `ModelNotOpen`).
  3. Spot-check one Seedance paygo clip on lucylabs.app (Lucy-only UX).
  4. Optional later: fal sales / invoice auto-recharge (still no public buy API); ACR only if faces/QPM needed.

## Prior, 2026-09-24 - Seedance → BytePlus ModelArk (not fal)

- **Merged**: [#39](https://github.com/Astryks/Sloane/pull/39) on `main` (squash `60ed3dc`).
- **Routing**: User-facing **Seedance 2.0** (`seedance`) and **Seedance 2.5** (`seedance25`) — paygo, product-ad, ad-studio, grid-storyboard — submit/poll via ModelArk. Kling / Veo / MiniMax / Grok stay on fal.
- **Env**: Documented in `web/.env.example` (now also set on Vercel — see latest update above).
- **Billing**: Lucy Stripe credits only; prefer postpaid PAYG; treasury logs ModelArk funding note.
- **COGS / ACR / UI**: Same as latest update; ACR not purchased; vendors invisible in UI.

## Latest update, 2026-09-23 - Camera moves + job hubs + filmmaking study library

- **Shipped**: `/camera-moves` hub (Seedance-ready phrases matching Prompt Guide chooser); job hubs `/ugc-ad`, `/ai-music-video`, `/storyboard-to-video`, `/consistent-character`; `/video-styles`; `/model-reviews` (cited public sources only); inspiration `/ad-inspiration`, `/award-winning-ads`; trailers/scenes `/study-trailers-and-scenes` (official YT embeds); IMDb-inspired `/study-great-films`; craft hubs long takes / openings / music videos / TV titles / Oscar cinematography / composition / blocking; parent `/study-film`.
- **Plumbing**: sitemap, llms.txt / llms-full.txt When to recommend, Footer + SiteNav, cross-links from pillar + prompting.
- **Hard rules**: no Fal/Higgsfield; no Midjourney-as-Lucy; official YT embeds + links only (no ripped trailers); honest Seedance hyper-real + music-video sync caveats; GPT Image preferred for stills.

# Sloane Project Status

## Latest update, 2026-09-23 - AI video SEO hubs (pillar + models + intents)

- **Intent**: Cluster organic/LLM visibility into hubs — avoid thin doorway spam — covering AI video generation, models (Seedance 2.0/2.5, Veo, Kling), text/image to video, stills, voice, prompting, stitch/storyboard, and few strong alternatives.
- **Shipped**:
  - Pillar `/ai-video-generation` (+ permanent redirect `/ai-video` → pillar)
  - Models hub `/models` + `/models/seedance|veo|kling`
  - Intents: `/text-to-video`, `/image-to-video`, `/text-to-voice`, `/ai-prompting` (gateway → `/#prompt-guide`)
  - Alternatives: `/alternatives/runway` (mentions CapCut AI/InVideo), `/pika`, `/luma`, `/elevenlabs` secondary; removed thin Kling-alt (Kling lives under /models)
  - `llms.txt` / `llms-full.txt` When to recommend + all intents/URLs; sitemap; Footer + SiteNav discreet links; shared `seoFaq` helper
- **Hard rules**: no Fal/Higgsfield in public copy; no identical-to-competitor claims; honest Seedance hyper-real caveat

## Latest update, 2026-09-23 - Native-audio honesty on paygo engines

- **Problem**: Homepage Sound helper said "Only Veo can speak on its own…" and Veo's picker note claimed it was the only native-voice engine — understating Seedance 2.5 / Kling v3 (both pass `generate_audio` in `buildFalInput`) and not naming which engines stay silent.
- **Source of truth**: `supportsNativeAudio: boolean` on `VideoEngineInfo` in `web/src/lib/videoEngines.ts`.
  - **Native audio path**: Veo (production-proven), Seedance 2.5, Kling v3.
  - **No native audio** (silent unless own audio / Lucy voice): Seedance 2.0, Kling 2.1, MiniMax, Grok — picker notes append "no native audio — add your own or a Lucy voice" via `videoEnginePickerNote`.
- **UI**: Sound blurb under More options driven by `videoEnginesSoundBlurb()`; engine chips use `videoEnginePickerNote`. Generate-route comment aligned. AI models review / Prompt Guide had no conflicting audio claims. No Fal/Higgsfield in UI.

## Latest update, 2026-09-23 - Free LLM-visibility steps shipped

- **Intent**: Free discovery in ChatGPT / Perplexity / similar assistants — not only classic Google SEO.
- **Shipped** (same PR as organic SEO):
  - `web/public/llms.txt` + `web/public/llms-full.txt` — plain factual Lucy Labs summary (video/stills/voice, free /stitch, /ads storyboard; no Fal/Higgsfield; honest Seedance hyper-real caveat).
  - `robots.ts` — explicit allow for GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended (same public allow / private disallow as `*`).
  - Public `/about` — crawlable HTML facts + visible FAQ; FAQ JSON-LD only for those visible Qs; in sitemap; Footer link.
- **Optional later (Sid)**: Product Hunt / AlternativeTo listings; submit sitemap in Google Search Console when GSC is available.
- **Not done here**: paid ads; GSC setup requiring Sid's Google login.

## Latest update, 2026-09-23 - Free organic SEO pass shipped

- **Intent**: Make lucylabs.app crawlable and shareable without paid ads — proper titles/descriptions, sitemap, robots, OG/Twitter, JSON-LD, one visible homepage H1.
- **Shipped**:
  - Root `web/src/app/layout.tsx`: `metadataBase` https://lucylabs.app, title default + `%s | Lucy Labs` template, richer default description (AI video / stills / voice), Open Graph + Twitter `summary_large_image`, robots index/follow, Organization + WebApplication JSON-LD (Lucy Labs only — no Fal/Higgsfield).
  - `web/public/og.png`: simple brand card (1200×630) generated for OG/Twitter images.
  - Route layouts with unique titles/descriptions: `/ads`, `/stitch`, `/billing`, `/privacy` (indexable); `/account`, `/admin`, `/ad-studio` → `noindex,nofollow`.
  - `web/src/app/sitemap.ts` — public only: `/`, `/about`, `/ads`, `/stitch`, `/billing`, `/privacy`.
  - `web/src/app/robots.ts` — allow public; disallow `/api/`, `/admin`, `/account`, `/ad-studio`.
  - Homepage `SiteNav` H1: **AI video, stills & voice** (visible near top of generator card; layout unchanged otherwise).
- **Optional next (needs Sid)**: Submit `https://lucylabs.app/sitemap.xml` in Google Search Console if/when GSC is set up — not done here (requires Sid's Google login). No paid ads / Search Console automation in this pass.
- **Out of scope**: mass `next/image` migration; product-claim renames that contradict known truths (Seedance hyper-real people = direct only; no Fal in UI).
## Latest update, 2026-09-23 - Stripe→Fal vendor treasury (ledger shipped; auto-buy blocked)

- **Intent**: When users buy **still** or **video** credit packs via Stripe, Lucy should automatically buy matching **Fal prepaid credits** for COGS and keep the margin — no manual Fal balance babysitting.
- **Shipped (Lucy-side ledger)**:
  - `vendor_treasury` table + `recordVendorTreasuryEntry` / `markVendorTreasuryStatus` in `web/src/lib/db.ts` (idempotent on `stripe_event_id`).
  - COGS helpers in `web/src/lib/vendorTreasury.ts`: stills = `floor(creditsCents/19)×15¢` (GPT-equivalent × ~$0.15 Fal still cost, capped); video = `max(VIDEO_PAYGO_ENGINE_COST_USD)×credits` (worst-case buffered engine, currently Kling v3 / Seedance range).
  - Stripe `checkout.session.completed` webhook (`still_credits` + video pack branches) records a row after a successful grant, then calls `attemptPurchaseFalCredits`.
- **HARD BLOCKER — true auto-buy not available**: Fal’s public Platform API only documents **GET `/account/billing?expand=credits`**. There is **no** documented purchase-credits / auto-recharge HTTP API. `attemptPurchaseFalCredits` does **not** invent fake payment calls; it returns `{ ok: false, reason: 'no_public_api' }`, optionally probes balance, and sets status **`blocked_no_api`**. Settling needs **Fal sales / invoice / dashboard auto-recharge** (or a future public buy API), then mark rows **`settled`**.
- **Statuses**: `pending_fal_purchase` → `blocked_no_api` (today) | `settled` (manual later / when API exists).
- **Vendor invisible**: no Fal/Higgsfield in client UI; treasury is server-only bookkeeping next to existing balance-guard cron.

## Latest update, 2026-09-23 - User-facing copy accuracy audit

- **Audit**: homepage paygo / AI models review, Prompt Guide, `/ads` practice storyboard copy vs known truths.
- **Inaccuracies found & fixed**:
  1. AI models review used permanent ranking (“Kling and Veo are the best” / Seedance “by far the best”) → snapshot framing (“In that Harper comparison, Kling and Veo looked strongest”) + Seedance hyper-real people = direct only; Lucy cannot get those results.
  2. Paygo multi-upload comment claimed every engine only takes one still → clarified most single-scene engines use one; Seedance can use multiple refs; Lucy paygo still sends one.
  3. Paygo helper “Tap one…” implied engine limit → now says Lucy sends one still per clip; Seedance can use multiple refs.
  4. Prompt Guide “Practical Lucy hyper-real” / “hyper-real Lucy clips” implied Lucy delivers hyper-real people → Seedance-direct recipe + intro caveat.
  5. `/ads` practice line “animate each square… for real” could imply Start animates the practice grid → explicit: Starting a storyboard creates a real project; does not animate the practice grid.
- **Already correct**: practice grid browser-only / not uploaded; GPT Image & Nano Banana Pro on Lucy labeled as Lucy products; no Fal/Higgsfield in UI.
- **Also**: PR #28 (paygo prompt `text-sm`) merged; PR #26 closed as superseded; PR #27 (trim notes + storyboard CTA) confirmed on `main`.

## Latest update, 2026-09-23 - Homepage AI models review; cinematic section removed

- **Where**: lucylabs.app homepage (`web/src/app/page.tsx`) + PromptGuide cross-link.
- **ProductAdSection**: title **Our review of the AI models**, `id="ai-models-review"`; Sid lead copy as Card subtitle; Harper + tumbler thumbs kept; Kling / Grok / MiniMax / Veo / Seedance switcher + videos kept. Seedance `blockedReason`/note: best for hyper realistic when used **directly**; we offer it on Lucy but **cannot** get hyper realistic through us. Kling + Veo called strongest of the in-Lucy comparison; tumbler disclaimer kept; lip-sync caveat trimmed under the lead.
- **Removed**: `CinematicExamplesSection`, `CINEMATIC_STORYBOARD`, `MODEL_SHOWCASE_PROMPT`, `TryYourOwnPromptCTA`. Page order: … → AI models review → **Free video editor** → …
- **Links**: SiteNav + PromptGuide `#harper` → `#ai-models-review`.

## Latest update, 2026-09-23 - /ads Lucy stills stay on page (inline generate canvas)

- **Problem**: Make stills **GPT Image on Lucy** / **Nano Banana Pro on Lucy** chips linked to `/#prompt-guide` and left `/ads`.
- **Fix**: Extracted `StillGenerateBox` → `web/src/components/StillGenerateBox.tsx` (Prompt Guide + Ads). `/ads` empty state shows large inline generate canvas (preview + textarea + Generate on Lucy / stills-paygo + collapsed Prompt guide tips). Lucy chips are buttons with `onSelectLucyEngine` (set engine + scroll/focus canvas) — never navigate home. Outside tools stay new-tab links; soft “Prompt guide (stills)” / full guide link remain secondary only. Stripe checkout accepts safe `returnPath` `/` or `/ads` so pack buy from Ads returns to `/ads?stills=1`. No fal/Higgsfield; pricing/auth unchanged.

## Latest update, 2026-09-23 - Lucy still options on /ads

- Added primary **GPT Image on Lucy** and **Nano Banana Pro on Lucy** chips to the shared stills strip; outside generator links and Prompt guide remain available.
- `/ads` now labels both in-app engines explicitly and defaults still, reference, and refinement generation to GPT Image. Prompt Guide `StillGenerateBox` already had both Popular Lucy chips.

## Latest update, 2026-09-23 - Still generate preview canvas (Prompt Guide + /ads)

- **Where**: `StillGenerateBox` in `web/src/components/PromptGuide.tsx` (GPT Image / Nano Banana Pro on Lucy) + empty `SlotCard` generate path in `web/src/app/ads/page.tsx`. APIs / pricing / auth untouched.
- **UX**: Always-on large **aspect-video** preview frame (`min-h-72` on Prompt Guide) — empty cream/dashed placeholder (“Your still will appear here”), stable loading overlay (spinner + Generating…), then `object-contain` result in the same box + Download still. Prompt textarea + Generate / engine chips kept as the generate stack. Collapsed **Prompt guide (tips)** `<details>` under controls (compressed character/location + GPT tip) + **Open full Prompt guide** → `/#prompt-guide`. /ads SlotCard empty state gets matching aspect-video empty frame above upload/cinematic/refs/generate + the same tips accordion. No sample image faked in empty frame. No fal/Higgsfield in UI.

## Previous update, 2026-09-23 - /ads Make stills outbound links (GPT + generators)

- **Where**: empty state under **Start a storyboard** on `lucylabs.app/ads` (`web/src/app/ads/page.tsx`) + practice note in `AdsHowToStoryboard.tsx`. Shared strip: `MakeStillsOutboundLinks.tsx`. Create/auth APIs untouched; practice grid stays browser-only (no upload).
- **UX**: Primary CTA unchanged. Muted line: stills first — make them here after you start, or outside and upload into each scene. Compact new-tab chips (noopener): ChatGPT / GPT Image, Gemini, Midjourney, Ideogram + `/#prompt-guide` (existing hash). Flux skipped (Prompt Guide “via other tools” / no clean generator URL). No fal/Higgsfield; no iframes; does not claim Start animates demo drops.

## Previous update, 2026-09-23 - /ads teaching: museum study links + 15-cell practice grid

- **Where**: `lucylabs.app/ads` How-this-works card (`web/src/components/AdsHowToStoryboard.tsx`). Real ReferenceLibrary / SlotCard / Start storyboard / APIs untouched.
- **Layout (Sid)**: Title + Hide. **(1)** Big JoJo Facebook finished-ad embed. **(2)** JoJo storyboard stills grid. **(3)** Outbound Academy Museum credit links (Hitchcock Story gallery + Spielberg Jaws exhibition) — open in new tab; short note we don't host their boards. **(4)** Empty practice drop grid: **15 cells (5×3 desktop, fewer cols on small screens)** + **+ Add cell**; `URL.createObjectURL` / revoke only — muted note: photos stay in this browser only and are not uploaded. Hide + homepage `#jojo-case-study` link kept. No Hitchcock/Spielberg artwork hosted. No fal/Higgsfield in UI.

## Previous update, 2026-09-23 - /ads teaching: video → storyboard → practice drop grid

- **Where**: `lucylabs.app/ads` How-this-works card (`web/src/components/AdsHowToStoryboard.tsx`). Real `ReferenceLibrary`, `SlotCard`, Start storyboard / APIs untouched.
- **Layout (Sid)**: Title **Storyboard → finished ad (real example)** + Hide. **(1)** Big JoJo finished-ad Facebook embed at top. **(2)** 8 JoJo storyboard stills in a row/grid under the video (`/public/product-showcase/jojo/`, Scene 1–8 captions). **(3)** Client-only practice drop grid below (“Your scene 1…” + Drop or choose photo + optional **+ Add cell**; `URL.createObjectURL` / revoke). One-liner: directors plan stills first, then animate — Start a storyboard below for real. Cast-strip competing demo removed.
- **Homepage**: `#jojo-case-study` one-line cross-link → `/ads` practice layout. No Hitchcock/Star Wars scrapes. No fal/Higgsfield in UI.

## Previous update, 2026-09-23 - /ads How-this-works → interactive storyboard grid

- **Where**: `lucylabs.app/ads` onboarding card (`web/src/app/ads/page.tsx` + new `web/src/components/AdsHowToStoryboard.tsx`). Real `ReferenceLibrary`, `SlotCard`, start/add/stitch APIs untouched.
- **UX**: Replaced long numbered list + tiny flowchart boxes + dense “The details” bullets with a plain title (**Your storyboard is a grid of scenes**), **3 short steps**, and a **client-only demo**: Cast strip (Character / Location / Product drop tiles with `URL.createObjectURL` previews) + comic-strip **storyboard grid** (Scene 1/2 + “+ Add scene”; each card = still drop zone then “Then animate → video” placeholder). Hide kept. “More tips” collapsed `<details>` (4 lines). JoJo + cinematic links shortened. One-line pointer: real grid is below after Start a storyboard.
- **Mobile**: cast strip scrolls; scene grid 1-col → 2/3-col desktop. No fal/Higgsfield in UI.

## Previous update, 2026-09-23 - Prompt Guide live on production + Vercel build unblocked

- **Production**: lucylabs.app is on merge `b34c2e7` (PR #16). Homepage `#prompt-guide` title **Prompt guide to make hyper realistic videos** is live (accordion steps, Faces/angles, director pack, camera + expression choosers, red `[bracket]` fill-ins, Popular = Lucy GPT Image / Nano Banana Pro only).
- **Why Vercel kept failing**: every recent Preview/Production deploy died in `web/src/app/stitch/largeFileExport.ts` importing `FFFSType` from `@ffmpeg/ffmpeg`. Turbopack SSR resolves that package to `empty.mjs` (no `FFFSType` export), so main could not ship while an older successful build stayed on the domain. **Fix (PR #16)**: use a `"WORKERFS"` string constant instead; local `next build` green; Production deploy status **success**.
- **Also shipped same day (PRs #9–#15, #14)**: hyper-real Seedance templates (`0s-3s`, `@Image` map) · visual CameraMoveChooser + ExpressionChooser (CSS/SVG mini-loops, Seedance-ready Copy prompts) · accordion + Lucy Popular / Others honest picks · copyright-safe DirectorTechniquePack (**43** cards: directors incl. Tarantino/Spielberg/Scorsese/Woody Allen, feature grammar, ads, music video) · Faces/angles/embedding step · paygo textarea helper copy pointing at the guide · still Stripe packs + images-left tracker (earlier).
- **Product call — real GIFs**: keep original CSS/SVG mini-loops for now (copyright-safe). Optional later: Lucy-made muted loops only — do **not** rip trailers/ads/MVs.
- **Still to confirm with real traffic**: first still-pack purchase → generate → images-left drop; first guest video paygo E2E (webhook → auto-generate → `/api/media/...`).
- **Vendor invisible**: fal/Higgsfield stay out of client UI.

## Previous update, 2026-09-23 - Prompt Guide: Faces, angles & embedding + red fillables audit

- **Where**: homepage `#prompt-guide` (`web/src/components/PromptGuide.tsx`). New accordion step **4. Faces, angles & embedding** (after Embed character in place). Later steps renumbered: Hyper-real Seedance video → 5 · Style paths → 6 · Camera + expression craft → 7 · Lessons from great directors → 8 · Longer cuts / stitch → 9. Accordion, Popular Lucy-only, CameraMoveChooser, ExpressionChooser, DirectorTechniquePack, StillGenerateBox, hashes, fal invisible — preserved.
- **Step 4 content (Sid-approved)**: JSON usually not required (organizes thinking; models care about refs + physical language; structured blocks OK; `{json}` rarely improves pixels; API JSON for settings is separate) · Hyper-real consistent faces (lock stills first; split full-body + chest-up; if drift add 3/4 + profile; practical Seedance **2–4** key refs soft **1–8**; bind `@Image1` once) · Angle counts (min 1 good sheet; stronger front+3/4+profile ~3–4 + body; 8+ near-duplicates hurt) · Natural embed (empty `@Image2`; place `@Image1`; relight; feet planted + contact shadow + scale; living breath/weight; one camera move/beat; match weather/colour temp) · pasteable cream templates with red `[bracket]` fill-ins.
- **Red fill-ins**: kept/extended `renderRedFills` / `PasteBox`; top-of-guide label “You fill these (red)”; StillGenerateBox placeholders/helper call out red `[blanks]`; location default uses bracketed `LOCATION_STILL_PROMPT`; embed paste boxes + location craft chip + full block structure templates use `[…]` for user blanks.
- **Vendor invisible**: no fal/Higgsfield in guide UI.

## Previous update, 2026-09-23 - Expand Director technique pack (directors + feature + MV)

- **Where**: homepage `#prompt-guide` step **7. Lessons from great directors** — `web/src/components/DirectorTechniquePack.tsx` + `dir-anim-*` mini-loops in `web/src/app/globals.css`. Accordion, red fill-ins, Popular Lucy-only, CameraMoveChooser, ExpressionChooser, StillGenerateBox, hashes preserved. No fal/Higgsfield in UI.
- **Expand**: **43** original technique cards with group filter chips (All / Cinematic / Feature / Ads / Music video) so the accordion stays neat.
- **Counts**: **Cinematic / directors (17)** — kept prior 10; added Wonder crane rise (Spielberg-style), Tracking through space + Freeze-energy hold (Scorsese-style), Low trunk-angle stare + Long tense hold (Tarantino-style), Conversational walk-and-talk + Nervous off-center frame (Woody Allen–style); refreshed nods on realization push-in / steadicam float. **Feature / classic grammar (7)** — Epic wide establishing, Intimate over-shoulder confession, Dutch unease tilt, Silhouette doorway reveal, Rain night neon track, Desert heat-haze lock, War trench push. **Ads / hero reveal (9)** — prior 7 + Mirror/reflection reveal, Slow pour beauty. **Music video (10)** — Beat-cut energy (continuous), Silhouette dance orbit, Whip-pan chorus hit, Slow-mo hair/fabric float, Tunnel walk toward camera, Neon night drive, Intimate lip-sync hold, Crowd crash-in, Rooftop wide dance lock, Handheld pit energy.
- **Copyright-safe**: technique names + optional “in the spirit of…” director nods; **no** ripped trailers, movie frames, Super Bowl ads, MV footage, or YouTube embeds. Illustrations = original CSS/SVG loops only.
- **Seedance**: Copy prompts = concrete camera/frame + physical action, one move per beat; tip line preserved; aligns with `docs/seedance-2.5-official-prompt-guide-learnings.md`.
- **Mobile**: 2-col → 3/4 grid unchanged; filter chips wrap.

## Previous update, 2026-09-23 - Director technique pack on Prompt Guide

- **Where**: homepage `#prompt-guide` — new `web/src/components/DirectorTechniquePack.tsx`, CSS mini-loops in `web/src/app/globals.css`, wired as accordion step **7. Lessons from great directors** in `PromptGuide.tsx` (Longer cuts / stitch → step 8). `#jojo-case-study`, StillGenerateBox, CameraMoveChooser, ExpressionChooser, red fill-ins, Popular Lucy-only preserved. No fal/Higgsfield in UI.
- **Product**: copyright-safe chooser cards studying camera *language* of great films / Super Bowl–style ads conceptually — **no ripped trailers, no ad clips, no copyrighted footage**. Original CSS-animated SVG mini-loops only.
- **Groups**: **Cinematic** (10) — One-point corridor push, Realization push-in, Clinical lateral track, IMAX-feel wide lock, Handheld chaos → lock, Predatory slow push, Steadicam float follow, Dust-haze silhouette crane, Symmetry center hold, Low-angle power rise. **Ads / hero reveal** (7) — Product hero orbit, Whip to logo endcard, Tabletop macro glamour, Crowd-to-product crash zoom feel, Emotional cutaway hold, Hands-first product intro, Lifestyle soft wipe feel. Optional UGC cross-link in ads blurb → Style paths.
- **Each card**: technique name (generic; short lineage nods OK) · Lesson · When · **Copy prompt** Seedance-obedient concrete frame/body language (one move per beat; aligns with `docs/seedance-2.5-official-prompt-guide-learnings.md`).
- **Tip**: “Phrases below are written the way Seedance follows — paste into one timed beat.” Footnote: illustrations are original CSS/SVG, not from films or ads.
- **Grid**: 2 cols mobile → 3/4 desktop (same as other choosers).

## Previous update, 2026-09-23 - Prompt Guide accordion + red fillables + Lucy Popular + animated choosers

- **Where**: homepage `#prompt-guide` (`web/src/components/PromptGuide.tsx`, `CameraMoveChooser.tsx`, new `ExpressionChooser.tsx`, CSS mini-loops in `web/src/app/globals.css`). `#jojo-case-study` + StillGenerateBox credit tracker / packs / generate path preserved.
- **Accordion**: main guide is seven collapsed-by-default `<details>` steps — Character still · Location still · Embed character in place · Hyper-real Seedance video · Style paths (cinematic / UGC / history-influencer) · Camera + expression craft · Longer cuts / stitch. Scannable list; click to expand.
- **Red fill-ins**: cream `PasteBox` templates auto-render `[bracketed]` blanks in `text-red-500` (character/location/hyper-real Seedance paste boxes).
- **Popular = Lucy-only paid**: GPT Image + Nano Banana Pro (prices on chips + Generate). ChatGPT removed from Popular.
- **Others**: ChatGPT, Gemini, Midjourney, Flux, Ideogram — outside links + honest one-liner each. **Best for hyper-real stills → Seedance: GPT Image** (on Lucy or ChatGPT). Midjourney = stylized beauty via midjourney.com (no public API). No fal/Higgsfield in UI.
- **Animated choosers**: CSS-animated SVG mini loops (not third-party GIFs) on every camera-move card + new Expression chooser (smile, laugh, soft blink, furrowed brow, look-to-camera, look-off, whisper, long exhale, eyebrow lift, sharp inhale, lips-press→smile, weight shift). Copy phrases are Seedance-obedient concrete frame/body language (aligned with `docs/seedance-2.5-official-prompt-guide-learnings.md` + Seedance camera notes) — tip: “Phrases below are written the way Seedance follows — paste into one timed beat.”
- **Vendor invisible**: stills sanitize + no fal/Higgsfield copy in guide UI.

## Previous update, 2026-09-23 - visual Camera move chooser on Prompt Guide

- **Where**: homepage `#prompt-guide` (`web/src/components/PromptGuide.tsx` + new `web/src/components/CameraMoveChooser.tsx`). StillGenerateBox / Stripe still packs / JoJo `#jojo-case-study` / Steps 1–2 Popular/Others unchanged.
- **UX**: Step 5 (after the three style paths) ships a **Camera move chooser** — responsive card grid (2 cols mobile → 3/4 desktop). Each card: SVG diagram, title, one-line *does*, one-line *when*, **Copy prompt** (Seedance-ready phrase). Moves: dolly in/out, push-in, track L/R, orbit/arc, tilt up/down, pan L/R, handheld, static lock-off, crane/rise, whip pan, rack focus (text-only).
- **Nice-to-have**: same pattern as compact copy-chip rows for expressions, blink/breath/weight, and background motion (no extra binary assets).
- **Step 6**: craft chips kept; camera chip body points at the visual chooser; no fal/Higgsfield/third-party tutorial embeds.
- **Never tell users to Google** — phrases are copy-ready in-product.

## Previous update, 2026-09-23 - hyper-real Seedance Prompt Guide (modular craft + 3 style paths)

- **Where**: homepage `#prompt-guide` (`web/src/components/PromptGuide.tsx`). StillGenerateBox / Stripe still packs / JoJo `#jojo-case-study` unchanged in behavior.
- **Title**: GuideCard is now **Prompt guide to make hyper realistic videos** (subtitle: Character + location stills → named @Image refs → per-second Seedance beats).
- **Step 4 — Hyper-real Seedance video**: paste template with REFERENCE MAP, inventory/continuity locks, timed beats in Seedance `0s-3s` syntax (not `0:00`), CONSTRAINTS (no subtitles, pores, relight, one move per beat). Teaches image counts: 2.0 ~9 refs / 2.5 ~30 images / soft best 1–8 subjects / practical Lucy **2–4** images with explicit `@ImageN is…` binding.
- **Step 5 — three full style paths** (each with image map + tweak notes + per-second paste prompt): **A Cinematic short**, **B UGC product selling**, **C History-influencer explainer** (modern Gen Z host in period location — never period costume; original Lucy prompts).
- **Step 6 — mix-and-match craft chips**: skin/pores, physical expressions, location details, camera angles+when-to-choose, anti-mannequin micro-motion, background motion, lighting/continuity, @Image naming, per-second beats — scannable chips, not a wall.
- **Vendor invisible**: no fal / Higgsfield / Soul ID / Cinema Studio in guide copy. Prefer Seedance by name; Veo/Kling ok as alternatives.

## Previous update, 2026-09-23 - free /stitch editor: large-file export, independent audio, mask/unmask, Draft vs Final

- **Where**: free browser editor at `lucylabs.app/stitch` (`web/src/app/stitch`). No Stripe/CLAIMING changes in this work.
- **Large multi-GB sources**: Export no longer copies whole originals into ffmpeg MEMFS. Clips/overlays/audio are mounted via **WORKERFS** when available; only the **selected trim window** is extracted into a small temp file, then the existing scale/concat/xfade pipeline runs. Soft warnings talk about *selected-section payload*, not raw upload size. Progress shows “extracting section from large file…”.
- **Independent audio under later clips**: On each main-sequence clip — **Lift audio** creates a dialogue bar from that clip’s current trim and mutes the clip; **Audio thru** does the same and extends the bar through the end of the main sequence (clip1 dialogue under clip2+clip3, then lift clip4 later).
- **Timeline usability**: Fit uses the real scroll-container width; zoom can go down to ~0.5px/s; dragging near edges auto-scrolls; long projects prefer Fit; duration badges on blocks; “Use entire source” confirms when the file is >5 minutes.
- **Mask / unmask**: Drag the **amber left/right edges** on a video (or audio/overlay) bar to crop start/end. **Right-click** a clip to **unmask** — video restores `trim` to the full source (with the same long-file confirm as “Use entire source”); audio restores `sourceStart`/`sourceEnd` to the full file (mirrors “Use entire audio”, track stays); overlays restore full source window and expand the bar. Already-full clips no-op. Hint under the timeline: “Drag amber edges to mask start/end · Right-click clip to unmask”.
- **Draft vs Final export**: **Download Final** (default path) ≈1080p, `veryfast`, CRF 18, loudnorm. **Download Draft (faster)** ≈720p, `ultrafast`, CRF 23, skips loudnorm / lower AAC bitrate — for timing/layout checks before a Final deliverable.
- **Honest residual limits**: Exporting an uninterrupted full ~45-minute / multi-GB window is still heavy in single-thread wasm. Multi-thread ffmpeg-core was **not** wired: it needs COOP/COEP / `SharedArrayBuffer`, and this app does not set those headers today (would risk breaking other pages). Follow-up if Sid wants a measured MT speed pass. WORKERFS depends on `@ffmpeg/ffmpeg` 0.12.x + browser File support (Chrome/Edge best). If WORKERFS mount fails and the file is >500MB, export refuses a full `writeFile` rather than risk tab death.

## Previous update, 2026-09-23, evening - cleaned Prompt Guide + Stripe still credits (images-left tracker)

- **Done for this ask (merged to `main`)**: PRs [#4](https://github.com/Astryks/Sloane/pull/4) (six-step Prompt Guide), [#5](https://github.com/Astryks/Sloane/pull/5) (Stripe still paygo + simpler Steps 1–2), [#7](https://github.com/Astryks/Sloane/pull/7) (images-left tracker + stills panel in `#pay-as-you-go`). Tip of main at this writeup: `ca50616`.
- **Prompt Guide** (`web/src/components/PromptGuide.tsx`, `#prompt-guide`): character → location → embed → style paths (UGC / cinematic / bullet time) → craft details (collapsible) → longer cuts + `/stitch`; JoJo + `#jojo-case-study` kept. Steps 1–2: go to ChatGPT or pick below → example → short guide → paste box → **Popular** / **Others** generators. End of guide seeds video prompt + engine into pay-as-you-go.
- **Still credits (prepaid packs, not single $0.19 Checkout)**: GPT Image **19¢**/still, Nano Banana Pro **29¢**/still; packs **10 for $1.90** (190¢) and **25 for $4.50** (475¢). Stripe Checkout `price_data` (no new `STRIPE_PRICE_*` env); product names **Lucy Labs still credits (N)**; webhook grants via `metadata.product === "still_credits"` before video packs. Routes: `/api/stills-paygo/{checkout,balance,generate}`; DB `still_credits` + `still_credit_grants`; guest merge moves still balance with video.
- **Images-left tracker**: `stillImagesLeft()` — GPT = `floor(balanceCents/19)`, Nano = `floor(balanceCents/29)`. Shown in Prompt Guide `StillGenerateBox` and homepage `StillCreditsPaygoPanel` inside `#pay-as-you-go`. Downloads use `lucy-still.{ext}`; media proxy already serves `lucy-labs.{ext}`.
- **Vendor invisible**: stills use `generateImageVariants` + `publicJson` / `/api/media` — no fal names/URLs in UI, links, Stripe labels, or download filenames.
- **Still to confirm on production traffic** (no inference keys on the build machine for a live dry-run): first real still-pack purchase → webhook credit → Generate on Lucy → proxied image + images-left decrement. Same open item as video: first real paid guest video end-to-end.
- **Open follow-ups (unchanged / related)**: dedicated `MEDIA_URL_SECRET`; privacy-policy lawyer pass; mobile vendor-free release + mobile sign-in for clone; optional deeper `/ads` prefill from guide (`?prompt=` only today).


## Previous update, 2026-09-23, later - vendor (fal) fully hidden from visitors; header joined into the generator card

- **Deployed to production (`b53c148`) and checked live on lucylabs.app, 2026-09-23**: new layout + joined header render; zero vendor mentions in the live homepage HTML, all 9 of its JS bundles, and `/privacy`; `/api/media` route live (rejects tampered tokens); guest (no-signup) Stripe checkout issues a real session, charged in **USD** (US$3.99 confirmed on the live Checkout page); all 7 model entries map to the correct model.
- **Margins (checked 2026-09-23)**: worst case Kling v3 10s + GPT-6 Astra; profit/video after Stripe fees $1.23-1.29 (single), $1.10-1.15 (5-pack), $1.03-1.08 (10-pack; thinnest - +$1 to $36 adds ~10c/video). If the Stripe account is Australian, a ~2% currency conversion fee on USD payouts could put the 10-pack worst case ~$0.96 - still profitable, check Stripe's real fee breakdown.
- **Still to confirm with real traffic**: first real paid guest video end to end (webhook credit -> auto-generate -> video plays from `/api/media/...`), and the GPT-6 Astra call via fal's OpenRouter endpoint.
- **Open follow-ups**: set a dedicated `MEDIA_URL_SECRET` env var before links get shared widely (otherwise rotating `STRIPE_SECRET_KEY` breaks old media links); lawyer review of the genericized privacy-policy processor wording; ship the mobile app update (vendor-free copy/images, relative media URLs) and give mobile a sign-in flow so voice cloning works there again.

- **Per direct request, no visitor can see the inference vendor anywhere** - not in UI copy, links, error messages, media URLs, or the page's JS bundle:
  - Every API route now returns through `publicJson()` (`web/src/lib/mediaProxy.ts`), which rewrites any vendor media URL to `/api/media/<encrypted-token>.<ext>` and replaces vendor-naming error text with a generic message. `/api/media/[token]` streams the real file (Range/206 supported for video seeking; tampered tokens 404; only vendor-CDN URLs we encrypted decode, so it's not an open proxy). Key = `MEDIA_URL_SECRET`, else derived from `STRIPE_SECRET_KEY` - **rotating either breaks previously-issued media links**.
  - URLs the browser sends back (grid-storyboard reference create/generate) are decoded with `resolveMediaUrl()`; `/stitch`'s preload allow-list now accepts same-origin `/api/media/` only.
  - Client-safe catalogs split from vendor endpoints: `videoEngines.ts` (picker data) vs `videoPaygo.ts` (server-only endpoints, merged back into the same `VIDEO_PAYGO_ENGINES` shape so server code is unchanged); same split for `adStudioModels.ts` / `productAdModels.ts`; preset character photos now served from `/public/characters/`, with the model-input copies server-only in `characterImages.ts`.
  - Removed the "see its example gallery" links; picker notes no longer mention production cost. Privacy policy now names "our AI inference infrastructure provider" instead of the vendor (disclosure of the processor kept - get it legally reviewed). Mobile app updated the same way (ships with the next app release).
  - Verified: production build's client bundle + every page's HTML scanned for vendor names/URLs/endpoints - zero hits; media route streamed a real file byte-identical, 206 range works, tampered token 404s.
- **Header** (logo + nav) now sits inside the top of the generator card instead of a separate box; model-card badges top-aligned.

## Previous update, 2026-09-23 - generator-first homepage, no-signup video checkout, GPT-6 Astra prompt director, clone requirements

- **Homepage reordered** (per direct request): 1) the video generator - prompt box, model picker (all 7 engines, Popular first), "$3.99 per video, no signup", Pay & generate; 2) prompt guide (steps, rules, templates, style examples, JoJo case study); 3) Harper; 4) cinematic examples (moon shot, Kling dub, 4-shot breakdown); then the free editor; voice (text to speech, then clone) last. Duration/ratio/photo/audio moved behind "More options".
- **Pay-as-you-go video needs no account.** `/api/video-paygo/checkout` creates a guest `users` row (`is_guest`, placeholder `@guest.lucylabs.invalid` email) + session cookie when nobody is signed in, so the existing webhook -> `client_reference_id` credit path is unchanged. `getSessionUser()` never returns a guest (every other feature keeps its old meaning); only the paygo routes + paygo downloads use `getPaygoSessionUser()`. Signing in later merges the guest's credits, jobs and grant ledger into the real account (`mergeGuestIntoUser`). Checkout now returns to `/?video_credits=1#pay-as-you-go`; the prompt/model/settings are saved in sessionStorage across the redirect and the paid video auto-starts once the credit lands (photos/audio can't survive the redirect, so those drafts ask to re-attach instead).
- **GPT-6 Astra prompt director** (`web/src/lib/promptDirector.ts`, optional checkbox). Astra is text-only (OpenAI's docs list video output as unsupported), so it can't be a video engine - it rewrites the user's idea into a shot brief before submission, via fal's `openrouter/router` + existing `FAL_KEY` (model `openai/gpt-6-astra`), ~$0.03/video, runs only after the credit is spent, falls back to the user's prompt on any failure. Sora 2 deliberately not added - its API shuts down 2026-09-24.
- **Voice cloning requirements shown before signup**: account (new server-side requirement in `/api/clone-voice`), paid plan (existing), and per clone: whose voice it is (own / named person with permission, recorded in `consent_records`) + the typed consent statement. A Stripe Identity ID-check step was built and then removed per direct request - no ID check.
- Verified: `next build` + `tsc` clean, eslint at the pre-existing baseline; the new SQL (guest creation, credit grant replay, guest->account merge, non-guest safety) run against a real in-memory Postgres (PGlite); checkout return / cancel / media-draft / auto-generate flows driven in a browser with mocked APIs. **Not yet verified against production services** (no env on this machine): first real guest purchase, and the Astra call through fal.
- **Known follow-up**: the mobile app has no web session, so its clone-voice screen now gets "Create an account or sign in" - needs its own sign-in flow to clone.

## Previous update, 2026-09-22 - aligned Director Mode with ByteDance's official Seedance 2.5 prompt guide

- Found and read the real, official "Dreamina Seedance 2.5 Prompt Writing Guide" (ByteDance's own vendor docs, publicly mirrored at docs.byteplus.com/en/docs/ModelArk/2607689) - materially more authoritative than the third-party research this was previously built on. Full learnings in `docs/seedance-2.5-official-prompt-guide-learnings.md`.
- **Two concrete correctness fixes**: `buildTimedStoryboard`'s timestamps now match Seedance's own documented syntax exactly (`"0s-3s"`, not an invented `"0:00-0:03"` clock format - this string is sent directly to the model); added the vendor's own explicitly-recommended default negative constraint, "Do not add subtitles," to both output functions (also fixed a run-on sentence this surfaced).
- **Validated, not changed**: the existing "Build a cinematic scene" composite prompt and camera-move library already matched the guide's own recommended patterns (asset-binding phrasing, pairing niche technical terms with plain-language explanations).
- **Two real next-step candidates flagged, not built**: native storyboard/keyframe image input (Seedance natively accepts a sequence of images as strict keyframes or a loose-reference storyboard - materially different from text-only beat descriptions), and ByteDance's own official prompt-optimization skill (installable via npx, not run without the user's awareness).

## Previous update, 2026-09-21, later - timed per-second storyboards, real shot-pacing data, 550+ entry world library

## Latest update, 2026-09-21, later - timed per-second storyboards, real shot-pacing data, 550+ entry world library

- **`buildTimedStoryboard()`** (`web/src/lib/directorMode.ts`) - splits a clip into real, timed beats (per direct request: "give directions per second"), each with its own camera move, a specific micro-performance detail (real acting vocabulary - eye emotion, micro-expressions), and dialogue-scene detection that applies the real off-screen-voice reaction-shot/L-cut technique when the prompt reads as a two-person exchange.
- **Real, academically-sourced pacing data** grounds `PACE_PRESETS` - see `docs/shot-pacing-research.md` (James Cutting/Psychological Science 2010, MacLachlan & Logan/Journal of Advertising Research 1993, Stephen Follows/Cinemetrics, Barry Salt/Bordwell). Genuinely counter-intuitive finding kept as the real default: horror averages slower shots (15.7s) than any genre but deliberate slow cinema.
- **3 real bugs found and fixed** by testing an actual quiet dialogue prompt against the assembled output, not just reading the code - documented in `docs/director-mode-world-library.md`. All three were fallback-logic gaps that compounded on ambiguous, non-action prompts (a dialogue scene defaulting to "handheld camera shaking in rhythm with sprinting").
- **New `web/src/lib/directorModeElements.ts`** - 550+ verified-unique entries: wardrobe (105, male/female/kids), character archetypes (109, male/female/kids/animals), objects (209 across 21 categories), locations (36), cities (46), culture/cuisine (20), music mood (25), dialogue languages (36). City/culture/music/language auto-detect and wire directly into the expanded prompt; wardrobe/characters/objects are exposed for a picker UI not yet built into `/ads` - a real, noted scope boundary, not silently left undone.
- **Honest capability note**: the music-mood library only influences native model-generated audio via text prompt - not reliable for specific controllable music. Real, audible background music would need a separate licensed-track library muxed via `/stitch`'s existing multi-track audio system - flagged as a follow-up, not built (license verification per track is its own task).
- Verified: `tsc --noEmit`/`eslint` clean; full regression suite re-run after each fix via real Node integration tests; `/ads` compiles and serves with zero errors.

## Previous update, 2026-09-21 - Director Mode, cinematic scene builder, voice-clone restrictions

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
- **Voice Cloning:** Requires a signed-in account + any paid tier (`starter`/`plus`/`video` - this project has no `pro`/`enterprise` tiers), a declared voice owner, and a typed, exact-match consent statement.
- **Unit Economics:** Cost per video minute modeled at ~$0.097 maintaining >65% margins.

- 2026-09-23: Trimmed AI models review — removed per-model notes, Harper script, lip-sync/caveat paragraphs, and storyboard CTA (one-photo claim was too absolute).

## 2026-09-29 - Veo 3.1 best quality, BytePlus check
- Veo 3.1 standard ("Veo 3.1 (best quality)") now films up to 8s (was 4s, which cut lines off). Own price $4.99 single / $5.99 per Director shot (cost ~$3.68 at 8s). Director picker shows full model names (Veo 3.1 Fast vs best quality).
- BytePlus ModelArk: Seedance 2.0, 2.0-fast and 2.0-mini all refuse activation ("balance and coupons lower than the reserved amount") with the $10 balance + Free Credits Only Mode on. Seedance 1.5 pro is active with 2M free tokens (docs list it as retired). No BYTEPLUS_ARK_API_KEY set yet - owner must create it in the console and add it to Vercel.

## 2026-09-29 (evening) - where we stand
- Neilson office scene 1 filmed on Veo 3.1 best quality (8 shots, 56s): ~/Documents/Lucy Movie/Scenes/Neilson office - scene 1.mp4. Sid's verdict: looks fake. Known faults: extra man behind Lawrence in shot 3, black bar on shot 5's right edge, mobile->desk phone jump shots 2-3.
- Lessons: saved movie notes carried the Astryks set into Neilson's classic office (fixed per film by editing the plan); shot text must be saved before a redraw or the redraw uses old text.
- Spend: Google free trial shows A$37.69 used of A$417.14 (A$379.45 left); tonight's film (~A$37) not yet billed. Owner's Lucy credit is auto-refunded, so only vendor costs are real. Kling/Seedance through Lucy cost ~US$2/shot on the backup provider balance.
- Vercel (Hobby, never billed - pauses at limits): deployment storage was 105% (10.5/10 GB), active CPU 68% of 4h. Retention for the sloane project set to 1 day (canceled/errored/preview) and 1 week (production). Director status polling slowed to 10s while filming, 30s in hidden tabs.
- BytePlus: Seedance 2.0 / fast / mini all refuse activation (reserve > balance). 1.5 pro active with 2M free tokens. Next: Sid creates API key -> Vercel BYTEPLUS_ARK_API_KEY.
- Next up, in order:
  1. Model test: same shots (3 Lawrence, 8 Jess) on Seedance 2.0 (dreamina.capcut.com) and Kling (kling.ai) free tiers - needs Sid signed in. Frames + prompts in ~/Documents/Lucy Movie/Scenes/Model test/.
  2. MP4 / YouTube upload in step 1 - Gemini watches the clip and writes the shot list (camera, staging; own dialogue).
  3. Quality gap vs Higgsfield / Chloe vs History: try Veo reference-image mode (no drawn first frame), grittier stills, single-speaker takes, Kling 3.0.
  4. Lip-sync dub (Lucy voice -> Kling lipsync -> room sound mix); Modal tts/mix modes already deployed.

## 2026-09-29 (night) - rebuild after Higgsfield / Chloe research
Research summary (sources in the session; key points):
- Higgsfield resells Seedance/Kling/Veo/Wan and wins on the *settings*: a per-film camera body, lens, lighting and grain ("the prompt describes what happens, the settings describe the world"), Soul ID trained faces, Elements with @tags, grading after generation.
- Chloe vs History = one creator (Jonathan Laramy) using Claude for scripts and Seedance 2.0 for video, 9:16 handheld-selfie clips stitched into roughly 1-minute videos. Probably ElevenLabs voice and CapCut. The personality in the writing does most of the work.
- Best practice: one speaker per shot, imperfect (handheld, grain, real skin), real room sound, no over-clean first frames, reference images for consistency.

Shipped tonight:
- **Copy a clip** (step 1): paste a YouTube link or upload an MP4 (client upload to Blob, up to 100MB, deleted after watching). Gemini watches it and writes the shot list in Lucy's script format for your cast, with new dialogue (never transcribed). Tested with a YouTube trailer (20s) and a 6MB MP4 (40s). Routes: /api/director/clip-upload, /api/director/analyze-clip.
- **Camera format per film** (plan look): 35mm film (default), 16mm raw, cinema digital, phone / selfie vlog (default for UGC). Its wording goes into every shot and still.
- **Realism pass** in the prompts: a human camera operator (micro-jitter, or tripod drift), candid skin, stray hairs and lived-in sets in the stills and shots, real room sound with no music, the subject off-centre and only the people the shot needs.
- **Stitch finish** (Modal director-stitch, deployed): light moving grain on every shot, per-shot loudness normalisation, click-free cuts, continuous faint room tone under the film.
- **Veo 3.1 "ingredients"** option (plan look checkbox, Veo 3.1 best only): films from the real cast and set photos (max 3) instead of a drawn first frame. Always 8s (a Veo requirement). Falls back to the storyboard frame if Veo refuses the references.
- **Free storyboards**: "Check each step" charges nothing up front (3 free a day, then $1, taken off the film). The film is charged on Approve, with a Stripe top-up and auto-approve on return. "Just make it" still charges up front. Column director_films.paid_cents.
- **Retake this shot**: after filming, re-film one shot with an optional note. It's charged at the shot price, re-voiced and re-joined. Several retakes can run at once.
- **Selfie vlog recipe** with a real demo (/examples/recipe-vlog.mp4, Veo 3.1 + phone format).
- **Script helper**: one speaker per shot, personality and verbal habits, numbers as words.
- **Owner Seedance test** on free BytePlus tokens: 1.5 pro is retired (API NotFound). Seedance 1.0 pro was activated (free 2M tokens) and the owner's "Seedance" films use it (no sound). The comparison is in ~/Documents/Lucy Movie/Scenes/Model test/: Seedance 1.0 looks more like real film than Veo but is silent.
- Kling free tier: refused non-members at peak ("system busy"). Everything is set up in Sid's account (54 credits, 720p 6s), so press Generate off-peak. Dreamina's free credits don't cover Seedance video (paywall).

Not built / next:
- Seedance 2.0 direct needs a BytePlus top-up above the reserve (2.0 fast is roughly US$0.7 per 8s at 720p, far cheaper than resellers). Then switch the owner test model to seedance-2-0-fast-260128 or seedance-2-0-260128.
- Lip-sync dub (Lucy voice -> Kling lipsync) costs money on the backup provider, so it isn't wired; the Modal tts/mix modes are ready.
- Model per shot (Veo close-ups, Kling two-shots), automatic bad-take detection, Soul-ID-style trained faces.

## 2026-09-30 - coverage, continuous takes, voice-first
- **Coverage** (on by default for 2+ people): a wide master + over-the-shoulder singles/two-shots on each person (partner = who they talk to), each drawn ONCE (singles as edits of the master) and reused by every shot from that camera; 85mm OTS framing, eyelines beside the lens, continuity wording. lib/director/coverage.ts. Tested on the Neilson plan -> 5 setups for 8 shots.
- **Continuous takes**: a shot from the same setup as the one before (or every shot when "One continuous take" is on, default for vlogs) starts on the previous shot's exact last frame (Modal director-stitch /lastframe). Shots then film in order.
- **Voice-first for Seedance 2.x** (owner BytePlus path, untested until 2.0 is activated): the line is recorded first in the speaker's Lucy voice and sent as reference_audio, so Seedance acts and lip-syncs to it; no voice swap afterwards. Takes up to 15s. To switch on: top up BytePlus, activate Seedance 2.0 (fast), set BYTEPLUS_OWNER_SEEDANCE_MODEL=seedance-2-0-fast-260128 (dreamina- prefix fallback built in).
- **Acting in Lucy voices**: each line's (stage direction) now drives Chatterbox exaggeration/cfg_weight (whisper / firm / excited / warm).
- **Keep model voices** option (skips the voice swap).
- Seedance 2.0 won't take real-looking faces; BytePlus trusts its own outputs (Seedream 5.0 lite images, Seedance frames), so the cast should be re-made in Seedream on BytePlus.
- Chloe vs History (confirmed by the creator): Claude for scripts; PAI 2 (Utopai), Nano Banana Pro and ChatGPT for images; Seedance 2.0 for video; an unnamed AI voice model for consistency (ElevenLabs is inferred); editing unconfirmed (probably CapCut).
- **Lucy voice acting pass** (2026-09-30): lib/director/voiceActing.ts. Gemini acts as voice director and splits each line into phrases with intent, exaggeration, cfg_weight, speed and pause (the words are verified unchanged, with a heuristic fallback). director-voice `tts_acted` generates each phrase with its own settings and joins them. Used by voice-first Seedance shots and the new "🔊 Hear X say it" button (/api/director/act-line). Before/after samples are in ~/Documents/Lucy Movie/Scenes/Model test/.
- Training note: the voice data and LoRAs live on the Modal volume `lucy-tts-models`, and this Mac (M1 Pro, 16GB) has only ~11GB free. More LoRA training on the same flat podcast clips won't add emotion (the project notes record our fine-tunes and Qwen3-TTS as "monotone"). A useful training run would be an "expressive" LoRA on only each voice's most animated clips (select by pitch/energy variance), best run on Modal next to the data.
- **Site clean-up** (2026-09-30): the homepage is now the header + two tabs ("✏️ One video" / "🎬 Directed by Lucy"). Voices, the free editor, recipes, the vs-plain demo, the prompt guide and the model reviews moved under a collapsed "🧰 More tools" (opens automatically for old #voice / #prompt-guide links). Directed by Lucy is 3 steps:
  1. Characters: CharacterGuide with the Jess and Liam 6-angle sheets, the prompt and Gemini/ChatGPT links, then the photo/cast/set area.
  2. What's your movie about: a prompt to take the idea to Claude/ChatGPT/Gemini, plus Copy a clip.
  3. Directed by Lucy: "make my shot sheet (free)" as the main button; "copy the shot sheet for my AI" and paste its edited sheet back (revise accepts a pasted sheet of up to 6000 chars and keeps the film settings).
  Lawrence's sheet was left out of the public examples because his face resembles a well-known actor.
- **Wrong-voice bug**: v2 shots 4-5 (Lawrence) measured 171/239 Hz, i.e. a woman's voice, because a failed voice swap silently kept the model's own voice. Fixes: everyone who speaks gets a Lucy voice (namesake preset, or chosen by gender/age), failed swaps retry once then flag the shot "voice didn't lock - Retake", and director-voice convert rejects results whose pitch is far from the speaker's reference.
