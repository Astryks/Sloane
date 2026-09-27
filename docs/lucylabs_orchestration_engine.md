# Directed by Lucy - Orchestration Engine (as built)

Version 3.0 - 2026-09-27. Supersedes the 2.x "FastAPI / Celery / Docker" draft spec. This document describes what is live on lucylabs.app, why it differs from that draft, and how to run and extend it.

---

## 1. Vision

A person types one line - "a UGC review of my coffee tumbler", "a woman walking through Tokyo after a breakup", "a 20-second ad for my energy drink" - and gets back a **finished, directed, multi-shot film**, not one random clip.

Lucy acts as the director, cinematographer and editor:

1. **Understands intent.** Are they selling something, telling a story, explaining/teaching, promoting, or entertaining? That decides the structure (hook -> problem -> product -> proof -> call to action for an ad; setup -> turn -> payoff for a story).
2. **Chooses the production style.** Cinematic short, commercial, UGC/social, music video, documentary - each with its own camera, lens, film look, lighting and pacing.
3. **Directs every shot.** Shot size, angle and exactly one motivated camera move per shot: dolly in when the character says something that matters, dolly out only when the background is worth revealing, tracking / side-tracking / leading shots for a moving character, over-the-shoulder for conversations, locked-off to let a performance land.
4. **Keeps it one film.** One film look (grade, film stock, palette family, camera character) across every shot. Lighting may change with the setting (indoor vs outdoor, day vs night) but stays motivated and inside the same grade. The same character, wardrobe and product wording is repeated in every shot, and every frame is edited from one master still.
5. **Keeps real people and products authentic.** Uploaded photos are used as images (reference/first frame), never re-described from text; product frames are instructed to reproduce shape, colour, label and logo exactly.
6. **Shows the storyboard before filming.** The customer sees every frame, can redraw frames in plain words and edit shots, then approves. Nothing is filmed before approval.
7. **Delivers one stitched film** (with audio), plus every shot individually, plus a hand-off to the free editor.

### What users need to provide

| Required | Optional |
|---|---|
| **An idea, in plain words.** That's all. | A **character** photo (clear face), a **product** photo (plain background, label visible) and/or a **location** photo - add them when a real person, product or place must look exactly right. |
| | Style, number of shots (2-5), model, aspect ratio - Lucy picks sensible defaults. |

### How this beats "toolbox" products (e.g. Higgsfield)

Higgsfield-style tools give you preset camera moves to pick for one clip at a time, sold by subscription with credits that expire monthly (their reviews' #1 complaint is billing). Directed by Lucy plans the whole film from intent, chooses the camera language per beat, keeps characters/products/lighting consistent across shots, shows an editable storyboard, and returns a finished film - pay as you go, credits don't expire, failed shots refunded automatically. (Higgsfield's "Soul ID" trained-character models are the one thing we don't do yet; see Roadmap.)

---

## 2. Why the architecture differs from the 2.x draft

The draft proposed a separate Python service (FastAPI + WebSockets + Celery/Redis + FFmpeg + Docker + AWS). lucylabs.app already runs on Next.js/Vercel with a Postgres database, Stripe wallet, job tracking, refunds, media proxy and vendor routing. A second backend would duplicate all of that and double the ops surface, so the engine is built inside the existing app:

| Draft 2.x | As built |
|---|---|
| FastAPI + WebSockets | Next.js API routes + client polling (`/api/director/status`) |
| Celery/Redis workers | DB state machine advanced per poll, every vendor call behind an atomic claim so overlapping polls never pay twice |
| OpenAI "director" | Gemini 3.8 Flash on Google Vertex AI (billed to Google credits), rule-based fallback |
| Each shot routed to a different model (Veo/Seedance/Kling) | **One model per film** - mixing models is the fastest way to get the "random clips stitched together" look, because each renders light and skin differently |
| `seed: 8492021` synced across vendors | Dropped - seeds do not transfer between different vendors' models |
| `volumetric_contact_shadows: 0.92`, `lighting_wrapping_intensity: 0.85` | Rewritten as plain visual sentences - video models don't read config tokens |
| "Consistency parameters" posted to vendor face-lock fields | Real mechanisms: master still + per-shot frames edited from it, uploaded photos as image inputs, locked wording repeated in every prompt |
| FFmpeg `-c copy` concat | Re-encoding merge (clips from different runs/models have different codecs/timebases; stream-copy concat breaks). Audio is preserved |

---

## 3. Pipeline

```
idea (+ optional character / product / location photos)
  |
  v  POST /api/director/plan        (free, 20/day per visitor)
PLAN - Gemini picks only from the film-science menu; sanitizePlan() enforces it
  goal, style, emotion, aspect, ONE look, character/wardrobe/location/product bibles,
  2-5 shots: beat, setting, lighting, size, angle, move, action, expression, dialogue, sound, seconds
  | customer edits fields or revises in plain words (POST /api/director/revise)
  v  POST /api/director/create       (charges shots x per-shot price from the wallet; exact-amount Stripe checkout if short)
ANCHOR - one master still of the cast in the main location with the film's light
  v
FRAMES - one storyboard frame per shot, edited FROM the anchor (+ product photo)
  v
REVIEW - customer sees every frame
  - redraw a frame in plain words: POST /api/director/redraw   (5 per film; edits the current frame so only the change moves)
  - edit a shot's text:           POST /api/director/edit-shot (free)
  - cancel:                       POST /api/director/cancel    (refund to credit minus direction fee)
  - approve:                      POST /api/director/approve
  v
FILM - each shot: image-to-video from its approved frame, on the film's one model
  v
STITCH - join shots in order (audio kept); single-shot films skip this
  v
DONE - final film + every shot + "edit / add music in the free editor"
```

Failure handling: a missing anchor or frame never fails the film - that shot is filmed from its description. A shot whose video fails is refunded automatically. A stitch failure still delivers every shot.

---

## 4. Film-science knowledge base (`web/src/lib/director/filmScience.ts`)

- **Styles** - cinematic (Sony Venice 2, Panavision Primo anamorphic / Cooke S4, Kodak Vision3 5219 / 5207 emulation, low-key motivated light, ASL 4.5-7s), commercial (RED V-Raptor XL, Zeiss Supreme, glossy high-key, ASL 1.5-2.5s), UGC (iPhone 15 Pro handheld, window/ring light, natural colour, 9:16), music video, documentary.
- **Camera moves (25)** - locked-off, slow dolly in, fast push-in, dolly-out reveal, pull-back isolation, tracking follow, side tracking, leading shot, subject-swap pan, whip pan, rack focus, tension zoom, crash zoom, dolly zoom (Vertigo), orbit, crane up/down, tilt-up reveal, overhead, handheld follow, handheld selfie, over-the-shoulder, POV, product hero slide, slow-motion hold - each with a plain-language instruction and when to use it.
- **Shot sizes** extreme wide -> insert, with lens hints; **angles** eye level, low, high, dutch, profile, OTS, overhead.
- **15 emotions** -> pacing multiplier, lighting, colour, a filmable micro-expression (never just the feeling's name) and sound.
- **Hyper-realism by shot size** - pores, vellus hair, subsurface scattering, catchlights reflecting the real light sources, iris detail, individual hair strands with rim light, knit fibres and pilling, fabric weight, anatomically correct hands. A close-up asks for skin and eyes; a wide asks for fabric, hair and motion.
- **Anti-green-screen embedding** - contact shadows matching the key light, light wrap/colour spill onto hair and skin edges, matched perspective/lens/focus, atmospheric depth in front of and behind the subject, reflections, one grade and grain across subject and background.

Prompts are compiled deterministically (`compile.ts`) from the plan, so wording is identical shot to shot and a bad model answer can't produce a malformed prompt.

---

## 5. Pricing and margins

Per shot = the model's tier price + a **$1.00 direction fee**.

| Tier | Models | Single video | Directed-by-Lucy shot |
|---|---|---|---|
| Standard | Veo 3.1 Lite, Veo 3.1 Fast, MiniMax, Grok, Seedance 2.0 (when direct) | $2.99 | $3.99 |
| Premium | Veo 3.1 (4s), Kling 2.1, Kling v3, Seedance 2.5, Seedance 2.0 (fallback path) | $3.99 | $4.99 |

Costs counted: Stripe (worst case international 4.4% + 30c), video at the engine's worst-case buffered cost, images $0.15 each (anchor + one per shot + all 5 redraws), stitch, planner.

- **Filmed films: lowest profit $1.67 per shot** (2-shot Veo Fast film, international card, all 5 redraws used).
- **Walk-away before filming:** refund to credit of everything except the direction fee of **$1/shot, minimum $2.50** -> lowest $0.44 per shot.
- The floor asked for was $0.30/shot; every case clears it.

---

## 6. Vendors (all hidden from users)

| Model | Runs on |
|---|---|
| Veo 3.1 Lite / Fast / 3.1 | Google Vertex AI directly (keyless: Vercel OIDC -> Workload Identity Federation -> service account `lucy-labs-veo`) |
| Seedance 2.0 / 2.5 | BytePlus ModelArk directly once `NEXT_PUBLIC_SEEDANCE_DIRECT=1`; reseller path until the models are activated |
| Kling, MiniMax, Grok | reseller |
| Planner | Gemini 3.8 Flash on Vertex (Google credits) |
| Storyboard frames | Nano Banana Pro (image edit, `aspect_ratio` + JPEG output) |
| Stitch | ffmpeg merge (re-encodes, keeps audio) |

Every media URL reaches users only as `lucylabs.app/api/media/<encrypted token>`; vendor names are scrubbed from API responses and never in the client bundle.

---

## 7. Code map

```
web/src/lib/director/filmScience.ts     knowledge base (styles, moves, sizes, angles, emotions, realism, embedding)
web/src/lib/director/plan.ts            DirectorPlan types, Gemini system prompt, rule-based fallback, sanitizePlan
web/src/lib/director/planner.server.ts  planFilm / revisePlan (Gemini + fallback)
web/src/lib/director/compile.ts         shot / anchor / frame / redraw prompt compiler
web/src/lib/director/pipeline.ts        anchor -> frames -> review -> film -> stitch state machine
web/src/lib/director/filmAccess.ts      ownership, redraw cap, walk-away fee
web/src/lib/gemini.ts                   Vertex generateContent (JSON)
web/src/lib/vertexVeo.ts                Veo on Vertex (predictLongRunning / fetchPredictOperation, keyless auth)
web/src/app/api/director/*              plan, revise, create, status, redraw, edit-shot, approve, cancel
web/src/components/DirectorStudio.tsx   "Directed by Lucy" UI (mode switch on the homepage generator)
web/src/lib/db.ts                       director_films, director_shots, director_plan_log
```

---

## 8. Setup (production)

1. Google Cloud project with Agent Platform (Vertex AI) and IAM Service Account Credentials APIs enabled; service account with **Agent Platform User**; Workload Identity pool `vercel` + OIDC provider (issuer `https://oidc.vercel.com/<team>`, audience `https://vercel.com/<team>`, `google.subject = assertion.sub`); grant **Workload Identity User** to `principal://iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/vercel/subject/owner:<team>:project:<project>:environment:production`.
2. Vercel env (Production): `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=us-central1`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`; optional `GOOGLE_PLANNER_MODEL` (default `gemini-3.8-flash`), `VEO_PERSON_GENERATION` (default `allow_all`), `OWNER_EMAILS` (test without Stripe), `NEXT_PUBLIC_SEEDANCE_DIRECT=1` once BytePlus models are active.
3. Vercel Blob store connected (stores Veo outputs and uploads).
4. Deploy; the DB tables are created on first request (`initSchema`).

## 9. Verified live (2026-09-27)

- Planner: "ad for my matte black coffee tumbler" -> sell / commercial, three settings with motivated lighting inside one grade, dialogue; "violinist in rainy Paris" -> story / cinematic, dolly-in + over-the-shoulder.
- End-to-end UGC film: plan -> storyboard -> one redraw (fixed a collage frame; identity kept) -> approve -> 2 shots filmed -> stitched 8s 9:16 with audio.
- Side-by-side on the homepage: the same idea on Veo 3.1 Lite, plain vs Directed by Lucy.
- Fixes found by testing: Veo filtered children under `allow_adult` (now `allow_all` with automatic fallback); frames could come out as collages (prompt now forbids it).

## 10. Roadmap

- Character library: save a cast member (photos + locked description) and reuse across films.
- Trained per-character identity (Soul-ID-style) only if reference-based consistency proves insufficient at volume.
- Colour-matching pass at stitch time (single LUT across shots).
- Last-frame chaining option for continuous action across shots.
- Lip-sync pass for non-native-audio models inside films; music bed from a licensed library.
- Move storyboard frames to Google's image model (Google credits) once quality is confirmed.
