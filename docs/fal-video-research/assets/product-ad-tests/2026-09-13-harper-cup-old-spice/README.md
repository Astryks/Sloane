# 2026-09-13: Harper + Lucy Labs cup, Old-Spice-style brief, all 5 engines

Real, live test of the product-ad flow (`web/src/components/ProductAdFlow.tsx` ->
`web/src/app/api/product-ad/generate` -> `.../status`) using the real backend
storyboard generator (`web/src/lib/productAdStoryboard.ts`), Harper's real
character reference photo, and the real Lucy Labs cup product photo. Brief
was an original, Old-Spice-inspired confident-ad script (not a reproduction
of the actual ad's footage or dialogue) with
https://www.youtube.com/watch?v=uLTIowBF0kE cited as a text style reference
only - no video model in this stack accepts a YouTube URL as visual input,
so the reference is never actually downloaded or analyzed.

## Real bug found and fixed during this test

Kling's `v2.1/master/image-to-video` endpoint hard-rejects any prompt over
2500 characters (`string_too_long`). The original storyboard template blew
past this by repeating the entire brief a second time inside shot 01's
description. Fixed in `productAdStoryboard.ts` (shot 01 no longer repeats
the brief; added a 2200-char safety budget that trims the shot list first
if a long brief leaves no room) and in `productAd.ts` (removed two lines of
now-redundant raw image URLs that were appended to the prompt as text on
top of already being passed structurally - pure bloat, no model benefit).
Verified: Kling failed 2/2 before the fix, succeeded after.

## Results, per engine

- **kling** (`v2.1/master/image-to-video`, not Avatar mode): completed both
  silent + dubbed. Near-perfect identity match to Harper's reference photo -
  but because it barely animates the source image, it also ignored almost
  the entire brief (still on the beach in the wetsuit, no product visible in
  frame). High identity fidelity, low creative-brief fidelity.
- **grok**: completed both silent + dubbed. Reasonable likeness to Harper,
  but rendered her back in a wetsuit at a beach house (not the "stylish
  loft" from the brief) - the product is a dark bottle with legible "Lucy
  Labs" text, but the wrong shape/color vs. the real pink tumbler.
- **minimax**: completed both silent + dubbed. Cheapest engine, but the
  weakest result - a visibly different woman than Harper, and the product
  rendered as a small pink perfume-style bottle, not the actual tumbler
  shape at all.
- **veo**: silent render completed (also wetsuit/beach-anchored, legible
  "LUCY LABS" text on a red/white bottle, wrong shape). The Kling lip-sync
  pass on this one took 515s and ultimately failed with a
  `downstream_service_error` from Kling's lipsync endpoint - despite fal's
  status endpoint reporting the job `COMPLETED`, fetching the result 404'd
  with that error. No dubbed file for Veo this round.
- **seedance**: failed immediately with fal's `content_policy_violation`/
  `partner_validation_failed` - the same reproducible block on AI-generated
  photorealistic faces already documented earlier in this project's
  research (see the parent README). Not a bug; a known, standing limitation
  of this engine for this exact use case.

## Real spend, this test

~$8 total: minimax ~$0.77 (video+lipsync), grok ~$1.35, kling failed attempt
+ successful retest (~$3.2, since the video render itself succeeded twice
before the prompt-length fix and once after), veo ~$1.4 (silent only, lipsync
failed after real compute time), seedance ~$0.05 (rejected before rendering).

## Files

- `harper_cup_<engine>_silent.mp4` - the original, undubbed render.
- `harper_cup_<engine>_dubbed.mp4` - the Kling lip-synced result (missing for
  veo/seedance - see above).
- `*_frame.png` - representative extracted frames used for visual review.

## Conclusion

Confirms, with fresh real data, the standing finding elsewhere in this repo:
no single engine in this stack gets both "same character" and "follows the
new scene/creative brief" at once for a character+product composite shot.
Kling's generic image-to-video mode (as used here) trades brief-fidelity for
identity-fidelity; Veo/Grok trade the reverse; MiniMax is weakest on both;
Seedance is blocked outright for AI-generated faces.
