# Raw capture: Dreamina Seedance 2.0 series prompt guide

Source: https://docs.byteplus.com/en/docs/ModelArk/2222480
Captured: 2026-09-15, via the Browser pane. Condensed to strip repeated image-placeholder markers ([Output]/[Reference material] blocks with no real text content); every real rule, formula, and FAQ entry is kept in full, including their own example prompts verbatim (useful as reference material even though the public-facing site content recreates the technique with original examples instead of reproducing these).

**Deliberately not saved: the page's ~20 example/before-after images and 4 flowchart SVGs.** These are BytePlus's own proprietary documentation graphics (their generated video stills, comparison shots) - not ours to copy into this repo, same category call as declining to reproduce the JoJo storyboard's actual reference photos earlier this project. Each FAQ entry below already describes in words what its before/after image showed (e.g. "Before: face swaps mid-video, resembles a celebrity / After: face stays consistent with the reference") - that's the part that's actually useful for recovery, and it's fully preserved in the FAQ text below.

## Basic formula (reference-based generation)
Three task types, pick a prompt formula per type:
- **Omni reference** (extract elements - subject/style/scene/sound - to generate a brand-new video): "Reference <Subject_N> in <Image_N> to generate...", "Reference <Action/Camera_movement/Style/Sound_effect> in <Video_N> to generate...", "Reference the timbre in <Audio_N> to generate..."
- **Video editing** (partial/global modification, unmentioned parts stay unchanged): Add: "<Element_Features> + <Timing> + <Location>"; Modify: "Strictly edit <Video_N>, and modify <Original_Characteristic> in it to <New_Characteristic>"; Delete: specify elements to delete, emphasize what should remain unchanged.
- **Video extension** (continue along time dimension, style/subject/narrative must stay consistent): "Extend <Video_N> forward/backward to generate...", or track completion: "<Video_1> + <Transition_Description> + followed by <Video_2> + <Transition_Description> + followed by <Video_3>"

Note: for edit/extend tasks use "<Video_N>" directly, not "reference <Video_N>" (the word "reference" triggers omni-reference interpretation instead).

Combined tasks: "Reference [Reference_Dimension] of <Image/Video_N>, strictly edit <Video_X>, [Specific_Edits]"

## Advanced formula
> precise subject + action details + scene/environment + lighting & color tone + camera movement + visual style + image quality + constraints

Model treats prompts as two dimensions internally: "spatial layer" (what's in frame) and "temporal layer" (how things change over time) - a good prompt is "engineering-style," not just descriptive copy.

### 1. Define the subject
Pattern: "Define [Core_Subject_Features] in <Image/Video_N> as <Subject_N>". Use 2-3 clear, stable static features (clothing, hairstyle, appearance, category) for unique identification. Example: "Define the woman wearing a red dress and a straw hat in Image 1 as Subject 1" (or as a name, e.g. "as Zhang Hong"). Every mention of the subject thereafter must use the same label. Two supported patterns: `<Subject_N>@<Image_N>` binding for undefined subjects, or the same pre-defined label reused consistently. When using the asset library, still reference via `<Image/Video_N>` positionally, never the raw Asset ID directly in prompt text.

### 2. Shot sequencing
Break complex videos into a timeline storyboard: Shot 1/Shot 2/Shot 3, each as who + where + doing what + how the camera moves, in chronological order.

Negative example: "A man runs nervously down the street, and the scene feels very cinematic."
Positive example:
- Shot 1: Side shot of a street alley; the man slowly starts running, with a sense of rapid breathing.
- Shot 2: The man knocks over a fruit stand; the camera shakes quickly and gives a close-up of the man's frightened face.
- Shot 3: The man climbs over a low wall and disappears; the camera slowly pulls back and freezes on the empty street.

Rules: use "Shot 1/2/3" identifiers in event order (primary first). Don't force exact durations (e.g. 0-3s) - model's precise-timing support is unstable and forcing it can cause abnormal results. Organize each shot as: camera movement/transition, subject actions/expressions, position/spatial changes, audio information.

### 3. Action description
- Refine to body parts + quantify degree: "slowly raise a hand, quickly turn the head, push hard off the ground, slightly lower the head."
- Prioritize slow, gentle, continuous small movements over high-burst/large-dynamic actions (sprinting, big jumps, violent rolls).
- Supplement transitions between actions for inertia/continuity: "use the inertia of turning around to naturally raise a hand."
- Externalize emotion as physical detail instead of abstract words:

| Abstract emotion | Externalized as actions/details |
| --- | --- |
| Sadness | lowering the head, shoulders trembling slightly, eyes reddening, fingers unconsciously clutching the corner of clothing, tears welling but not falling |
| Joy | corners of the mouth rising uncontrollably, brows/eyes relaxing, steps becoming light, unconsciously humming a tune, unable to resist spinning in place |
| Nervousness/anxiety | frequently checking the watch, fingers constantly tapping the tabletop, rapid breathing, eyes darting away, unconsciously biting fingernails |
| Anger | both fists clenched, jawline tense, chest heaving violently, eyes as sharp as knives, squeezing words out through gritted teeth |
| Relief | letting out a long breath, tense shoulders completely relaxing, a long-lost faint smile, looking up toward the distance |

### 4. Camera movement
Model understands standard terms directly: medium shot, close-up, wide shot, slow push-in, smooth lateral tracking, fixed shot. **Specify only 1 camera movement type per shot** - combining push/pull/pan/move in one shot increases instability.

### 5. Image quality, style, constraint words
- Image quality: "HD, rich details, cinematic texture, natural colors, soft lighting"
- Style: "cyberpunk cool blue-purple tone, retro film, fresh Japanese style"
- Constraints: avoid subtitles ("keep it subtitle-free," "avoid generating any text or subtitles"), avoid logo ("do not generate a logo"), avoid watermark ("do not generate a watermark")

### 6. Special character syntax
| Info type | Symbol | Example |
| --- | --- | --- |
| Music | `()` | (fast-paced rock music is playing in the background) |
| Sound effect | `<>` | <dog barking can be heard in the distance> |
| Dialogue | `{}` | {Hello, world}. Non-Chinese/English dialogue must be marked, e.g. says in Japanese {こんにちは} |
| Subtitles | `【】` | 【Chapter One: Departure】 |

Language standard: dialogue language must be consistent, avoid mixing Chinese/English except proper nouns.

### Other tips
- Text generation: model auto-matches style/color by context, or specify color/style/appearance-timing/position explicitly. Prioritize common characters, avoid rare characters/special symbols.
- Video extension (continuous long take) vs. segmented stitching: extension suits single-scene dialogue/emotional progression; segmented stitching suits plot turns or fast-paced action (chases, fights, montages) - typically combined in real production.
- Asset configuration strategy: 4 functional roles - character anchoring (lock appearance), scene tone-setting (lock environment/style), camera movement reference (lock shot language/rhythm), rhythmic atmosphere (audio controls emotion/timbre). Recommended: 4-5 assets total (1-2 character images + 1 scene image + 1 camera-movement video + 1 audio clip). Do not use the full asset limit - too many assets makes feature-priority judgment difficult (style conflicts, blurry subject ID, deviation from expectations).

## FAQ - real, documented failure modes

### Character ID drifting
**Symptom**: generated appearance inconsistent with reference, or "face swapping" mid-video (ID drift) - can cause the character to resemble a celebrity and get blocked during review.
**Cause**: face reference insufficiently effective - a single mixed reference image (face + pose + outfit + detail all combined) dilutes facial-feature weight, especially when the face occupies too small a proportion of the frame.
**Fix**: prepare a dedicated close-up face image (headshot only, no expression, minimal shoulders/neck/background) IN ADDITION to a full-body photo. Clearly define the subject: "<Subject 1> facial features reference image 1 (headshot), makeup and styling reference image 2 (full-body photo)." Place the most-precision-critical asset first in the prompt. Do NOT use multi-view/turnaround character images - the model may read different angles as different subjects, worsening drift.

### Unexpected subtitles
**Symptom**: video contains subtitles despite no request for them.
**Fix**: cannot be 100% prevented, only reduced. Add "Keep it subtitle-free"/"avoid generating any text or subtitles." Remove pre-existing text from reference images/video first if not essential. Prefer landscape over portrait - subtitle-generation probability is significantly lower in landscape.

### Logo/watermark appears
**Fix**: add "Do not generate watermarks"/"Do not generate Logos" explicitly.

### Style drifting
**Symptom**: expected 2D/3D anime style but a realistic reference photo + no style emphasis drifts the output toward live-action realism.
**Fix**: add explicit style constraint words ("2D Japanese anime style," "3D Chinese-style comic"). For more precise control, convert the reference image to the target style before generating video.

### Jump cuts at video-extension transition points
**Symptom**: frame jumps/rollback where an extended video joins the original.
**Fix** (post-editing workaround, not a prompt fix): in CapCut or similar, trim 6 frames from the end of the earlier segment and 1 frame from the start of the following segment at each join point. Slight jumps may still remain even after alignment - recommend ending a generation at a transition cut and starting the next from the new scene after that cut, rather than relying purely on frame trimming.

### Duplicated characters
**Symptom**: in multi-character scenes with 3-view/multi-view reference images, two identical characters can appear in the same frame.
**Cause**: subjects not clearly defined in the prompt so the model can't distinguish roles; multi-view references confuse character recognition.
**Fix**: clearly specify character-subject associations, e.g. "Zhang San (corresponding to image 1) throws the green passbook toward Li Si (corresponding to image 2)." Add a global constraint at the end: "Throughout the video, characters with completely identical appearance, clothing, and accessories are prohibited. Do not generate duplicate avatars or a twin effect." Prefer independent single-person reference photos over multi-view/turnaround assets. Don't paste a full script as the prompt verbatim - simplify to clear, focused instructions.

### Image quality degradation during video extension
**Symptom**: quality loss when a generated video is used as input for further extension, compounding with repeated continuations - especially mottled color blocks in face regions.
**Fix** (mitigation, not full fix - promised for future model iterations): convert the video to a "white model" pass before continuing (reference prompt: "Convert the video into a white 3D model. All characters should be unified as pure white 3D models, with no color, no texture, and no shadows; use a pure white background, stable structure, and smooth motion"). Prioritize HD reference assets. Limit total number of chained extensions.

### Special effects not matching expectations
**Symptom**: text-described effects (e.g. a countdown animation) don't follow expected logic (numbers scroll randomly instead of counting down properly).
**Fix**: use a reference VIDEO to define the effect instead of describing it in text - e.g. "the way the number '2999' appears should reference video 1."

### Too many reference characters
**Symptom**: with more than 4 reference people, output stability drops - wrong headcount, duplicated characters.
**Fix**: generate in groups of <=4 people per image first, then use the grouped images as reference assets for the final video generation.

### Noise at the end of the video
**Symptom**: abrupt clicking/cut-off noise at the end when narration is present.
**Fix**: regenerate, or apply an audio fade-out via a volume envelope in editing software (e.g. CapCut: select video track > Audio > Volume envelope > drag final keyframe to 0 near the end).

### Inaccurate Chinese pronunciation
**Symptom**: polyphonic characters, uncommon characters, or characters with similar shapes are prone to mispronunciation.
**Fix**: replace with a homophone that has correct pronunciation (optimization only, doesn't fully guarantee accuracy).

### Inaccurate voice reference
**Symptom**: generated video's voice differs significantly from the reference audio's voice.
**Fix**: add detailed descriptions of voice characteristics in the prompt (e.g. "Use the low, thick, warm, and finely grainy middle-aged male voice of @Audio 1 to say"). Keep line delivery style close to the reference audio's tone/expression.

## Appendix: prompt templates (their own, verbatim - kept for reference)

Text generation - slogans: `[Text Content] + [Timing] + [Positioning] + [Entrance/Appearance Style], [Visual Attributes (Color, Font Style)]`

Subtitles: `Display subtitles at the bottom-center with the text. The subtitles must be perfectly synchronized with the audio rhythm and pacing.`

Speech bubbles: `[Character] says, "[Dialogue]." Speech bubbles appear around the character containing the spoken text.`

Multi-perspective subject reference: `Refer to/Extract/Combine/Use the [Subject] from [Image N] to generate [Scene Description], maintaining consistent [Subject] features.`

Multi-image reference: `Refer to / Extract / Combine / Follow the [Description of referenced elements] from [Image N] to generate [Scene Description], while maintaining the consistency of [Referenced Elements].`

Motion reference (video): `Refer to the [Motion Description] from [Video N] to generate [Scene Description], keeping the motion details consistent.`

Camera motion reference: `Refer to the [Camera Movement Description] from [Video N] to generate [Scene Description], keeping the scene consistent.`

Special effects reference: `Refer to the [Special effects description] from [Video N] to generate [Scene description], keeping the special effects consistent.`

Adding/removing/modifying elements: `Adding: At [Timestamp/Timing] and [Spatial Location] of [Video N], add [Description of intended element].` / `Removing: Remove [Element to be deleted] from [Video N], keeping the rest of the video content unchanged.` / `Modifying: Replace [Description of element to be changed] in [Video N] with [Description of intended element].`

Extending videos: `Extend [Video N] forward/backward + [Description of extended content]` or `Generate content before/after [Video N] + [Description of extended content]`. Note: model auto-extracts transition frames for seamless blending; original input segments are not re-generated.

Completing tracks (max 3 clips, total combined duration <=15s): `[Video 1] + [Transition Description] + followed by [Video 2] + [Transition Description] + followed by [Video 3]`. Smart trimming: model auto-trims connecting segments of start/end clips, retaining only necessary frames.

Last updated (on BytePlus's page): August 31, 2026.
