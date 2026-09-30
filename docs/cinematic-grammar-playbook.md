# Cinematic grammar playbook for Directed by Lucy

2026-09-30. This is the research behind the cinematic engine: `web/src/lib/director/beats.ts`, `recipes.ts`, `playbooks.ts` and `review.ts`, which sit on top of `grammar.ts` from PR #42. Every rule below links to its source. Where a source is secondary or couldn't be read, that's stated. Anything marked **Lucy's choice** is an engineering decision built on the sources, not a finding.

Related docs: `director-mode-cinematography-research.md`, `shot-pacing-research.md`, `seedance-2.5-official-prompt-guide-learnings.md`, `higgsfield-competitive-research.md`, and `/workspace/reports/lucy-realism-diagnosis.md`.

---

## 1. Choosing a shot for what the beat does

### 1.1 Emotion first: Walter Murch's Rule of Six
In *In the Blink of an Eye*, Murch ranks what a cut should respect:

| Rank | Criterion | Weight |
|---|---|---|
| 1 | Emotion | 51% |
| 2 | Story | 23% |
| 3 | Rhythm | 10% |
| 4 | Eye-trace | 7% |
| 5 | 2D plane of screen (the stage line) | 5% |
| 6 | 3D space of action | 4% |

When you can't satisfy all six, give up the lower ones first. The 180-degree line is only fifth: a cut that is emotionally right beats one that is spatially perfect.
Source: https://blogs.ischool.berkeley.edu/i290-viznarr-s12/the-rule-of-six-walter-murch/

Murch is also quoted by Bordwell (below) on picking the closer shot when you can't read the actor's eyes.

**In Lucy:**
- The engine chooses sizes from the beat's emotional function and intensity.
- Grammar still enforces the 180-degree rule, because AI models can't be trusted to keep space consistent. In a live-action edit the line might be broken for emotion. Lucy won't do that, since video models have no shared 3D space between clips.

### 1.2 Katz, *Film Directing Shot by Shot*
Katz treats staging as a visual tool that expresses relationships. He covers:
- A, I and L staging patterns for dialogue;
- the master shot, the sequence shot and the two-shot;
- shot/reverse-shot with consistent sightlines;
- whether the camera is inside or outside the space of the action.

His method is to find the scene's turning points and decide the emphasis of each line before choosing coverage.
Sources:
- https://mwp.com/product/film-directing-shot-shot-25th-anniversary-edition-visualizing-concept-screen/
- chapter summary: https://cdn.bookey.app/files/pdf/book/en/film-directing-shot-by-shot.pdf
- https://directors.uk.com/news/books-on-directing-part-4
- https://indiefilmhustle.com/steve-katz-shot-by-shot/

**In Lucy:** the beat function is Lucy's version of Katz's "turning points and emphasis". Each shot is tagged `setup`, `tension_rise`, `power_shift`, `reveal`, `emotional_peak`, `release` or `button`, with an intensity from 0 to 1 (**Lucy's taxonomy**).

### 1.3 Bordwell, "Intensified Continuity" (the modern norm)
Source: David Bordwell, *Film Quarterly* 55:3 (2002), https://cinecdoque.wordpress.com/wp-content/uploads/2015/03/bordwell-intensified-continuity.pdf

Bordwell identifies four traits of post-1960s Hollywood style.

1. **Faster cutting.**
   - Typical ASL was 8–11s in the studio era.
   - Ordinary films ran 5–7s in the 1980s.
   - By 1999–2000 the typical ASL was 3–6s.
   - Indie films often run 8–12s.
   - Dialogue scenes: *Ordinary People* 6.1s, *Ghost* 5.0s, *Almost Famous* 3.9s.
2. **Bipolar lens lengths.** Long lenses for faces, wide lenses for depth and energy. Stone asks Robert Richardson (*Wall Street*): "Can you cut a long lens with a wide-angle lens?"
3. **Closer framings.** Dialogue is built from **singles rather than two-shots**, with the roomy over-the-shoulder medium as the baseline. Editors "cut at every line and insert more reaction shots".
4. **A free-ranging camera.**
   - **Push-ins underscore a realisation**, and intercut push-ins build tension.
   - The Steadicam "walk-and-talk" is an alternative to "stand and deliver".

He also notes:
- There are fewer establishing shots, but the 180-degree axis is strictly respected because shots are short.
- Long shots now *punctuate*: the most distant framing is often saved for the end of a scene, as a caesura.
- Soderbergh on the cost of coverage: every cutaway "bought so much".

**In Lucy** (`beats.ts chooseShot`):

| Beat | Size | Angle | Lens | Move | Cut after |
|---|---|---|---|---|---|
| setup | wide (medium-wide as intensity rises) | eye level | wide | still | – |
| tension_rise | medium to medium close-up | eye level* | long | slow push-in at intensity ≥ 0.65 | reaction at ≥ 0.6 |
| power_shift | medium close-up to close-up | low on the dominant, high on the subordinate | long | still (power is stillness) | reaction |
| reveal | insert (object), close-up (face), or medium-wide pull-back (place) | eye level | normal/long | hold, or dolly out for a place | reaction |
| emotional_peak | close-up (extreme close-up only when silent) | eye level* | long | slow push-in | – |
| release | medium / medium-wide | eye level | normal | still, or pull back when silent | – |
| button | wide / medium-wide | eye level | wide | still, or pull back | – |

\* In a scene with a dominant character, each person keeps one camera: the dominant is always slightly low and the other slightly high (section 1.4). Grammar then copies that angle onto their reaction shots, which come from the same camera.

- A speaking shot never goes tighter than a close-up, because the mouth must read (the Veo realism work).
- When intensity is ≥ 0.85, the shot goes one size tighter.
- Dialogue with two or more people is built from singles: a medium with a line becomes a medium close-up.

### 1.4 Camera angle and power
Experimental work supports the classic grammar: **low angles raise perceived potency/power, high angles lower it**.
- Mandell & Shaw (1973): https://link.springer.com/content/pdf/10.3758/BF03197032.pdf
- Kraft (1987), summarised in https://digitalcommons.odu.edu/cgi/viewcontent.cgi?article=1833&context=psychology_etds
- Google's Veo prompt guide describes low angles the same way ("making the subject appear powerful or imposing") and high angles as making the subject "small, vulnerable". https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide

**Clean vs dirty singles:**
- A clean single, with nobody else in frame, isolates a character or signals distance.
- A dirty single or over-the-shoulder, with a soft foreground shoulder, keeps the two connected.

Sources: https://www.studiobinder.com/blog/over-the-shoulder-shot/ and https://flashboards.yaroflasher.com/learn/camera-shots/single-shot/

**In Lucy:**
- `dominantCharacter()` scores who holds the power. Being addressed as "Mr./sir" adds points, as do giving orders ("not an option", "come back…") and sitting behind the desk or leaning back. Pleading, nodding quickly and leaning forward subtract.
- The dominant character's coverage is slightly low and the subordinate's slightly high, written as "slightly low/high angle" (subtle, not a worm's-eye view).
- The angle is consistent per character, so a reused setup stays the same camera.

### 1.5 Motivated camera movement
The camera moves for a story reason:
- it follows a character's action;
- it reveals information;
- it reflects an emotional shift, such as a slow push-in on a realisation.

It never moves just because moving looks "cinematic", and stillness is often stronger.
Sources:
- https://howtofilmschool.com/dictionary/motivated-camera-movement/
- https://nofilmschool.com/2014/02/how-to-motivate-your-camera-movement-tutorial-from-film-riot
- Bordwell (above) on push-ins.

**In Lucy** (`motivatedMove`), the camera may move only when one of these is true:
- **someone travels** (walks, crosses, heads for the door), and then the camera tracks with them;
- it's a push-in at a rising beat (intensity ≥ 0.5), a peak or a reveal;
- it's a pull-back on a reveal, a release or a button.

Other rules:
- Standing up or turning on the spot does not make the camera travel.
- A closing wide lets people walk out of frame rather than following them.
- Whip pans, crash zooms and dolly zooms are only allowed in the chase recipe.

### 1.6 Average shot length norms (Cinemetrics)
- **By genre, 1997–2016, Cinemetrics data** (Stephen Follows): action 4.0s, adventure 5.1s, sci-fi 6.2s, horror 15.7s. The average film has 1,045 shots; documentaries have the fewest (491). https://stephenfollows.com/p/many-shots-average-movie
- **Trend:** Cutting et al. (2011), "Quicker, faster, darker", studied 160 films from 1935–2010. ASL fell from about 10s in the 1930s–40s to under 4s after 2000, and the trend holds across action, comedy and drama. https://pmc.ncbi.nlm.nih.gov/articles/PMC3485803/
- **Database:** Barry Salt's shot-length database. https://cinemetrics.uchicago.edu/barry-salt-database
- **Ads and social** (from `shot-pacing-research.md`): TV commercials averaged 2.3s in 1991 (MacLachlan & Logan 1993) and Super Bowl ads about 2.0s. TikTok's 1–3s is trade consensus only.

**In Lucy:**
- The style bands in `filmScience.ts` (cinematic 4.5–7s, commercial 1.5–2.5s, ugc 3–5s, music video 1.5–3.5s, documentary 4–8s) set each beat's duration range.
- The review compares the plan's ASL to the band.
- Because the engines film clips of at least about 4s, a band below that is judged against 4s (**Lucy's choice**).
- A spoken line always gets the time it needs (2.5 words/s plus a beat, from PR #40).

### 1.7 Coverage patterns by scene type (`recipes.ts`)

**Power dialogue: the *Wall Street* Gekko office scene.**
Secondary summaries (treat as such) describe it this way:
- Bud is dwarfed by the vast office.
- Gekko is heard before he is fully revealed.
- A restless, predatory Steadicam (Robert Richardson) circles the power.
- The blocking keeps Bud subordinate.

Sources: https://1st5minutes.substack.com/p/wall-street-1987 and https://en.wikipedia.org/wiki/Wall_Street_(1987_film). Bordwell adds Stone's long-lens/wide-lens cutting.

Lucy's recipe:
- a wide that makes the newcomer small;
- a slightly high single on the newcomer and a slightly low, still single on the powerful one;
- tightening singles;
- a reaction at the power shift;
- a close-up push-in on the line the scene hangs on;
- back to the wide.

The circling Steadicam is deliberately **not** copied. Higgsfield (section 2) finds multi-direction moves distort, so Lucy keeps the power in angle and stillness, and moves only when a character moves.

**Walk-and-talk** (*The West Wing*):
- Thomas Schlamme says the Steadicam served three goals: energy in dense dialogue, urgency ("important information can be exchanged on the move"), and seamless transitions from character to character. https://www.dga.org/craft/dgaq/issues/1703-summer-2017/shot-to-remember-the-west-wing
- See also https://theasc.com/magazine/oct00/power/pg3.htm

Lucy's recipe:
- a leading shot to open;
- tracking singles;
- **they stop, and the camera stops, for the line that matters**;
- a button where one walks on.

**Phone call:**
- Intercut matched reverses: one caller looks screen-right and the other screen-left, at the same lens, height and size, tightening together.
- Sources: https://flashboards.yaroflasher.com/learn/camera-shots/shot-reverse-shot/ and http://frankenbiter.blogspot.com/2011/09/how-to-shoot-phone-conversation.html (a practitioner blog).
- Grammar change in this PR: cutting back to a place already established (the intercut) no longer forces a new establishing wide. This matches Bordwell's "fewer establishing shots".

**Reveal:**
- Withhold, push in, show and hold, then cut to the face it lands on.
- Reaction shots anchor the audience to a human response; inserts give detail in the scene's own geography.
- Sources: https://www.toolsforfilm.com/glossary/reaction-shot, https://www.toolsforfilm.com/glossary/insert-shot, https://wolfcrow.com/types-of-shots-used-in-dialogue-scenes/

**Group meeting** (**Lucy's choice**, built on Katz's staging and Bordwell's singles):
- a master for the geography;
- singles on whoever speaks;
- a group reaction when the key line lands;
- at most three faces per frame (see section 2 on crowds).

**Chase / action:**
- Energy comes from editing, not from camera acrobatics.
- Short shots, geography first, one action and one move per shot, detail inserts, and a wide to finish.
- ASL around 4s for action (Follows), and Higgsfield's distortion guidance (section 2).

**Selfie vlog** (*Chloe vs History*): section 2.

**Monologue / confession** (**Lucy's choice**): a clean single that creeps closer shot by shot, the peak line held in close-up, then a pull-back.

**Product / insert:** macro detail, a slow slide, the product held in a final frame. Readable labels only on Kling 3.0 (section 3.3).

---

## 2. What makes AI films read as real

**Chloe vs History.** Creator Jonathan Laramy makes it with Seedance 2.0, drawing on historical sources.
- The AI hallucinated sunglasses and wristwatches in Rome, which had to be caught.
- The format works because "people get attached to a particular character".
- Sources: The Guardian, https://www.theguardian.com/technology/2026/may/26/we-can-stitch-together-our-past-the-ai-generated-time-travellers-vlogging-from-history, and Business Insider, https://www.businessinsider.com/chloe-vs-history-ai-not-real-how-she-was-created-2026-6
- A Frontiers paper describes the format as "shots from the subjective perspective of the protagonist, direct look at the camera, spontaneous comments and emotional reactions in real time", made by a one-person production. https://www.frontiersin.org/journals/communication/articles/10.3389/fcomm.2026.1927762/full
- Lucy's realism diagnosis measured Chloe's disfluency ("I'm in, I'm in, I'm fine") and a continuous ambience bed (about −14 LUFS, with a steady dialogue level). See `/workspace/reports/lucy-realism-diagnosis.md`.

**Higgsfield, "How to make AI video look real" (2026).** https://higgsfield.ai/blog/ai-video-look-real-2026
- Fakeness comes from light with no named source, weightless motion, and a camera that is too smooth.
- The fixes: name the light source, describe weight and footfalls, and add slight handheld drift.
- "Cinematic" and "realistic" are not instructions.

**Higgsfield, "How to avoid distortions".** https://higgsfield.ai/blog/how-to-avoid-distortions-ai-videos
- Avoid extreme or multi-direction camera moves; use smooth single-direction moves and **build energy through editing**.
- Describe an action by its start and end positions.
- Change one variable between shots.
- Keep clips short and chain them via the last frame.
- **Multi-character interaction and dynamic action distort most.** Two characters sharing a close-up blur identity where they intersect.
- Use location reference images.

**Higgsfield camera control.** https://higgsfield.ai/blog/ai-video-camera-control
- State the speed, the path and the end framing.
- Distinguish a dolly (the camera moves) from a zoom (the lens changes).

**PJ Accetturo's Kalshi ad.** https://threadreaderapp.com/thread/1932893260399456513.html
- Re-describe the setting, character and tone in every prompt.
- Work in batches of five prompts. It took 300–400 generations for 15 usable clips.
- "Handheld… raw street footage" reads real.
- Unexpected subtitles do happen.
- All caps or "screaming at the top of their lungs" gets yelling.

**Designerbox (secondary).** https://designerbox.ai/blog/realistic-ai-video-prompts/
- Keep shots to 3–6s.
- Don't stack actions or camera moves in one shot.

**The Neilson takes** (Lucy's own evidence): Lawrence's clasped hands melt at 0:32 in both versions (PR #40).

**In Lucy** (`playbooks.ts safeStaging`), failure-prone actions are rewritten before any model sees them, and each swap is listed in the review:

| Risk | Example | Swapped to |
|---|---|---|
| Clasped or interlocked hands | "hands clasped", "steeples his fingers" | "hands resting apart and still" |
| Fidgeting hands | "fidgets with her ring", "drums his fingers" | "hands resting still", "rests his hand flat" |
| Crowds of faces | "a crowd of hundreds of people" | "a few soft, out-of-focus figures far in the background" |
| Readable text or screens (not on Kling 3.0) | "reads the letter", "the words on the screen" | "looks down at the letter, its page angled away from camera" |
| Eating or drinking in close (not in wides) | "takes a sip of his coffee" | "holds the coffee still in one hand" |
| Fast full-body action | "sprints down the alley", "backflip", "punches the guard" | "hurries down the alley", "vaults over a low rail", "lunges at the guard, the blow landing just out of frame" |

Harmless phrases are deliberately left alone: "swallows once", "runs a hand through her hair", "taps one finger on the desk". Google's own guide lists "fingers tapping impatiently" as a usable subtle action.

The review also warns when a shot stacks three or more actions ("one action per shot").

---

## 3. Prompting each model

### 3.1 Veo 3.1
**Official sources:**
- Google Cloud blog, "Ultimate prompting guide for Veo 3.1": https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1
- Vertex AI prompt guide: https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide
- Gemini API Veo docs: https://ai.google.dev/gemini-api/docs/veo

**Structure.** [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance].

**Length and clips.**
- Clips are 4, 6 or 8s.
- 1080p/4K and reference images require 8s.
- 16:9 or 9:16, 24fps (Gemini API docs).
- The Gemini API now suggests Gemini Omni Flash as a default and Veo 3.1 for extension and frame control: https://ai.google.dev/gemini-api/docs/video

**Dialogue and audio.**
- Put speech in quotes with attribution: `A man murmurs, 'This must be it.'` or `The detective says: Your story has holes.`
- Describe SFX explicitly and ambient noise as the place's soundscape.
- The ingredients-to-video workflow uses one shot per line.
- Timestamp prompting ([00:00-00:02]) supports cuts such as "Reverse shot".
- **Lucy's formatter** puts the line in the first third. A secondary source says wides and mediums hide lip errors while tight close-ups expose them: https://prompt-architects.com/blog/101-veo-dialogue-prompts

**Camera terms Veo documents** (Vertex guide):
- Angles: eye-level, low-angle, high-angle, bird's-eye/top-down, worm's-eye, Dutch.
- Sizes: close-up, extreme close-up, medium, full, wide/establishing, over-the-shoulder, POV.
- Moves: static/fixed, pan, tilt, dolly in/out, truck, pedestal, zoom (different from a dolly), crane, aerial/drone, handheld, whip pan, arc.
- Lens: wide-angle, telephoto, shallow/deep focus, macro.
- Editing: match cut, jump cut, montage.
- The guide warns that "some advanced camera angles are not officially supported".

**Negatives.** Describe what you don't want rather than writing "no"/"don't" (for example `wall, frame`). Lucy sends these as Vertex `negativePrompt`.

**Strengths:** production-proven native speech and lip sync, and faces and light (Lucy's own tests).

**Lucy's Veo vocabulary** (`CAMERA_VOCAB.veo`): "Static shot, locked-off camera", "Slow dolly in toward Lawrence", "Tracking shot: the camera trucks alongside…", "Slow arc shot around…", "Slow zoom in (a lens zoom, the camera itself stays put)".

### 3.2 Seedance 2.x
**Official source.** BytePlus ModelArk Seedance 2.0 prompt guide: https://docs.byteplus.com/en/docs/ModelArk/2222480
- The page is JavaScript-rendered and could not be read by the research tools this time. The claims below come from the pages that could be read.
- The official Seedance 2.5 guide is summarised in `seedance-2.5-official-prompt-guide-learnings.md`. It covers 1–5 subjects for audio/video refs, 1–8 for images, and avoiding edit/extend trigger words.
- BytePlus model page: https://docs.byteplus.com/en/docs/modelark/1587798. It describes native multi-shot consistency, multi-subject interaction and a "fixed shot" option.

**fal's Seedance 2.0 guide:** https://fal.ai/learn/tools/seedance-2-0-prompting-guide
- Subject and Motion are required; Environment, Look, Camera and Audio are optional.
- **Spend words on verbs and physics consequences.**
- Dialogue goes in double quotes. Keep lines short and split long speech across cuts.
- Use "cut to" for multi-shot.
- It **reliably reads dolly, pan, tilt, crane, push-in, rack focus, locked-off**.
- Write "no music".
- Duration is 4–15s or auto.

**Field reference** (unofficial): https://github.com/emily2040/seedance-2.0/blob/HEAD/references/multishot-grammar.md
- "Shot 1 / Shot 2" labels.
- One action and one camera move per shot, about 4–6s each, and 2–3 shots per 10–15s.
- Fast tiers are less reliable at multi-shot.

**SeedanceTips:** https://seedancetips.com/guides/multi-shot-storytelling/. The fixed-lens setting keeps the camera static.

**Strengths:** multi-shot motion and consistency, multi-subject interaction, and the handheld selfie vlog format (*Chloe vs History* is made on Seedance 2.0).

**Lucy's vocabulary** (`CAMERA_VOCAB.seedance2`): "Fixed shot, locked-off camera", "Slow push-in on Liam", "Slow pull-back". Moves outside fal's list are flagged by the review with the nearest reliable move (`reliableMove`).

### 3.3 Kling 3.0
**Official source.** Kling 3.0 user guide: https://kling.ai/quickstart/klingai-video-3-model-user-guide
- Multi-Shot and Custom Multi-Shot, up to 6 shots, 3–15s.
- It understands shot-reverse-shot, cross-cutting and voice-over.
- Native audio with multi-character coreference in 5 languages, including accents and dialects.
- Element binding with voice.
- **Native text rendering.**
- Custom multi-shot examples such as "Shot 1, profile shot…, cinematic handheld".

**fal's Kling 3.0 guide:** https://blog.fal.ai/kling-3-0-prompting-guide/
- Label speakers `[Character A: Role, voice tone]: "line"`, with unique, consistent labels and no pronouns.
- Put the action before the line.
- Use "Immediately," between speakers so speech doesn't merge.
- **Describe motion explicitly over time**, because the camera freezes when the subject pauses.
- Anchor subjects early.
- For image-to-video: "lock first, then move".

**Higgsfield:** Kling 3.0 simulates cloth, hair and collisions with weight transfer.

**Strengths:** native lip-sync dialogue when two people speak in one frame, text and labels, and physical weight.

**Lucy's vocabulary** (`CAMERA_VOCAB.kling3`): every move is phrased over time, for example "The camera slowly pushes in toward Liam's face over the whole shot" or "The camera stays completely fixed for the whole shot". Readable text is not swapped out on Kling.

### 3.4 Per-shot engine suggestion (`recommendEngine`)
**Lucy's choice**, from the strengths above. **It is only ever a suggestion:** one engine films the whole film, the customer picks it, and Lucy never switches it (so it never changes the price).

| Shot | Suggested | Why |
|---|---|---|
| Dialogue single or close-up | Veo 3.1 (Best/Fast) | speech and lip sync |
| Two people in frame with a line (two-shot, master) | Kling 3.0 | multi-character coreference, native lip sync |
| Selfie or phone format, walking, tracking or fast motion | Seedance 2.x (2.5 with audio) | multi-shot motion, the vlog format |
| Product insert with a label | Kling 3.0 | native text rendering |
| Silent reaction or insert | Veo 3.1 | faces, detail |

If the current engine is already in the suggested family (for example Veo Fast for a Veo shot), there is no suggestion. If the suggested engine isn't available, the next available one is shown; if none is, the suggestion says so.

---

## 4. The Director's review (`review.ts`)
A free, instant score out of 100, with a grade from A to D, before anything is generated. It covers:

- **Coverage grammar (25%):** speaker on camera, a master to open, no jump cuts, a reaction in a 4+ line scene.
- **180-degree rule (15%):** screen sides and eyelines.
- **Beats and framing (20%):** the scene has a shape, the peak isn't the first shot, and each shot's size matches what the engine plus grammar would choose for its beat. It also flags moves the chosen model doesn't reliably honour.
- **Shot rhythm (10%):** ASL against the style band, silent shots that drag, and dialogue shots much longer than their line.
- **Risky actions (20%):** section 2, plus stacked actions.
- **Prompt length (10%):** over the model's word budget, or the action, blocking, people, wardrobe or listeners dropped to fit.

**Apply fixes** does the following:
- swaps in safer staging;
- re-frames only the flagged shots to the engine's choice;
- swaps to reliable moves;
- trims draggy shots;
- re-runs the grammar last.

It never changes a line, a speaker or the number of shots, and it is idempotent.

---

## 5. Honest limits
- The Seedance 2.0 BytePlus prompt guide couldn't be rendered. Seedance guidance relies on fal's guide, the BytePlus model page and the existing 2.5 doc.
- The *Wall Street* analysis is from secondary summaries, not a shot-by-shot count.
- Kling's "reliable moves" list is conservative, drawn from the official guide and fal's examples, and hasn't been measured.
- Beat tagging from keywords is a heuristic. The LLM planner is asked to supply `beatFunction` and `intensity` itself, and those values win.
- The risky-action rewrites are phrase lists. They catch common wordings, not every way of writing an action.
- The engine suggestion is a rule table built on published strengths. Lucy hasn't run a paid A/B across engines.
