# How to create a short UGC historical video for Instagram

The winning pipeline is:

1. Lock Harper with a character sheet (image model).
2. Build period location plates separately (image model) — year, materials, crowd clothes, weather, time of day. This is where authenticity lives.
3. Optional: "Harper in that place" stills (image model) as first-frame / scene refs.
4. Seedance = animate with `@Image` refs: character identity + location look + camera motion + quoted lines.
5. Edit short clips together (CapCut / your stitcher).

Creators do not usually ask ChatGPT to "put her in Rome" as one magic step and stop. ChatGPT/Claude writes the script + historically specific prompt wording; the image model makes the plates; Seedance makes the motion.

**Seedance multi-scene**: yes, it can do numbered multi-shots in one generation (setup → fight → walk away). For viral quality, most people still generate separate 10–15s clips (enter / watch fight / closing walk) and stitch — fewer mushy cuts, easier retries. Below: both options — separate pastes (recommended) plus one optional all-in-one.

---

## Worked example: Harper at the Colosseum

| | |
| --- | --- |
| **Host** | Harper |
| **Place** | Flavian Amphitheatre (Colosseum), Rome, summer midday, ~80–90 AD |
| **Weather** | Hot, hard sun, dusty haze, thin high cloud |
| **Arc** | Enter → watch two gladiators → walk away with closing thoughts |
| **Accent** | Spoken American (California / LA vlogger), casual |
| **Clothes** | Modern forever: olive linen tank, light jeans, white sneakers, thin gold chain, small rose tattoo on right wrist — never a toga |

### A) Character sheet — paste into image model

> Photoreal character reference sheet of ONE consistent woman named Harper, Gen Z history vlogger.
> Same identity every frame: mid-20s, fair-warm skin with light freckles, hazel-green eyes, honey-brown hair in a low ponytail with face-framing pieces, natural makeup, thin gold chain, small black rose outline tattoo on right wrist.
> Wardrobe locked forever: olive linen tank top, light-wash blue jeans, white sneakers — never Roman costume, never a toga.
> Grid of 8 images of the SAME person: front face, 3/4 face, left profile, right profile, MCU talking to camera, laughing, full body standing, walking toward camera.
> Lighting variety: hard noon sun, open shade, warm golden hour, cool overcast.
> Hyper-realistic skin pores, no plastic skin, no beauty filter, consistent face geometry across all frames, natural hands, iPhone selfie realism, sharp eyes, 9:16 friendly framing.

Save best as: `@Image1` hero face · `@Image2` 3/4 · `@Image3` full body.

### B) Location plates — paste into image model (authenticity lives here)

**B1 — Exterior approach / entrance**

> Photoreal historical reconstruction, Rome, Flavian Amphitheatre (Colosseum) exterior, summer midday ~85 AD, NOT the modern ruined Colosseum.
> Intact travertine facade with full arcades, awnings/velarium masts visible on top rim, dusty pale stone, no metal scaffolding, no tourists in modern clothes, no cars, no streetlights, no signage in English.
> Crowds in period dress only: tunics, togas, sandals, veiled women, vendors with amphorae and baskets, legionary-looking guards at arches.
> Hard Mediterranean sun, sharp shadows, dusty haze, heat shimmer above paving stones.
> Wide establishing shot, documentary realism, architectural accuracy, no fantasy CGI gloss, no gladiator Hollywood chrome.

**B2 — Interior arena view from seats**

> Photoreal view from mid-tier seating inside the Flavian Amphitheatre, Rome ~85 AD, looking down into the sandy arena floor.
> Wooden arena surface with sand, dark gates (carceres) in the podium wall, officials and attendants in period dress along the edge.
> Crowd filling stone seats: packed Roman spectators in tunics and togas, sun umbrellas/fans, dust in sunbeams.
> Hard noon sun from above, high contrast, dusty air, no modern cameras, no plastic seats, no safety rails, no LED boards.
> Accurate ancient stadium architecture, intact upper tiers, velarium shadow patches on sand.

**B3 — Two gladiators mid-fight (location action still)**

> Photoreal ancient Roman gladiatorial bout on sandy arena floor inside Colosseum ~85 AD.
> Two male gladiators: one murmillo with crested helmet and large rectangular shield (scutum) and gladius; one retiarius with net, trident, arm guard, no full helmet — historically plausible kit, not fantasy armor.
> Mid-action: net swinging, dust kicking up, tense crowd blur in background seats.
> Hard midday sun, sweat and sand grit, documentary realism, no slow-motion chrome, no dragons, no Hollywood leather fetish costumes.

Use as: `@Image4` exterior · `@Image5` seats/arena · `@Image6` fight reference.

### C) Harper in location (optional but strong first frames)

**C1 — Entering**

> Photoreal. Use the exact same woman Harper from the character sheet: honey-brown low ponytail, rose tattoo on right wrist, olive linen tank, light jeans, white sneakers, gold chain — modern clothes in ancient Rome.
> She walks through a crowded Colosseum entrance arch ~85 AD, holding a phone-style camera toward herself (selfie), looking slightly overwhelmed.
> Background: intact travertine arches, period crowd only, hard noon sun, dust motes.
> Hyper-realistic, shallow depth, natural skin, consistent face to reference sheet, no toga on Harper, no anachronisms in background.

**C2 — In the seats watching**

> Photoreal. Same Harper identity and modern outfit as character sheet, seated in mid-tier stone seats of Colosseum ~85 AD.
> She turns toward selfie camera; behind/below her the sandy arena and distant gladiators mid-bout, packed period crowd.
> Hard sun, dusty haze, sweat sheen, documentary realism, face locked to sheet, never period dress on Harper.

Use as: `@Image7` enter still · `@Image8` seats still.

### D) Full script (what she says + accent direction)

**Accent / voice note** (put in Seedance + any voice tool): American California vlogger accent, natural, slightly breathy, conversational, not British, not theatrical.

**Spoken script**

Entering:
> "Okay—Harper here. I just walked into the Colosseum in Rome… like, the real one, packed, screaming, and it is hot."

Finding a spot:
> "Everyone's in tunics and togas and I'm in jeans. Super subtle. Two guys are about to fight for real down there."

During the fight:
> "That is a murmillo versus a retiarius—shield and sword against net and trident. The crowd is losing it. This is not a movie set."

Closing walk-away:
> "I'm gonna head out before someone asks why I'm filming. Gladiator games were entertainment… and also state power with blood on the sand. Wild. Okay—Harper out. Next stop whenever history dumps me."

### E) Seedance — recommended = 3 separate videos (then stitch)

Attach refs each time. Duration ~12–15s, 9:16.

**Seedance Clip 1 — Entering (moving camera)**

> `@Image1`'s character as the subject (Harper). Full-body likeness also references `@Image3`. Scene and architecture reference `@Image4`. First frame energy references `@Image7`.
> Harper in modern olive tank, jeans, sneakers, rose tattoo on right wrist — never a toga — walks forward through a crowded Colosseum entrance, Rome ~85 AD, intact travertine arches, period-only crowd in tunics and togas, hard midday sun, dusty heat haze.
> She holds the camera herself: handheld selfie, arm slightly extended, camera wobbles as she walks, occasional whip of the frame when she turns, hyper-realistic, cinematic atmosphere, 9:16.
> She speaks in an American California vlogger accent: "Okay—Harper here. I just walked into the Colosseum in Rome… like, the real one, packed, screaming, and it is hot."
> Ambient: dense crowd roar, sandals on stone, vendors shouting Latin street noise, no modern music.
> Lock face to `@Image1`, natural hands, no cars, no tourists in shorts, no metal scaffolding, no English signs.

**Seedance Clip 2 — Watching the fight**

> `@Image1`'s character as the subject. Seating environment references `@Image5`. Gladiator action references `@Image6`. Framing references `@Image8`.
> Harper sits/stands in mid-tier seats, modern outfit unchanged, filming selfie while glancing down at the arena.
> Below: sandy floor, murmillo with scutum vs retiarius with net and trident, dust bursts, packed period crowd reacting.
> Camera: handheld selfie MCU on Harper, she pans the phone down toward the arena for 2 seconds then back to her face — clear user-operated camera move — slight shake, hyper-realistic, cinematic atmosphere, 9:16, hard noon sun.
> She says (California accent): "That is a murmillo versus a retiarius—shield and sword against net and trident. The crowd is losing it. This is not a movie set."
> Ambient: roar swelling on hits, sand scrape, no pop music.
> Identity locked to `@Image1`; fight kit historically plausible; no fantasy armor; no modern ads in stadium.

**Seedance Clip 3 — Walk away + closing thoughts**

> `@Image1`'s character as the subject. Exterior/exit arches reference `@Image4`.
> Harper walks away from the seating toward a shaded exit corridor of the Colosseum ~85 AD, still in modern clothes, sweaty, sun behind her, dusty air.
> Handheld selfie continuous shot as she walks, camera bouncing with her steps, hyper-realistic, cinematic atmosphere, 9:16.
> She says (California accent), closing thoughts: "I'm gonna head out before someone asks why I'm filming. Gladiator games were entertainment… and also state power with blood on the sand. Wild. Okay—Harper out."
> Ambient: roar fading behind her, footsteps, cooler corridor echo. No music.
> Lock face/outfit to `@Image1`, period extras only, no anachronisms.

**Edit order**: Clip 1 → Clip 2 → Clip 3. Captions on lines. Hook text: *"I snuck into a real gladiator game."*

### F) Optional — one Seedance multi-scene (if you want a single generate)

> Three shots, 15 seconds total, 9:16. Character always `@Image1` (Harper), modern olive tank and jeans, never period dress. Locations reference `@Image4` and `@Image5`. Fight reference `@Image6`.
>
> Shot 1 (enter): Handheld selfie walk through Colosseum entrance ~85 AD, hard sun, period crowd. She says: "Okay—Harper here. I just walked into the Colosseum in Rome… packed, screaming, and it is hot."
>
> Shot 2 (watch): Cut to seats; she pans camera down to murmillo vs retiarius on sand, dust, crowd roar; back to face. She says: "Murmillo versus retiarius. This is not a movie set."
>
> Shot 3 (exit): Walk toward exit arch, softer light. She says: "Entertainment and state power with blood on the sand. Harper out."
>
> Style: handheld selfie, hyper-realistic, cinematic atmosphere, American California accent, ambient stadium only, no modern music.
> Constraints: face locked to `@Image1`, historically plausible gear, no cars, no tourists, no scaffolding, natural hands.

Use this for speed; use separate clips (E) when you care about keepers.

### G) Cheat sheet — Rome / Prague / anywhere

| Goal | What to generate | What to write in the prompt |
| --- | --- | --- |
| Authentic place | Location plates without Harper first | Exact year, city name, intact vs ruined, materials (travertine, cobbles, plaster), light, weather, period clothes only on crowds, ban modern objects |
| Authentic people | Crowd extras in location prompt | Tunics/togas/sandals (Rome); for Prague e.g. 1583 Habsburg court → doublets, cloaks, hats — name the century |
| Character realism | Sheet first, then `@Image1`'s character | Almost no face adjectives in Seedance |
| Her in place | Optional composite stills | Same outfit rules + "never local costume" |
| Camera moving | Seedance action language | "she pans the phone down", "selfie arm wobble while walking" |
| Weather | In every location + video prompt | e.g. "hard noon sun, dusty haze, heat shimmer" |

Prague example line to swap later:

> Prague Castle courtyards, summer 1583, Rudolf II era, Renaissance facades, courtiers in doublets, no neon, no cars, late afternoon side light.

### H) Copy-paste order (do this)

1. Run A → save Harper refs
2. Run B1–B3 → save place/fight refs
3. Run C1–C2 (optional)
4. Run Seedance Clip 1, 2, 3
5. Stitch + captions

That's the full kit: character, authentic Colosseum, people, weather, accent, script, image prompts, Seedance camera moves, and when to split vs multi-scene.
