# Sloane Project Status

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
