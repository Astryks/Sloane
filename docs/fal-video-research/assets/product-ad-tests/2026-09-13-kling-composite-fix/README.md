# 2026-09-13: Confirmation test - product+character compositing fix (Kling)

Follow-up to `../2026-09-13-harper-cup-old-spice/`, after fixing the real bug
found there: the product image was never actually shown to Veo/Kling/Grok/
MiniMax (only mentioned in text). Fixed by compositing product+character
into one image via `fal-ai/flux-pro/kontext/multi` before submission (see
`compositeProductAndCharacter` in `web/src/lib/fal.ts`).

Single-engine confirmation test (Kling only, per direct instruction to
audit first and minimize spend rather than re-run all 5).

## Result: real, confirmed improvement

The composite step succeeded in ~16s. The resulting Kling video (both
`harper_cup_kling_silent.mp4` and `..._dubbed.mp4`) now shows the **correct
tumbler shape** (handle, straw lid, correct proportions) throughout the
clip, with the "LUCY LABS" mic-logo legible in most frames - a major
improvement over the pre-fix result, which showed a generic bottle with no
resemblance to the real product at all.

**Honest remaining gap**: the tumbler's color drifts partway through the
clip (starts pink/lilac matching the real product almost exactly in frame
1, drifts to light blue by frame 3), and the character's face is not
stable frame-to-frame either (a brunette woman appears later in the same
clip, different from the blonde in frame 1) - Kling's generic
image-to-video mode still doesn't hold either identity perfectly across a
whole clip, it just now has the right starting reference to work from.
Given the stated priority (product must never change, character can vary),
this is a real net improvement worth shipping, with product color
stability as the next thing to improve if pursued further.

## Files

- `kling_composite_frame1/2/3.png` - three frames across the clip showing
  the shape holding steady and the color/logo drifting.
- `harper_cup_kling_silent.mp4` / `..._dubbed.mp4` - the full real outputs.
