# BytePlus ModelArk direct API research (Seedance 2.0/2.5) — 2026-09-15

**Raw copies of all 5 source docs, saved for recovery** (their site is a JS-rendered SPA behind a login-gated console for some sub-pages — if a link below ever breaks or requires a login we don't have, the full real content is preserved locally): [`raw/1-model-pricing.md`](./raw/1-model-pricing.md), [`raw/2-advanced-creation-rights.md`](./raw/2-advanced-creation-rights.md), [`raw/3-content-pre-filter.md`](./raw/3-content-pre-filter.md), [`raw/4-prompts-guidance.md`](./raw/4-prompts-guidance.md), [`raw/5-virtual-avatar-library.md`](./raw/5-virtual-avatar-library.md).

Real research, not a guess: all 5 docs the user linked were fetched live (BytePlus's docs site is a JS-rendered SPA — a plain fetch only returns the nav shell, so this was done through the Browser pane, not WebFetch, to get real body content). Answers the actual question asked: **go through fal (current, realistic-image block unresolved) or go direct to BytePlus, given their real pricing tiers and volume requirements?**

**Bottom line up front: stay on fal for now.** The $14k/year minimum commitment to unlock anything beyond a 3-requests-per-minute free tier is wildly disproportionate to real current volume (~21 test jobs, 2 real users — see STATUS.md). Direct API becomes worth it once volume genuinely justifies the subscription math below, or if the realistic-face block turns into a real blocker for a paying customer and fal support's answer (still pending) is unhelpful. Full reasoning in "Recommendation," below.

---

## 1. What each doc actually said

### (1) Model pricing — [docs/ModelArk/1544106](https://docs.byteplus.com/en/docs/ModelArk/1544106)

Real per-video pricing, "Price examples" table, 16:9, 5s output, no video input:

| Model | 480p | 720p | 1080p | 4K |
| --- | --- | --- | --- | --- |
| **Seedance 2.5** | $0.514/video ($0.103/s) | $1.156/video ($0.231/s) | $2.843/video ($0.569/s)¹ | n/a |
| **Seedance 2.0** | $0.35/video ($0.07/s) | $0.76/video ($0.15/s) | $1.87/video ($0.37/s) | $3.89/video ($0.78/s) |
| **Seedance 2.0 Fast** | $0.28/video ($0.06/s) | $0.60/video ($0.12/s) | not supported | not supported |
| **Seedance 2.0 Mini** | $0.18/video ($0.04/s) | $0.38/video ($0.08/s) | not supported | not supported |

¹ The page separately advertises a limited-time (through 2026-09-17) 28% discount on Seedance 2.5's 1080p tier "starting at approximately $0.41/s" — the two numbers don't quite reconcile (the per-video example table may not yet reflect the discount), worth confirming with their own pricing calculator before relying on an exact number.

**Real comparison to what we already know we pay fal**: STATUS.md already has fal's real Seedance 2.0 retail rate at **$0.2419/s** (from the ByteDance-partnership research). Direct BytePlus 720p Seedance 2.0 is **$0.15/s** — direct is genuinely ~38% cheaper at the same tier. That gap is real and durable, not a rounding artifact.

Using video as an additional input (not just image) costs less per the pricing table (e.g. Seedance 2.0 720p with video input: $0.84-1.86/video vs $0.76 image-only) — counterintuitive at first glance, but it's because "with video input" pricing is quoted for the *2.0 series'* video-extension/editing use case at a different base rate, not a discount for the same task.

### (2) Advanced Creation Rights Purchase Guide — [docs/ModelArk/2377608](https://docs.byteplus.com/en/docs/ModelArk/2377608)

This is the real gate on everything else. Four tiers:

| Tier | Price | Real-person verify (API) | Virtual portrait upload | Asset capacity | Rate limit |
| --- | --- | --- | --- | --- | --- |
| Basic (free) | $0 | ❌ (console-only) | ❌ | 50 / 50 | 3 QPM |
| **Advanced Entry (free)** | $0 | ✅ | ✅ | 50 / 50 | 3 QPM |
| Advanced | **$14,000/yr** ($1,400/mo) | ✅ | ✅ | 1,000,000 / 1,000,000 | 120 QPM |
| Advanced Premium | **$42,000/yr** ($4,200/mo) | ✅ | ✅ | 5,000,000 / 5,000,000 | 300 QPM |

Real gotchas, not just pricing:
- **Requires enterprise KYC before any of this**: BytePlus account + "Organization real-name authentication" (submitting an actual corporate registration certificate) + agreeing to 4 separate legal documents (Asset Library Terms of Use, a signed Commitment Letter for uploading virtual-avatar assets, Real Person Verification usage rules, Platform Customer Code of Conduct). This is real business/legal overhead, not a checkbox.
- **No refunds, no downgrades mid-cycle.** Once purchased, considered confirmed.
- **The free "Advanced Entry" tier is real and already unlocks real-person verification + asset upload at $0** — the catch is 3 QPM (three requests per minute, account-wide) and a 50-asset cap. Fine for testing, a hard ceiling the moment more than a handful of concurrent generations happen.
- Expiry has a real cliff: 0-15 days grace (frozen, downgraded to Entry limits), 15+ days past expiry, **assets are permanently deleted, unrecoverable**.

### (3) Content Pre-filter — [docs/zh-CN/docs/ModelArk/Content_Pre-filter](https://docs.byteplus.com/zh-CN/docs/ModelArk/Content_Pre-filter)

This turned out to be BytePlus's **general** safety filter (minor safety, hate speech, nudity/sexual content, misinformation) — automatic, on by default per inference endpoint, returns `finish_reason: "content_filter"` via the API rather than a silent drop. It is **not** specifically about realistic human faces — that's a different, more specific mechanism, found instead in docs (2) and (5):

- **Real-person likeness requires the separate "Real-human Portrait Library"** (referenced by name in doc 2/5 but not directly linked by the user) — gated behind the same Advanced Creation Rights tiers above, with formal KYC-verified real-person consent.
- **The "Private Virtual Avatar/Portrait Asset Library" (doc 5, what the user actually linked) is for *fictional* characters and explicitly requires the asset NOT resemble a real person** — see below, this is a real correction worth flagging.
- Per-asset, once registered and vetted, you can set `"Moderation": {"Strategy": "Skip"}` on `CreateAsset` to bypass most non-baseline re-review on every subsequent generation using that trusted asset — a real, documented "vet once, reuse freely" path that fal does not currently offer at any price.
- Found in doc (4)'s own FAQ: their moderation **does** block content where "the character in the video resembles a celebrity" (their term for accidental real-person likeness via ID drift) — so the underlying compliance concern (accidentally generating a real recognizable person) is the same one fal is almost certainly enforcing too. Going direct doesn't inherently unblock realistic faces — it hands you the *formal registration process* to get a specific, vetted asset cleared, which fal has no equivalent for today.

### (4) Seedance 2.0 Prompts Guidance — [docs/ModelArk/2222480](https://docs.byteplus.com/en/docs/ModelArk/2222480)

The real substance for the storyboard best-practices doc below — full technique breakdown, FAQ of failure modes with real before/after fixes (character ID drift → celebrity-resemblance block, unwanted subtitles, logo/watermark leakage, style drift, jump cuts on video-extension, duplicated characters, quality degradation across repeated extensions, mispronunciation, voice-reference mismatch). Recreated as our own worked example in Section 2 below rather than reproducing their example prompts verbatim (their CEO/rain-scene and beauty-blogger examples are their own copyrighted material).

### (5) Private Virtual Avatar Asset Library Tutorial — [docs/ModelArk/2333565](https://docs.byteplus.com/en/docs/ModelArk/2333565)

**Real correction worth flagging directly**: this library is for **original/fictional characters**, not real people — its own terms explicitly require "the asset must not resemble any real human person's portrait." This is exactly the right fit for characters like Harper/Marcus/Jack (AI-original, not real people) — not for cloning an actual customer's face. If we ever wanted a real customer's own likeness registered (the closer analogue to what Kling Avatar does today), that's the separate Real-human Portrait Library, not this one.

Real technical detail, useful if we ever integrate:
- Image spec: aspect ratio 0.4-2.5, 300-6000px per side, <30MB, common formats.
- Recommended asset pair per character: one **full-body vertical frontal** shot + one **face-only close-up** (face ~2/3 of frame, no expression) — explicitly the fix for the "ID drift" FAQ problem in doc (4): a single mixed reference photo dilutes the model's face-feature weighting.
- Assets referenced in prompts positionally (`Image 1`, `Video 1`, `Audio 1`), never by literal asset ID — the asset ID only maps to a real URL (`asset://asset-...`) in the request body's reference list.
- Real code samples confirm the actual request shape: `content_generation.tasks.create(model=..., content=[{type: text/image_url/audio_url, role: "reference_image"/"reference_audio"}], generate_audio, ratio, duration, watermark)` — async task, poll `tasks.get(task_id)` for `succeeded`/`failed`, same submit-then-poll shape as our own fal/Modal integrations already use.

---

## 2. Cinematic storyboard best practices (recreated in our own words + a worked example)

BytePlus's own guidance is genuinely well-structured; the technique below is theirs, the specific worked example is original (Harper, our own character, not their example scripts).

### The formula

```
precise subject + action details + scene/environment + lighting & color tone + camera movement + visual style + image quality + constraints
```

In plain terms: lock **who** is doing **what**, say **where** and in **what mood**, tell the model **how to shoot it**, then close with style/quality/negative constraints.

### Defining a subject unambiguously

When a reference image contains more than one thing worth naming, give it a stable label and reuse that exact label every time:

> Define the woman in the yoga-mat photo (Image 1) as Harper. Define the tumbler in Image 2 as Product.

Reuse "Harper" and "Product" consistently for the rest of the prompt — never redescribe them differently mid-prompt (a common cause of drift).

### Shot-by-shot storyboard structure

Break a multi-beat ad into explicit shots rather than one long paragraph:

> **Shot 1**: Medium shot, Harper on a yoga mat, mid-stretch, soft morning light through a window. She says {"I used to think mornings were the hardest part of my day..."}
> **Shot 2**: Cut to a close-up of Product on the mat beside her. Camera slowly pushes in. (Gentle acoustic guitar builds underneath.)
> **Shot 3**: Wide shot, Harper now in a corner office forty floors up, holding Product, city skyline through the window behind her. She says {"...now I start every one of them exactly the same way."}

Rules that actually matter:
- One camera movement per shot (push in, OR pan, OR fixed — never stack push+pan+tilt in one shot; the model destabilizes).
- Prefer slow, small, continuous motion over big bursts (a slow raise of a hand generates far more reliably than a sprint or a jump).
- Externalize emotion as physical detail, not adjectives: not "she feels confident" — "her shoulders drop, she exhales, a small smile settles in."
- Special-character conventions their model actually parses: `()` for music, `<>` for sound effects, `{}` for spoken dialogue, `【】` for on-screen text/subtitles.

### Constraint words (the negative-prompt equivalent)

Always worth appending, since these are the most commonly-hit failure modes in their own FAQ:
- "Keep it subtitle-free" / "avoid generating any text or subtitles" — landscape output has a meaningfully lower unwanted-subtitle rate than portrait, per their own FAQ.
- "Do not generate a logo" / "do not generate a watermark" — their model will otherwise sometimes invent a plausible-looking platform watermark.
- An explicit style anchor ("cinematic documentary style, warm natural tones") to prevent an unintentionally realistic reference photo from pulling a stylized ask back toward photorealism, or vice versa.

### Known failure modes worth planning around (their own documented FAQ, real not hypothetical)

| Symptom | Real cause | Fix |
| --- | --- | --- |
| Face "swaps" mid-video, sometimes flagged as resembling a celebrity | A single mixed reference photo underweights the face region | Provide a dedicated face-only close-up (2/3-frame, neutral expression) *in addition to* a full-body shot |
| Unwanted subtitles appear | Portrait aspect ratio has a measurably higher spontaneous-subtitle rate | Prefer landscape where possible; add explicit "no subtitles" constraint |
| Style drifts toward photorealism despite a stylized ask | Realistic reference photo without an explicit style anchor | State the target style explicitly, or pre-convert the reference image to the target style first |
| Visible jump/rollback where two extended clips join | Known limitation of the video-extension joint | Trim ~6 frames off the end of clip A and ~1 frame off the start of clip B in post (their own documented workaround, not ours) |
| Duplicate/"twin" characters in frame | Ambiguous subject labeling, or multi-angle reference images of the same person confusing the model | Label every character explicitly per-shot; use single-angle references only, never multi-view turnarounds |
| Progressive quality loss across repeated video extensions | Compounding artifact from re-using generated output as input | Convert to a neutral "white-model" pass between extensions (their own suggested workaround), or cap total extension chains |

This maps directly onto problems we've already hit and solved our own way for Kling/Veo (see `docs/fal-video-research/`) — worth cross-referencing if we ever build a shared "storyboard best practices" page for customers, since several of these (subject labeling, one-camera-move-per-shot, externalized emotion) apply regardless of which underlying engine ends up rendering the shot.

---

## 3. Recommendation: fal vs. direct API

**Real math on when direct pays for itself**: the cheapest paid tier is $1,400/month. The per-second saving vs. fal at 720p Seedance 2.0 is about $0.09/s ($0.24 fal vs $0.15 direct). Break-even is $1,400 / $0.09 ≈ **15,500 seconds/month**, or **~3,100 five-second videos/month**, just to cover the subscription — before counting any actual margin. We are at ~21 test jobs total, lifetime. That gap is enormous, not a close call.

The free "Advanced Entry" tier is real and technically unlocks real-person verification + virtual-portrait upload today at $0 — but 3 QPM account-wide is a hard ceiling that a handful of concurrent users would already hit, and it still requires the same enterprise KYC paperwork (corporate registration doc, 4 legal agreements) as the paid tiers. That's a real cost in time/process for a ceiling this low, against fal's zero-setup pay-as-you-go we already have live.

On the realistic-face block specifically: going direct is **not** a shortcut around it. BytePlus's own FAQ confirms they block content that reads as resembling a real/celebrity likeness too — the actual unlock is the formal KYC + registered-trusted-asset pathway (Real-human Portrait Library), which is gated behind the same Advanced Creation Rights tiers above, not a side door that bypasses payment.

**Recommendation: stay on fal.** Revisit direct API if either becomes true:
1. Real volume approaches the ~3,000+ videos/month range where the subscription math above actually pays back, or
2. The realistic-face block becomes a genuine blocker for a real paying customer (not just our own test generations) *and* fal support's still-pending answer (asked 2026-09-11, see STATUS.md) turns out unhelpful — at that point $14k/yr buys a real, documented compliance pathway fal doesn't offer at any price, which may be worth it regardless of the per-second cost delta.

Not started, not committed to: no BytePlus account created, no KYC submitted, no package purchased. This doc is research only, per the user's request.
