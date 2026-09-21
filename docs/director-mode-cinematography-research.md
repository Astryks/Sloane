# Director Mode: Cinematography Research & Engine Reference

This is the research and design record behind `web/src/lib/directorMode.ts` - a deterministic engine that expands a user's plain prompt ("a detective walking through rain") into a structured, technically-specific cinematic prompt for an AI video model (Seedance/Kling/Veo via fal.ai), the same idea Higgsfield ships as its prompt-expansion layer.

**Why deterministic, not an LLM call**: this project has twice already chosen template-based prompt engineering over adding a paid LLM dependency (see `productAdStoryboard.ts` and `adStudioStoryboard.ts` - no `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` configured anywhere, by deliberate choice). Director Mode follows the same convention: real research grounds a curated lookup table, matched by keyword detection, not a live model call.

**Why real films instead of invented adjectives**: the goal is the same "concrete numbers over vague words" discipline already proven in `SHOT_LIBRARY` (productAdStoryboard.ts's real focal lengths/movement distances). Every technique below is sourced from a real, documented DP interview or trade-press article - not guessed. Gaps are flagged explicitly where a source couldn't be verified, rather than invented to fill them.

**Copyright note**: nothing here reproduces footage, frames, or copyrighted material - only publicly documented *technique* (lens choices, camera formats, lighting philosophy), the same kind of factual information a film school or cinematography textbook teaches.

---

## Part 1: The Four-Axis Framework

`directorMode.ts` expands a prompt along four independent axes:

| Axis | What it controls | Detected from |
| --- | --- | --- |
| **Scale** | Focal length + aperture (intimate portrait glass vs. wide establishing glass) | Emotion/dialogue words vs. world/landscape words |
| **Kinetic** | Camera rig + motion (handheld/tracking energy vs. slow contemplative movement) | Action words vs. static/still words |
| **Genre** | Camera body/format, film stock or color science, base aspect ratio, lighting philosophy | Genre-specific vocabulary (10 buckets) |
| **Atmosphere** | A 5-step light-to-dark gradient (exposure, contrast, color temperature) | Weighted count of light-coded vs. dark-coded words |

Scale and Kinetic map directly onto Part 1 of the framework this was built from ("Scale & Emotion" and "Kinetic Energy"); Genre maps onto "Genre Priors." Atmosphere is a fourth axis added on top, since genre alone doesn't capture whether a scene should read as bright/airy or dark/moody within that genre - the same visual idea as Higgsfield's mood-gradient slider, built as a real graduated scale (5 steps, weighted scoring) rather than a binary switch, so a prompt with several light or dark signal words lands further out on the gradient than one with a single mild signal.

---

## Part 2: Film Research by Genre Cluster

Researched via WebSearch/WebFetch against American Cinematographer (theasc.com), trade-press DP interviews (No Film School, IndieWire, Filmmaker Magazine, British Cinematographer), and technical-spec databases (ShotOnWhat). Every fact below is sourced; anything that couldn't be verified is flagged rather than filled in with a guess.

### Cluster A: Sci-Fi / Thriller / Noir / Action

**Blade Runner 2049** (dir. Denis Villeneuve, DP Roger Deakins) - ARRI Alexa (XT/65, Mini), open-gate 1.55:1; Zeiss Master Primes (32mm for character framing, 14-16mm for scale); custom Tiffen filter combinations per location (Lee 790 Moroccan Pink + 105 Orange for Las Vegas' red haze); deliberately static camera on dolly/crane rather than handheld; heavy in-camera practical rigging (35 dimmer-chased 10K Fresnels in Wallace's office). *Source: American Cinematographer, "Uncanny Valley."*

**The Dark Knight** (dir. Christopher Nolan, DP Wally Pfister) - hybrid IMAX MKIII/MSM (15/70mm, ~28-30 min of footage) cut with 35mm Panavision Panaflex for the rest; Kodak Vision2 250D (daylight)/500T (night); 1.43:1 in IMAX houses, 2.39:1 standard. *Source: No Film School, ShotOnWhat.*

**Mad Max: Fury Road** (dir. George Miller, DP John Seale) - ARRI Alexa Plus/M, shot ARRIRAW, almost entirely on zooms (no primes carried) including custom 16mm mini-primes built by Panavision; day-for-night via 2-stop overexposure; two Steadicam rigs plus stabilized crane arms covering ~40% of action sequences; ~80% of the film manipulated in an 8-month DI. *Source: British Cinematographer, No Film School.*

**Se7en** (dir. David Fincher, DP Darius Khondji) - Aaton 35-III/Panaflex Gold, Panavision Primo primes; Kodak 5293 pushed one stop, negative flashed, then run through Deluxe's CCE bleach-bypass-style process for near-black blacks; mixed warm-practical/cool-HMI lighting, deliberate 2-stop underexposure on interiors. *Source: American Cinematographer, "Conversations with Darius Khondji."*

**No Country for Old Men** (dir. Coen Brothers, DP Roger Deakins) - ARRICAM LT/Arriflex 535B, Super 35mm, Kodak Vision2; Zeiss Master Primes chosen partly for f/1.3 night-work aperture (confirmed directly by Deakins on his own forum); wide-angle lenses used to emphasize landscape isolation. *Source: rogerdeakins.com forum, Deakins' own words.*

**Heat** (dir. Michael Mann, DP Dante Spinotti) - anamorphic, entirely on Kodak 5298 (500 ASA) pushed one stop; Panavision Primo primes; tungsten stock shot in daylight without 85 filters to push blue-green tones; a lighting philosophy of "lighting areas of the whole scene" rather than individual shots, to support simultaneous multi-camera setups. *Source: American Cinematographer, "Hot Set: Shooting Heat."*

**The Matrix** (dir. Wachowskis, DP Bill Pope) - Panavision Platinum, Super 35, Kodak Vision 200T/500T; green color timing for "Matrix" reality (Pope: "What is the most unappealing color? ... we all agreed on green") vs. cooler 1/4 CTB tungsten for the "real world"; signature bullet-time achieved via a still-camera photo array, not a moving film camera. *Source: American Cinematographer, "Welcome to the Machine."*

**Children of Men** (dir. Alfonso Cuarón, DP Emmanuel Lubezki) - Arricam Lite/Arri 235, Super 35mm, 1.85:1; primarily 18mm Master Primes to hold an objective, wide distance; documented ~7-minute unbroken tracking take; an explicit anti-lighting philosophy ("I didn't want it to feel lit") relying on natural/diegetic practicals; almost entirely handheld, deliberately avoiding Steadicam. *Source: American Cinematographer, "Humanity's Last Hope."*

**Drive** (dir. Nicolas Winding Refn, DP Newton Thomas Sigel) - ARRI Alexa (800 ASA, pushed to 1600), 2.40:1; primary lens an Angenieux Optimo 15-40mm zoom; palette referenced retro Kodachrome/Ektachrome photo looks, heavy on red per Refn's (colorblind) direction. *Source: American Cinematographer, "Road Warriors."*

**John Wick** (dir. Chad Stahelski, DP Jonathan Sela) - ARRI Alexa XT (ARRIRAW); a deliberate two-look design: retired-life scenes shot soft/clean with static anamorphic framing, the assassin underworld shot grittier/sharper and largely handheld. *Source: ARRI, "ALEXA XT on John Wick."*

### Cluster B: Drama / Epic / Emotional

**The Godfather** (dir. Francis Ford Coppola, DP Gordon Willis) - 35mm Panaflex, 1.85:1; Willis's signature 40mm focal length; brown/black-dominant "newspaper photo in bad color" look via dye-transfer printing; top-lit Brando to obscure his eyes; a philosophy of using existing location light rather than re-manipulating it. *Source: American Cinematographer, "On Location with The Godfather."*

**Schindler's List** (dir. Steven Spielberg, DP Janusz Kamiński) - Arriflex 35-III/535, black-and-white on Kodak 5231/5222, 1.85:1; an unusually wide 29mm for close-ups, chosen for documentary realism over glamorization; deliberately "imperfect" handheld-from-the-dolly-seat camerawork; color returns only for the red coat and the closing Jerusalem scene. *Source: American Cinematographer, "Finds Heroism Amidst Holocaust."*

**There Will Be Blood** (dir. Paul Thomas Anderson, DP Robert Elswit) - Panaflex Platinum, anamorphic 35mm, 2.40:1; fixed focal lengths only, no zooms; natural daylight exteriors with practicals (oil lamps, candles) for interiors, no artificial fill, photochemical grading only. *Source: American Cinematographer.*

**The Lord of the Rings: The Fellowship of the Ring** (dir. Peter Jackson, DP Andrew Lesnie) - 21 cameras total, Super 35, 2.35:1; location-specific color design (Shire warm gold/green, Rivendell autumnal lavender/salmon, Moria desaturated gray); Jackson's stated philosophy of "camera as an active participant." *Source: American Cinematographer, "Ring Bearers."*

**12 Angry Men** (dir. Sidney Lumet, DP Boris Kaufman) - 35mm B&W, 1.85:1; a documented "lens plot" starting wide (emphasizing distance between jurors) and progressively narrowing focal length as the room feels like it's closing in; camera height drops across the three acts (above eye level → eye level → below, ceiling visible). *Source: American Cinematographer, No Film School.*

**The Shawshank Redemption** (dir. Frank Darabont, DP Roger Deakins) - Arriflex 35 BL4S, Kodak 5293, 1.85:1; Zeiss primes, avoided zooms; no 85 correction filter on daylight, deliberately preserving cool shadows that gradually warm toward the ending; a "heightened naturalism" lighting philosophy. *Source: American Cinematographer, "Flashback."*

**Whiplash** (dir. Damien Chazelle, DP Sharone Meir) - ARRI Alexa, 2.35:1; Cooke Speed Panchro/Leica Summilux-C/Angénieux Optimo; low-key warm light associated specifically with the antagonist's scenes; handheld for intensity, Steadicam for drumming sequences.

**Moonlight** (dir. Barry Jenkins, DP James Laxton) - ARRI Alexa XT in 4:3 sensor mode shooting true anamorphic to 2.39:1; three distinct film-emulation LUTs matched to the film's three life chapters (Fuji for childhood, Agfa for adolescence, Kodak for adulthood). *Source: ARRI, "Poetic Look on ALEXA."*

**Saving Private Ryan** (dir. Steven Spielberg, DP Janusz Kamiński) - Aaton 35-III/Panaflex, Kodak EXR 5293 pushed to 400 ASA, 1.85:1; anti-reflective coatings deliberately stripped from lenses to increase flare and reduce contrast, emulating 1940s optics; 70% ENR bleach-bypass process; ~90% handheld with a mechanical-vibration rig; 45° shutter angle for explosions, 90° for handheld running. *Source: American Cinematographer.*

**In the Mood for Love** (dir. Wong Kar-wai, DP Christopher Doyle) - Arriflex 35 BL4/535, Kodak Vision 500T/800T, 1.66:1; a conscious avoidance of red despite its cultural significance, an intentional negative-space choice; predominantly static, painterly, doorway-heavy compositions. *Source: IndieWire.*

### Cluster C: Horror / Found-Footage / Gritty / Vintage

**The Blair Witch Project** - Cinema Products CP-16 (16mm) for "documentary" footage, a consumer Hi8 camcorder for "video diary" footage, mixed-format found-footage; 1.33:1; actor-operated handheld cameras, no rigs, genuine amateur instability. *Source: Inverse, ShotOnWhat.*

**Hereditary** (dir. Ari Aster, DP Pawel Pogorzelski) - ARRI Alexa Mini, Zeiss Master Anamorphic, 2.00:1; restrained, "predatory" slow push-ins rather than shaky handheld; low-key, practical-driven lighting using shadow as an active storytelling element. *Source: Panavision, Color Culture.*

**The Texas Chain Saw Massacre (1974)** (DP Daniel Pearl) - Éclair NPR/Bolex H16, Eastman Ektachrome Commercial ISO 25, blown up to 35mm; an innovative underslung platform dolly for the iconic approach shot; minimal lighting kit out of real necessity (no HMIs available), not stylistic choice. *Source: American Cinematographer, "Twice the Horror."*

**City of God** (DP César Charlone) - mixed 16mm/35mm, Kodak EXR/Vision stocks; a deliberate color arc from warm/saturated (childhood) to cool/desaturated (as the film darkens); handheld, documentary-derived approach shaped by working with non-actor child performers.

**The Revenant** (dir. Alejandro González Iñárritu, DP Emmanuel Lubezki) - ARRI Alexa XT/M/65, Zeiss Master Primes/ARRI Prime 65; natural light only plus period-correct firelight, shot in a strict ~9:30am-4:00pm winter daylight window; extended long takes, some reportedly running toward 90 minutes of continuous shooting. *Source: ARRI, American Cinematographer.*

**Taxi Driver** (dir. Martin Scorsese, DP Michael Chapman) - Arriflex 35 BL, Zeiss Super Speeds, 35mm Eastman Color Negative 100T, 1.85:1; wide-angle lenses deliberately used to exaggerate street perspective (expansive yet claustrophobic); Chapman explicitly avoided a clean "11 o'clock news look," balancing actors against ambient neon with minimal rigging. *Source: Cinephilia & Beyond.*

**Predator** (DP Donald McAlpine) - Panaflex Gold, Panavision Z-series/Zeiss Super Speed sphericals (not anamorphic); shot open-matte 1.37:1, released at 1.85:1; per-scene stock choice by light level (faster stock for dense jungle); as little as 4-8 footcandles of key light in the climax. *Source: American Cinematographer, "Predator Dispenses Invisible Terror."*

**Paranormal Activity** (dir./DP Oren Peli) - Sony HDR-FX1 consumer camcorder, HDV 1080i; locked-off tripod, static long takes chosen explicitly over Blair Witch-style shake as the more unsettling option; aimed for "security camera" plausibility over performed camerawork. *Source: No Film School, Den of Geek.*

**Uncut Gems** (dirs. Safdie Brothers, DP Darius Khondji) - ARRI ST/LT, Panavision C-Series anamorphic long primes (75-360mm), Kodak Vision3 500T pushed one stop; long lenses on a fluid-head tripod (too heavy for true handheld) giving a voyeuristic, surveillance-like distance despite the chaotic feel. *Source: British Cinematographer, Kodak.*

**Amélie** (dir. Jean-Pierre Jeunet, DP Bruno Delbonnel) - Arriflex 435 ES/535, Zeiss Ultra Primes, 2.35:1; a deliberate saturated triad of reds/greens/ambers; Delbonnel's noted approach of lighting on-set specifically anticipating a heavy post-production color grade. *Source: Wolfcrow.*

---

## Part 3: Auteur Case Studies

### Martin Scorsese

- **Extended tracking/Steadicam**: the Goodfellas Copacabana shot - a ~3-minute unbroken Steadicam take through a crowded kitchen/hallway, shot practically (no CGI), operated by Larry McConkey. *Source: No Film School, Filmmaker Magazine.*
- **Freeze-frame + voiceover**: a trademark since Mean Streets (1973) - stopping on a charged moment paired with narration, functioning like "photographs with captions." Goodfellas' voiceover+flashback+freeze-frame template became widely imitated.
- **Needle-drop philosophy**: pre-existing music treated as part of a scene's "physical and mental architecture," chosen to mirror a character's internal state, not just set a period.
- **Editing rhythm** (with longtime editor Thelma Schoonmaker): a deliberate "certain roughness" kept in cuts for grittiness rather than invisible slick editing; on The Irishman, an explicit pacing directive toward "not a lot of flashy things" and brief, anti-glamorized violence.
- **Color/lighting**: Goodfellas' warm, high-key early scenes progressively darken as the narrative moves toward moral collapse (DP Michael Ballhaus); Casino (DP Robert Richardson) - a "Technicolor noir" of saturated neon and swish pans.

### Quentin Tarantino

- **The trunk shot**: a low-angle POV from inside a car trunk, used across Reservoir Dogs/Pulp Fiction/Jackie Brown/Kill Bill - intimacy/confinement, withheld information, and an encoded power imbalance.
- **Format evolution with DP Robert Richardson**: Kill Bill (Super 35 anamorphic), Inglourious Basterds (35mm Panaflex, Kodak Vision2/3, 2.40:1 anamorphic), The Hateful Eight (revived Ultra Panavision 70 - 65mm film, archaic anamorphic lenses last used in 1966, 2.76:1, the widest aspect ratio in wide use), Once Upon a Time in Hollywood (deliberately back to anamorphic 35mm, for zoom-lens compatibility 70mm doesn't offer).
- **Long dialogue takes**: an explicit "rubber band" theory of tension - stretching a scene rather than compacting it.
- **Robert Richardson's lighting signature**: hard top/backlight creating a glow against dark backgrounds ("halo" lighting); high contrast, bold saturated color; prioritizes frame beauty over strictly motivated light sources.
- **Documented framing tension**: Tarantino prefers dead-center framing; Richardson's instinct (especially in anamorphic) runs toward off-center - a recurring, documented creative negotiation between them.

*Items explicitly flagged as unverified in the source research and excluded from the engine: a "rubber band" quote traced only to a secondary aggregator, and a claimed "telephoto for dialogue / wide for violence" rule for Scorsese not confirmed as a direct quote.*

---

## Part 4: Commercial & Short-Form Craft

This is the research most directly applicable to the product - unlike features, 15-60 second ads/UGC are the actual format being generated.

**Studied campaigns** (director/technique, all sourced from trade press - Ad Age, Adweek, Campaign, LBBonline, Cannes Lions case studies, and the films' own behind-the-scenes coverage): Apple "1984" (dir. Ridley Scott - the ad credited with opening commercials to auteur film directors); Old Spice "The Man Your Man Could Smell Like" (dir. Tom Kuntz - an apparent single continuous take, actually achieved via precisely-timed practical rigging across multiple full takes, not literal one-shot); Nike "Dream Crazy" (co-directed by Lance Acord, Emmanuel Lubezki, Christian Weber - voiceover-led testimonial structure, "composed and dignified rather than inflammatory"); Apple "Welcome Home" (dir. Spike Jonze, DP Hoyte van Hoytema - a hydraulic practical set built to transform in sync with choreography, "very little CGI"); Dove "Real Beauty Sketches" (dir. John X. Carey - a documentary/undisclosed-premise structure using a forensic sketch artist); Budweiser "Puppy Love"/"Lost Dog" (dir. Jake Scott - a documented three-act tension-and-release emotional arc); Sandy Hook Promise "Evan" (dir. Henry-Alex Rubin - misdirection via sustained background visibility competing with foreground narrative dominance, not jump-cut trickery).

**Real, actionable craft data**:
- **Average shot length**: commercials run roughly 2-5 seconds per shot; a 30-second national spot commonly contains 25-30 shots (vs. documentary's ~15s/shot average).
- **Spot-length formulas** (industry convention, not a single official standard): 15s = hook + single simple message, almost no narrative room; 30s = hook (0-5s) → problem/solution (5-20s) → CTA (20-30s); 60s = hook (~3s) → setup (~10s) → story (~15s) → product intro (~20s) → result (~7s) → CTA (~5s).
- **The 3-second rule**: 70%+ of TikTok users decide whether to keep watching within ~3 seconds; effective hooks are "pattern interrupts" (a problem statement, a surprising visual, a FOMO/transformation promise) landed in the first 1-3 seconds, designed sound-on.
- **UGC vs. produced content**: trade-reported figures (agency-sourced, not independently audited - treat as directional) put UGC-style ads at up to 4x higher CTR, with 85% of consumers finding UGC more trustworthy than brand-produced content.
- **What reads as authentic vs. produced**: content that blends into the native feed rather than announcing itself as an ad; lo-fi/phone-shot visual quality; real locations over studio sets; creator-led delivery in the platform's native vernacular rather than scripted brand voice.
- **Structural difference from film**: commercial directors typically don't control post (agency/editor-driven, unlike a film director's involvement through final cut); externally fixed runtimes (15/30/60s) rather than a feature's flexible length.

This directly informed the `commercialUgc` genre bucket's design: clean, high-key, natural color science, minimal grain - deliberately matching what already works in `productAdStoryboard.ts`'s existing default, rather than inventing a competing look.

---

## Part 5: Engine Design Notes

### The `GENRE_STYLE_LIBRARY` mapping

Each of the 10 genre buckets abstracts several of the real, researched films above into **generic, reusable industry vocabulary** - never a claim to replicate one film's actual footage. For example, `sciFiNoir`'s "cool-warm color-separated palette, volumetric haze" generalizes from Blade Runner 2049's amber/blue-teal filter work and The Matrix's green/cool-tungsten split, not a literal recreation of either.

| Bucket | Primarily informed by |
| --- | --- |
| `sciFiNoir` | Blade Runner 2049, The Matrix |
| `crimeThriller` | Se7en, No Country for Old Men, Heat, Taxi Driver |
| `kineticAction` | Mad Max: Fury Road, John Wick, Predator |
| `epicDrama` | The Godfather, There Will Be Blood, LOTR, 12 Angry Men |
| `intimateEmotional` | Whiplash, Moonlight, In the Mood for Love |
| `warRealism` | Saving Private Ryan, Children of Men, The Revenant |
| `horrorTension` | Hereditary, The Texas Chain Saw Massacre |
| `foundFootage` | The Blair Witch Project, Paranormal Activity |
| `vintageStylized` | Amélie, City of God (early-scene palette) |
| `commercialUgc` | Existing `productAdStoryboard.ts` default + the ad-craft research above |

### Real bugs found and fixed during testing

Building this with real test prompts (not just reading the code) surfaced genuine regex bugs worth recording, since they're the kind of mistake easy to reintroduce when extending this file:

1. **Single-sided word boundaries matched inside unrelated words.** `king\b` matched the "king" inside "smo**king**"; `cult\b` matched inside "diffi**cult**" (misclassifying an innocuous prompt as horror); `ad\b` matched any word ending in "-ad" (bad, sad, head, road...); `airy\b`-less `airy` matched inside "h**airy**"; `dim` matched inside "**dim**ension". Fixed by requiring `\b` on **both** sides of every whole-word keyword (`\bking\b`, not `king\b`).
2. **Keyword lists were initially too narrow.** A first pass left "gladiators fighting" unmatched by `kineticAction` (no "fight" variant), "cybernetic...neon alleyway" unmatched by `sciFiNoir` (no "cybernetic" or bare "neon"), and "gloomy, ominous mansion at midnight" unmatched by `horrorTension` (no "gloomy"/"ominous"/"mansion") - all falling through to the generic `commercialUgc` default instead of a genre-appropriate style. Fixed by substantially widening each bucket's keyword coverage.
3. **Scale detection missed broad emotional vocabulary.** "Two former lovers reunite... a quiet, tender embrace" scored as `wide` (establishing) scale despite being clearly intimate, because the original word list only covered narrow micro-expression terms (whisper, stare, tears). Widened to include general romantic/emotional vocabulary (embrace, tender, reunite, longing, heartbreak, forgive, goodbye, kiss).

All three were caught by writing and running real test prompts through the engine (`node --experimental-strip-types`) before wiring it into any UI - worth doing the same before extending this file further.

---

## Part 6: How to Extend This

- **Add a new genre**: add an entry to `GenreKey` and `GENRE_STYLE_LIBRARY`, with a real, sourced technique backing each field (not an invented adjective), and add it to `GENRE_ORDER` at the priority position that makes sense relative to existing buckets (more specific signals earlier, broad catch-alls later).
- **Add a new keyword to an existing genre**: always wrap whole-word matches in `\b...\b` on both sides - see Part 5's bug list above for why a single-sided boundary is a real, silent correctness bug.
- **Verify any change** by running real test prompts through `expandCinematicPrompt()` via `node --experimental-strip-types -e '...'` before trusting it - this is fast, free, and is what caught every bug listed above.
