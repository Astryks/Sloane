# Director Mode: World Library & Timed Storyboards

Extends `web/src/lib/directorMode.ts` (the core 4-axis engine - see `docs/director-mode-cinematography-research.md`) with two things: a **timed, per-second storyboard generator** (real shot-length data, per-beat camera direction, subtle performance detail, and the off-screen-voice reaction-shot technique), and a **world-detail content library** (`web/src/lib/directorModeElements.ts`) covering wardrobe, characters, objects, locations, cities, culture/cuisine, music mood, and dialogue language.

## Timed storyboards (`buildTimedStoryboard`)

Per direct request ("implement a detailed storyboard and give directions per second"): splits a clip into real, timed beats instead of one flat paragraph, using actual academically-sourced average-shot-length (ASL) data - see `docs/shot-pacing-research.md` for the full research and citations (James Cutting/Psychological Science, MacLachlan & Logan/Journal of Advertising Research, Stephen Follows/Cinemetrics, Barry Salt/Bordwell).

**`PACE_PRESETS`** - 5 steps, each anchored to a real, cited figure:

| Pace | Range | Real anchor |
| --- | --- | --- |
| Rapid | 1.5-2.5s | Super Bowl ads 2.0s, TV commercials 2.3s (MacLachlan & Logan 1993) |
| Brisk | 2.5-5s | Adventure genre 5.1s (Follows/Cinemetrics) |
| Measured | 5-7s | Sci-fi 6.2s (Follows/Cinemetrics) |
| Contemplative | 8-13s | Classic Hollywood 8-12s (Bordwell/Salt), TV broadcast 8.9s (MacLachlan & Logan) |
| Slow cinema | 15-30s | Horror genre average 15.7s as the floor (Follows/Cinemetrics) |

**Real finding worth calling out**: horror as a genre averages *slower* shots (15.7s) than any other studied genre except deliberate slow cinema - contradicting the "fast jump-scare cuts" assumption. `defaultPaceForGenreKinetic` encodes this: horror defaults to the slowest bucket, not the fastest.

**Per-beat direction** includes:
- A camera move cycled through `CAMERA_MOVEMENT_LIBRARY` (wide-to-tight coverage order within the same category, not repeating the same move every beat).
- A specific **micro-performance detail** ("a flicker of real emotion crosses their eyes just before they speak," "their jaw tightens almost imperceptibly") - real acting/directing vocabulary, cycled deterministically per beat index (same prompt always produces the same storyboard).
- **Dialogue-scene detection**: when the prompt reads as a two-person exchange (2+ quoted lines, or words like "conversation"/"argument"/"talking to"), beats alternate which subject is on-camera, and listener beats get the real **off-screen-voice reaction-shot note** - a genuine, widely-used editing technique (shot/reverse-shot with off-screen dialogue, sometimes called an L-cut), matching the direct request: "sometimes the camera is at one person but it is the voice of the other person."

**Background/environment is scripted, not left to chance** (per direct request): `BACKGROUND_ACTION_BY_GENRE` gives each genre bucket a specific, concrete background-activity description (e.g., horror's "unnervingly still and empty, or a single indistinct figure/shape visible far in the distance" vs. kinetic action's "debris and dust kick up in the background") stated once as continuity at the top of the storyboard, not repeated per beat.

**Setting/vehicle and weather** are also detected and folded in: `SETTING_LIBRARY` covers car/train/bus/boat/plane with real camera conventions (e.g., car: "framed from the passenger seat or dashboard mount, steering wheel and hands visible, scenery streaking past with natural motion blur"), and `WEATHER_LIBRARY` (11 entries: golden hour, dawn, blue hour, fog, snow, rain, wind, etc.) reuses the real color-temperature-based approach already proven in `productAdStoryboard.ts`'s `LIGHTING_PRESETS`.

## Real bugs found and fixed while testing this

Testing `buildTimedStoryboard` against a genuinely quiet dialogue prompt (`"I never wanted this," she said. "Neither did I," he replied, looking away.`) surfaced two real, compounding bugs - both only visible by running real test prompts, not by reading the code:

1. **`detectKinetic`'s fallback defaulted to "dynamic" unconditionally** when neither action nor static words matched - a quiet two-person dialogue scene with no motion verbs at all got classified as "dynamic," producing "handheld camera shaking in rhythm with the subject sprinting." Fixed: a detected dialogue scene now tie-breaks toward "static" before falling through to the generic default.
2. **`defaultPaceForGenreKinetic` checked its own catch-all fallback genre (`commercialUgc`) first and unconditionally returned "rapid"** (the real Super Bowl/TV-commercial ASL anchor) - since a prompt with no specific genre signal falls back to `commercialUgc`, *any* ambiguous non-commercial prompt (including the dialogue example above) inherited ad-pacing and got cut every ~2 seconds. Fixed: dialogue detection is now checked before the commercialUgc fallback, defaulting to "measured" (real shot/reverse-shot pacing) instead.
3. **`detectCameraMove`'s fallback only considered kinetic, not genre** - the horror mansion example (`"A gloomy, ominous mansion at midnight, shadows creeping across the walls."`) correctly resolved to the horror genre (and correctly got the slow-cinema pace from fix #2's neighbor), but the camera move itself still fell back to "handheld shaky running," clashing badly with a scene meant to hold still and build dread. Fixed: horror, epic drama, intimate/emotional, and vintage genres now fall back to deliberate static moves (silhouette reveal for horror specifically, slow push-in for the others) instead of the generic action default.

All three were caught by writing and running real test prompts through the actual assembled output (not just unit-testing individual detector functions in isolation) - the same discipline that caught the regex word-boundary bugs documented in `docs/director-mode-cinematography-research.md`.

## World library (`directorModeElements.ts`)

Split into a separate file purely to keep the core engine readable - these are large, mostly-static reference libraries, not logic.

| Library | Count | Detection |
| --- | --- | --- |
| `WARDROBE_LIBRARY` | 105 (40 male, 42 female, 23 kids) | Picker only (`wardrobeById`, `wardrobeByGender`) - clothing descriptions are multi-word phrases too ambiguous for reliable freeform auto-detection |
| `CHARACTER_LIBRARY` | 109 (32 male, 32 female, 20 kids, 25 animals) | Picker only (`characterById`, `charactersByCategory`) |
| `OBJECT_LIBRARY` | 209, across 21 categories (tech, food & drink, furniture, nature & plants, vehicles, tools, accessories & jewelry, stationery & books, music, sports, kitchenware, toys, decor, weather, personal items, celebration, office, gardening, beauty, travel, holiday) | Both - `detectObjects()` does simple label substring matching, plus `objectsByCategory()` for a picker |
| `LOCATION_LIBRARY` | 36 | Auto-detected via `detectLocation()` |
| `CITY_LIBRARY` | 46 | Auto-detected via `detectCity()`, wired directly into `expandCinematicPrompt`'s `[Location Detail]` block |
| `CULTURE_CUISINE_LIBRARY` | 20 | Auto-detected via `detectCultureCuisine()`, wired into `[Culture/Cuisine]` |
| `MUSIC_MOOD_LIBRARY` | 25 | Auto-detected via `detectMusicMood()`, wired into `[Music]` - **prompt-only influence on native model audio generation, not a real audio track** (see the "Real, playable music" section below) |
| `LANGUAGE_LIBRARY` | 36 | Auto-detected only from explicit phrasing ("in French," "French dialogue") via `detectLanguage()`, wired into `[Dialogue Language]` - deliberately never inferred from a detected city/culture, since that would silently override what the user actually asked for |

All entries have verified-unique ids (checked programmatically, not just visually).

### Real, playable background music - a genuinely separate feature, not yet built

`MUSIC_MOOD_LIBRARY`'s detected mood becomes a text clause in the expanded prompt (e.g., "a smoky, relaxed jazz trio playing in the background") - this only *asks* the video model to imply that mood in whatever audio it natively generates, which is not a reliable way to get specific, controllable background music; these models aren't built for that.

Actually audible, chosen music would be a different, separate feature: a small library of real, properly-licensed royalty-free tracks (e.g., from a genuine CC0/public-domain source, license-verified per track) muxed directly into the export via `/stitch`'s existing multi-track audio system (which already supports per-track volume, fades, and ducking under dialogue) - bypassing the video-generation model entirely. Not built in this pass: sourcing and licensing real audio files is a distinct task from the text-prompt-engine work here and deserves its own care, not a rushed addition alongside everything else.

## Multi-cam sitcom technique (Friends) - researched, not yet encoded as a library

Researched for contrast against the single-camera film techniques in `docs/director-mode-cinematography-research.md`. General multi-cam sitcom mechanics are well documented across independent trade sources: a 3-4 camera setup (a center camera holding the wide "master shot," two outer cameras for close-ups/cross-shots of whoever is speaking), a live "line cut" built by switching between camera feeds in front of a studio audience, and broader/flatter lighting than single-camera work since it has to serve several simultaneous angles at once rather than being customized per shot.

Friends-specific shot-pattern claims (couch-blocking geometry, door-entrance framing conventions) rest on much thinner sourcing - mainly one blog-level cinematography analysis, not a primary interview or trade-technical document - and are not encoded into `GENRE_STYLE_LIBRARY` as a result; the general multi-cam mechanics above are solid enough to add as a genre bucket later if there's a real product use case for sitcom-style output, but weren't added speculatively in this pass.
