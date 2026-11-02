# Share Market 101: production handoff

As at 2 November 2026. This file is everything another person or agent needs to finish or rebuild the animated kids course *Share Market 101*: where things live, what the rules are, which accounts and credits it uses, the exact voice prompts and settings, and how to run the pipeline.

## 1. What it is, and where it's up to

**What it is:** Sid's 81-page *Share Market 101 v21* script, turned into an animated stick-figure **story** course for kids aged about 10–15.
- Alice, 11, learns investing with her family (Mum, Dad, Grandpa, little brother Max) and her school friends Jack and Zara.
- Garry, a cute polar bear in a different winter outfit each time, explains the hard ideas.
- Claude is shown as Alice's AI helper on a realistic Claude screen.

**Size:** 29 chapters, auto-split into **98 videos** of about 5–12 minutes each. That's about 108,752 words of narration, roughly 11–12 hours of video.
- Every video opens with "In this video…" and three topics.
- Every video ends on a cliffhanger, then the Astryks logo end card.

**Status:**
- **Script:** written, simplified for young kids, with Garry for every hard concept.
- **Fact-check, first pass:** done. Four independent checkers covered every chapter and made about 150 fixes. Reports: `docs/share-market-101/verify_*.md`.
- **Fact-check, second pass (in progress, 2 Nov):** a second audit is running on the content added after the first pass: Ch13's wiped-out companies, Ch20's money, Lehman, SVB and crypto, Ch21's innovations, pharma, AI and railroads, and Ch22's trades. Reports land at `tools/sm_chapters/verify2_*.md`.
- **Production:** narration and rendering are running through all chapters. Finished videos are copied to `~/Desktop/Share Market/NN.P - Title (Part P).mp4`, with an `.srt` beside each.

## 2. Where everything is

**Code and assets** live in `/Users/sidmehta/Documents/Codex/2026-09-17/Sloane/deliverables/kids-course`. ⚠️ This folder is **git-ignored**, so it isn't in the repo. Back it up, or force-add the code, before handing over another machine.

| What | Where |
|---|---|
| Chapter source (story beats, Python) | `tools/sm_src.py` (helpers, Ch1–2, auto split, intros, cameos) + `tools/sm_chapters/chNN.py` (Ch3–29) |
| Writer's guide (all rules, scene types, characters) | `tools/sm_chapters/GUIDE.md` |
| Fact-check brief | `tools/sm_chapters/VERIFY.md` |
| "In this video" intros | `tools/sm_intros.py` (one entry per video id) |
| Generated beats (do not edit) | `beats_sm/chNNNP.json`, e.g. `ch1103` = Chapter 11 Part 3 |
| Narration engine | `tools/narrate4.py` (prompts, QA, retries) + `tools/narrate.py` (pronunciations, whisper, token) |
| Timeline / render / music / subtitles | `tools/timeline3.py`, `tools/finish_sm.sh`, `tools/sm_music.py`, `tools/srt3.py` |
| Pipeline | `tools/sm_pipeline.sh` (narrate and render streams) |
| Checks | `tools/sm_lint.py` (cue words, beat length, missing files) |
| Remotion app | `src/` (scenes: `src/story/Charts.tsx`, `Scenes.tsx`, `Screens.tsx`, `Stick.tsx` (cast, Garry, cameos), `Props.tsx`, `Story.tsx`) |
| Clips, photos, map | `public/sm_*.mp4`, `public/sm_photo_*.jpg`, `public/sm_worldmap.jpg` (NASA, public domain) |
| Music | `music/sm/breezy_bed.wav`, `music/sm/sneaky_bed.wav` (Lyria) |
| Voice references | `ref_algieba.wav` (narrator), `ref_zephyr.wav` (Alice) |
| Narration takes | `audio/sm/chNNNP/pKKK.wav` + `.json` (cached; reused by matching words) |
| Renders | `renders_sm/chNNNP.mp4` (+ `.hash`, so unchanged videos are skipped) |
| Fact-checked script doc | `docs/share-market-101/script.md` (in git), Desktop `Share Market/*.docx` |

## 3. Accounts, credits and money rules

**Google Cloud:** Sid's personal free-trial project `lucy-labs-508023`, used through the `gcloud` CLI (logged in as Sid's personal Gmail). Tokens come from `gcloud auth print-access-token` (see `narrate.token()`).
- **Free credits only. Never paid spend.** If credits run out, or a step would need billing or a paid plan, **stop and ask Sid**. Don't upgrade, add a card, or switch to a paid service.

APIs used:

| Use | API | Settings |
|---|---|---|
| Narration | Vertex AI `gemini-2.5-pro-tts` | `https://aiplatform.googleapis.com/v1/projects/lucy-labs-508023/locations/global/publishers/google/models/gemini-2.5-pro-tts:generateContent`; `responseModalities: ["AUDIO"]`, `temperature 0.7`, `seed`, `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` + `languageCode` |
| Music | Vertex AI `lyria-002` (us-central1, `:predict`) | 30-second instrumental clips |

**Cost:** about $0.03 per minute of audio, about $0.05 a finished minute including re-rolls, so the whole course is roughly $30–60 of free credit. Lyria is a few cents per clip.

**Rate limits:**
- Keep at most 3 narrators running at once; `narrate4.py` enforces this with `/private/tmp/claude-501/narrate_slot*`.
- 429 and timeout errors are retried automatically, up to 24 tries with backoff.
- The read timeout is 480 s, because the service is sometimes very slow.

**Claude usage:** the build used parallel Claude agents. When you hit session or weekly limits, wait for the reset and resume the same agent rather than starting over.

## 4. Sid's rules (apply to everything)

**Content and style**
- **Story-driven and fun, but detailed.** Don't skip details or technical analysis.
- **Simple language** a young child can follow. Explain every new word straight away with a picture-able example, and use Garry for anything still complicated.
- **Hard concepts only** get Alice-asks-Claude (Zephyr voice, realistic Claude screen, correct one-line answer), animated charts, and a Garry segment.
- **Every number** gets first-principles reasoning and the narrator's labelled opinion ("compared with what? growing? why? what to watch?"), never just a bare figure.
- **Legendary quotes** with correct wording. For example, Munger's is "Show me the incentive and I'll show you the **outcome**".
- **Photos** for innovations and history (Wikimedia, public domain or CC, credited). Embed short credited clips (15–45 s).
- **Videos 10–12 minutes max.** Split into parts (automatic), each part ends on a cliffhanger, and each video opens by saying what it covers.

**Facts**
- **Fact-check every number** against primary sources (SEC/ASX filings, Fed, RBA, IMF, ABS, ATO). Use "as at October 2026"; prices are the **30 Oct 2026 close**.
- **Canonical snapshot, end of October 2026:**

  | Item | Value |
  |---|---|
  | Apple | $5.03T (#1) |
  | Nvidia | $4.94T |
  | Microsoft | $3.88T |
  | Alphabet | $3.42T (share price $279.84) |
  | Amazon | $2.60T |
  | S&P 500 | 7,580 |
  | Fed funds | 3.75–4.00% (held 28 Oct) |
  | US 10-year | 4.98% |
  | RBA cash rate | 4.60% |

**Wording Sid set**
- **ChatGPT → Claude** in Alice's prompts. The exception is Sid's own line, kept verbatim: "AI models like Claude and ChatGPT are pretty good nowadays…".
- **Keep Interactive Brokers** as in the script, plus Sid's line: "ask Claude or your favourite AI which broker is cheapest, or watch videos… pick the lowest fees but one you find easy to use".
- **Kids' safety:** general information, not advice. A parent opens any account. Any real money is a small amount a parent agrees to and you're prepared to lose. Returns are "historically", never guaranteed.
- **Stock notes** are credited "Written by our friend, an analyst at a fund".

**Rights and privacy**
- **Clips** were downloaded for a **draft**. Sid clears rights before publishing. Login-walled reels become "Watch this" cards.
- No real actors' likeness. Don't permanently delete anything; move superseded files to `~/Desktop/Share Market/Superseded drafts/`.

## 5. Running the pipeline

```bash
cd /Users/sidmehta/Documents/Codex/2026-09-17/Sloane/deliverables/kids-course
.venv/bin/python tools/sm_src.py          # build beats (all chapters, auto split, intros, cameos)
.venv/bin/python tools/sm_lint.py $(ls beats_sm | sed 's/ch\([0-9]*\).json/\1/')   # must print OK
# one narrator stream and one renderer stream (chapter numbers expand to their parts):
zsh tools/sm_pipeline.sh narrate 1 2 3 4 5 > out/sm_narrate.log 2>&1 &
zsh tools/sm_pipeline.sh render  1 2 3 4 5 > out/sm_render.log 2>&1 &
```

**How a chapter flows through:**
1. **Narrate.** `narrate4.py` voices each passage (60 words or fewer), up to 8 takes, and QA-checks each one. Takes are cached by matching text.
2. **Mark ready.** It writes `audio/sm/chNNNP.ready`.
3. **Render.** `finish_sm.sh` runs, in order:
   - `timeline3.py`, which re-narrates any passages that changed
   - Remotion render (`m<id>` composition)
   - `sm_music.py`: breezy bed, crossfading to the sneaky track whenever Garry is on screen
   - mix: voice + music at 0.16 with sidechain ducking, loudnorm −16 LUFS
   - fade to black, then the Astryks logo (`brand/astryks_end.mp4`)
   - subtitles
   - copy to the Desktop
4. **Skip if unchanged.** Each render writes a hash of its beats and takes, and an unchanged video is skipped next time.

**Run several streams safely**
- **Claims:** each stream claims a video with `audio/sm/chNNNP.claim/` and `renders_sm/chNNNP.claim/` folders. Delete stale ones before restarting.
- **Slots:** at most 2 renders (`render_slot0/1`) and 3 narrators at once.
- **After any script edit:** rebuild, lint and fix intros. Every video id must exist in `INTROS`; the coverage check is in section 9.

## 6. Voice (exact settings and prompts)

**Voices** (chosen by Sid on 30 Oct from 12 samples in `voice_options/share_market/`):

| Role | Voice | Language | Reference |
|---|---|---|---|
| Narrator | **Algieba** (#9, "soothing") | `en-AU` | `ref_algieba.wav` |
| Alice's spoken questions to Claude | **Zephyr** (#7) | `en-GB` | `ref_zephyr.wav` |

Beats with `"voice": "alice"` use Zephyr.

**Narrator style prompt (sent before every passage):**
> You are a warm, passionate storyteller talking to a 10-year-old, with a smile in your voice. Speak only the text, never these directions. Sound like a real person chatting to a kid they know, not a narrator or an advert: relaxed, unhurried, with natural pauses between ideas, so every step is easy to follow. The listeners are young kids, so take your time: speak clearly, never rush, and leave a little breath after each idea so it can sink in. Your voice is calm, soothing and gentle, low and warm, like a kind teacher reading by the fire. Use a natural Australian accent.

**Alice style prompt:**
> You are Alice, a bright, curious 11-year-old girl, reading out loud the question she is typing to her AI helper. Speak only the text, never these directions. Sound genuinely curious and a little excited, natural and unhurried, like a real kid wondering about something. Use a natural British accent.

**Then a mood for each passage** (`mood_for()` in `narrate4.py`, following VOICE-GUIDE.md):

| Mood | When | Wording |
|---|---|---|
| title | chapter title cards | "bright, excited energy" |
| step | step-by-step passages | "clear, punchy… rising lift on each step" |
| wonder | wonder words | "warmth and real wonder… slowing down for the amazing bits" |
| reassure | reassuring passages | "reassuring, friendly" |
| default | everything else | "natural, conversational, warm and curious, relaxed medium pace" |

On top of the mood:
- **Questions** get "Lift your voice at the end of the question '…'".
- **Lists** get "light, bouncy rhythm that builds for the list '…'".
- **One wonder word** per passage gets "stretch '…' with wonder".
- **The chapter's last line** gets "a confident slow-down to land the final sentence '…'".
- **Alice's lines** get "Read it as a real question you're curious about, with a natural lift at the end."
- **Pronunciation notes** (table below) and "Pronounce the word mum the British way…" are appended when those words appear.

The request body is the style prompt + mood + notes, then `"\n\nTranscript:\n" + text`.

**Gaps between passages:** wonder 0.9 s, quick 0.6 s, talk 0.7 s, plus any beat's own `gap`.

**QA for every take** (failed takes are re-rolled, up to 8; the best is kept):
- **Words:** checked word for word with faster-whisper `medium.en` float32 (`names_ok` lets through names the transcriber can't spell).
- **Pauses:** a pause over 1.0 s, or over 1.4 s after a full stop, fails.
- **Pace:** "pause rushed" if over 150 words a minute.
- **Pitch:** must be within ±7% of the reference (±20% for Alice).
- **Voice colour:** spectral distance must be 0.34 or less.
- **Cut-offs:** a take that ends while still loud is flagged as cut off.
- **Final fade:** each passage gets a 40 ms fade at the end in the timeline.

### VOICE-GUIDE.md (Sid's original guide, verbatim)

# Helix Teen Course: Voice, Pace & Cadence Guide

Voice: **Algenib**, model `gemini-2.5-pro-tts` (Cloud Text-to-Speech, en-US). Reference: `intro-algenib-v2.mp3` (20 Oct 2026).

## How to build each style prompt
1. **Base (always):** "You are a warm, passionate storyteller talking to a 10-year-old, with a smile in your voice. Speak only the text, never these directions."
2. **Mood:** the passage's [VOICE: ...] note, rewritten as a full instruction ("Speak with wonder and excitement, ..."). Never paste a bare phrase like "they did it so you can too": the model reads it aloud.
3. **Pace:** one sentence per beat, quoting the passage's own words to say where pace changes (e.g. "slow down for 'look around you for a second', soft pause after it").
4. **Pronunciation:** "Pronounce the word mum the British way, rhyming with thumb." (Add this to any passage that says mum.)

Spoken text = exact script words. Put pace and pause direction only in the prompt, never in the spoken text.

## Pace words for each [VOICE] mood
| [VOICE] mood | Pace | Rhythm / pauses | Prompt words that work |
|---|---|---|---|
| Wonder / amazement | Slow | Soft pauses before the key word; stretch it | "slow down", "stretch 'someone' with wonder", "a soft pause before 'regular people'" |
| Reveal / big idea | Slow → land | Brief hush, then a warm, stretched landing | "slow right down for the reveal, warm and stretched" |
| Lists (things, places) | Quick, bouncy | Crisp, even beats; builds | "light, bouncy rhythm that builds", "like pointing at things one by one" |
| Steps / process (idea → maker → sale) | Quicker, punchy | Rising on each step, little landing at the end | "punchy three-step rhythm, rising energy on each step" |
| Excited / inviting / game | Quick | Punchy opening, playful | "quick and punchy for 'Here's a little game'" |
| Reassuring / practical (cost, requirements) | Brisk, medium | Even, friendly | "reassuring and brisk", "encouraging and warm" |
| Questions to the viewer | Quicker, rising | Lift at the end | "quicker and rising on 'Want to learn how?'" |
| Closing line / call to action | Confident slow-down | Land it; slight pause before | "a confident slow-down to land the final sentence" |
| Story / narrative beats (Jessie) | Medium, conversational | Natural; slow for surprises | "conversational, slow down slightly for the surprise" |

## Assembly
- Generate **whole passages** (about 25 s / 60 words max). Longer takes skip words, so split at a sentence boundary if needed.
- Gaps: 0.8 s after a wonder/reveal passage, 0.5–0.6 s after a list or quick passage, 0.35 s between two halves of one passage.

## QA (every clip)
- Transcribe with faster-whisper **medium.en, compute_type=float32**, `condition_on_previous_text=False` (int8 gives garbage on the box).
- Compare word for word with the script (digits like "40" and "$1,000" are fine). Re-roll any clip with missing, extra or changed words, style text read aloud, or "mom".
- Expect about 1 in 4 to 1 in 3 takes to fail. Run 3 or fewer requests in parallel (above that you hit the 429 rate limit).

## Cost
Gemini 2.5 Pro TTS: about $20 per 1M audio tokens (25 tokens per second of audio), so about $0.03 per minute of audio, or about $0.05 per finished minute including re-rolls. Full course (about 90 min): about $3–5.


### Pronunciation notes (167 entries; add more in `SAY2` in narrate4.py)

| Word | Note sent to the voice model |
|---|---|
| a16z | Say a16z as 'A sixteen Z'. |
| Ackman | Say Ackman as "AK-man". |
| Agilent | Say Agilent as 'AJ-il-ent'. |
| Agnico Eagle | Say Agnico Eagle as 'AG-nih-ko Eagle'. |
| Agoda | Say Agoda as "a-GO-da". |
| Akio Morita | Say Akio Morita as 'AH-kee-oh mo-REE-tah'. |
| Ambani | Say Ambani as "um-BAH-nee". |
| Andreessen | Say Andreessen as 'an-DREE-sen'. |
| Anil | Say Anil as "uh-NEEL". |
| Appaloosa | Say Appaloosa as 'app-uh-LOO-suh'. |
| Aramco | Say Aramco as 'ah-RAM-co'. |
| Archegos | Say Archegos as 'AR-kuh-gohs'. |
| Arista | Say Arista as 'a-RISS-ta'. |
| Arnault | Say Arnault as "ar-NO". |
| ASIC | Say ASIC as "AY-sick". |
| Atlassian | Say Atlassian as "at-LASS-ee-an". |
| AWS | Say AWS as the letters "A W S". |
| Azure | Say Azure as 'AZH-er'. |
| banyan | Say banyan as 'BAN-yun'. |
| Berkshire Hathaway | Say Berkshire Hathaway as 'BERK-sher HATH-uh-way'. |
| Bernanke | Say Bernanke as 'ber-NAN-kee'. |
| Bezos | Say Bezos as "BAY-zohs". |
| Blecharczyk | Say Blecharczyk as 'BLEH-kar-chick'. |
| Bogle | Say Bogle as "BOH-gul". |
| Bovespa | Say Bovespa as "bo-VES-pa". |
| Brattain | Say Brattain as 'BRAT-n'. |
| Bretton Woods | Say Bretton Woods as 'BRET-un woods'. |
| Byetta | Say Byetta as 'bye-ET-a'. |
| CagriSema | Say CagriSema as 'KAG-ree-SEE-ma'. |
| Cayman | Say Cayman as 'KAY-mun'. |
| Chatterbox | Say Chatterbox naturally, like "chatter box". |
| Claude | Pronounce the name Claude exactly like the word "clawed", never "cloud". |
| Coatue | Say Coatue as "co-AH-too". |
| Collip | Say Collip as 'COLL-ip'. |
| CoreWeave | Say CoreWeave as 'CORE-weave'. |
| CPU | Say CPU as the letters "C P U". |
| CQT | Say CQT as the letters "C Q T". |
| CUDA | Say CUDA as "KOO-dah". |
| Dai-Ichi Kangyo | Say Dai-Ichi Kangyo as 'dye-EE-chee KAHN-gyoh'. |
| Dalio | Say Dalio as 'DAH-lee-oh'. |
| Damadian | Say Damadian as 'da-MAY-dee-an'. |
| Darzalex | Say Darzalex as 'DAR-za-lex'. |
| DAX | Say DAX as "dacks". |
| Demucs | Say Demucs as "DEE-mucks": "dee", then "mucks", stressing DEE. |
| Deng Xiaoping | Say Deng Xiaoping as "dung shyow-ping". |
| Deutsche Börse | Say Deutsche Börse as "DOY-cha BUR-za". |
| Dhirubhai | Say Dhirubhai as "DEE-roo-bye". |
| Dieter Schwarz | Say Dieter Schwarz as "DEE-ter shvarts". |
| DMart | Say DMart as "DEE-mart". |
| DNS | Say DNS as the letters "D N S". |
| DoCoMo | Say DoCoMo as 'doh-KOH-moh'. |
| Druckenmiller | Say Druckenmiller as 'DRUCK-en-miller'. |
| Dupixent | Say Dupixent as 'doo-PIX-ent'. |
| Défossez | Say Défossez as "deh-foss-AY". |
| EBITDA | Say EBITDA as 'ee-bit-dah'. |
| Einhorn | Say Einhorn as 'INE-horn'. |
| Elevance | Say Elevance as "EL-uh-vance". |
| Equinix | Say Equinix as 'ECK-win-ix'. |
| exendin | Say exendin as 'ex-EN-din'. |
| FinRL | Say FinRL as "fin R L". |
| FOMO | Say FOMO as "FOH-mo". |
| Garena | Say Garena as "ga-REE-na". |
| Gayetty | Say Gayetty as 'GAY-uh-tee'. |
| Gila | Say Gila as 'HEE-la'. |
| GitHub | Say GitHub as "git hub". |
| Godot | Say Godot as "guh-DOH". |
| GPU | Say GPU as the letters "G P U". |
| HiFi-GAN | Say HiFi-GAN as "high-fye gan". |
| Hoka | Say Hoka as "HO-kuh". |
| Hugging Face | Say Hugging Face naturally, like a hug. |
| Hunyuan | Say HunyuanVideo as "hoon-yuan video". |
| Hwang | Say Hwang as 'HWAHNG'. |
| Hynix | Say Hynix as 'HIGH-nix'. |
| Hyperion | Say Hyperion as 'high-PEER-ee-on'. |
| Hz | Say Hz as "hertz". |
| Iberdrola | Say Iberdrola as 'ee-ber-DROH-la'. |
| Infosys | Say Infosys as "IN-fo-sis". |
| IPO | Say IPO as the letters "I P O". |
| Jio | Say Jio as "JEE-oh". |
| JioSaavn | Say JioSaavn as "JEE-oh SAH-vun". |
| Kahneman | Say Kahneman as "KAH-nuh-mun". |
| Kaufland | Say Kaufland as "KOWF-land". |
| Kioxia | Say Kioxia as 'kee-OX-ee-uh'. |
| Krafton | Say Krafton as "KRAF-ton". |
| kroner | Say kroner as "KROH-ner". |
| Kronos | Say Kronos as "KROH-noss". |
| Kyndryl | Say Kyndryl as 'KIN-drill'. |
| Laffont | Say Laffont as "la-FON". |
| Livongo | Say Livongo as 'li-VONG-go'. |
| Llama | Say Llama like the animal, "LAH-mah". |
| LoRA | Say LoRA as "LOR-ah", like the name Laura. |
| LSTM | Say LSTMs as the letters "L S T Ms". |
| LVMH | Say LVMH as 'L V M H'. |
| Macquarie | Say Macquarie as 'ma-KWOR-ee'. |
| Magellan | Say Magellan as 'ma-JELL-an'. |
| Meituan | Say Meituan as "may-twahn". |
| MercadoLibre | Say MercadoLibre as "mer-KAH-do LEE-bray". |
| MIDI | Say MIDI as "MID-ee". |
| MIT | Say MIT as the letters "M I T". |
| Mizuho | Say Mizuho as 'mee-ZOO-ho'. |
| MLX | Say MLX as the letters "M L X". |
| Monee | Say Monee as "MO-nee". |
| Morganization | Say Morganization as 'MOR-gan-ize-ay-shun'. |
| Morgenthau | Say Morgenthau as 'MOR-gen-thaw'. |
| Mounjaro | Say Mounjaro as 'moun-JAR-oh'. |
| Mukesh | Say Mukesh as "moo-KAYSH". |
| mum | Say "mum" the Australian way, rhyming with "thumb". |
| Munger | Say Munger as "MUNG-er". |
| MUSDB | Say MUSDB18 as "mus D B eighteen". |
| Naukri | Say Naukri as 'NOWK-ree'. |
| Nestle | Say Nestle as "NESS-lay". |
| Nikkei | Say Nikkei as "NICK-ay". |
| non-GAAP | Say non-GAAP as "non-gap". |
| Nortel | Say Nortel as 'NOR-tel'. |
| Nubank | Say Nubank as "NOO-bank". |
| O'Shaughnessy | Say O'Shaughnessy as 'oh-SHAW-nuh-see'. |
| Ollama | Say Ollama as "oh-LAH-mah". |
| open source | Say "open source" smoothly as one natural phrase, stressing "OPEN", with no gap between the two words. |
| Pajitnov | Say Pajitnov as 'pa-ZHEET-nof'. |
| PEG | Say PEG as 'peg'. |
| Pershing | Say Pershing as 'PUR-shing'. |
| Philippe | Say Philippe as "fee-LEEP". |
| Plaza Accord | Say Plaza Accord as 'PLAH-zah a-CORD'. |
| Postgres | Say Postgres as "POST-gress". |
| Promontory | Say Promontory as 'PROM-on-tory'. |
| PyTorch | Say PyTorch as "pie-torch". |
| Qlib | Say Qlib as "Q lib". |
| Qwen | Say Qwen as "chwen". |
| Rampell | Say Rampell as 'ram-PELL'. |
| Renaissance | Say Renaissance the American way, "REN-uh-sahns", stressing REN. |
| Rinehart | Say Rinehart as "RINE-hart". |
| S&P | Say S&P as "S and P". |
| S3Gen | Say S3Gen as "S three gen". |
| SaaSpocalypse | Say SaaSpocalypse as 'SASS-pocalypse'. |
| Sakura | Say Sakura as 'sah-KOO-rah'. |
| Sarandos | Say Sarandos as "suh-RAN-dose". |
| Satoshi Nakamoto | Say Satoshi Nakamoto as 'sah-TOH-shee nah-kah-MOH-toh'. |
| Saverin | Say Saverin as "SAV-er-in". |
| Saxenda | Say Saxenda as 'sax-EN-da'. |
| semaglutide | Say semaglutide as 'sem-a-GLOO-tide'. |
| Senra | Say Senra as 'SEN-rah'. |
| Shenzhen | Say Shenzhen as "shen-jen". |
| Shopee | Say Shopee as "SHOP-ee". |
| Sumitomo | Say Sumitomo as 'soo-mee-TOH-moh'. |
| T3 | Say T3 as "T three". |
| Teladoc | Say Teladoc as 'TELL-a-doc'. |
| Teledyne | Say Teledyne as 'TELL-uh-dine'. |
| Ternus | Say Ternus as 'TUR-nus'. |
| TerraUSD | Say TerraUSD as 'TERRA U S D'. |
| tirzepatide | Say tirzepatide as 'tir-ZEP-a-tide'. |
| TTS | Say TTS as the letters "T T S". |
| Tversky | Say Tversky as "TVER-skee". |
| U-Net | Say U-Net as "you net". |
| Uniqlo | Say Uniqlo as "YOO-nee-klo". |
| Valeant | Say Valeant as 'VAL-ee-unt'. |
| Vanderbilt | Say Vanderbilt as 'VAN-der-bilt'. |
| Vercel | Say Vercel as "ver-SELL". |
| Vernova | Say Vernova as 'ver-NO-va'. |
| Volcker | Say Volcker as 'VOHL-ker'. |
| Wan | Say Wan as "wahn". |
| Waymo | Say Waymo as 'WAY-mo'. |
| Webull | Say Webull as 'WEE-bull'. |
| Wegovy | Say Wegovy as 'weh-GO-vee'. |
| yuan | Say yuan as 'yoo-AN'. |
| Zhang Yiming | Say Zhang Yiming as "jahng ee-MING". |
| ZIRP | Say ZIRP as 'zerp'. |
| Zweig | Say Zweig as 'ZWIG'. |

## 7. Music
**Lyria prompts:**
- **Breezy:** "Light, breezy, cheerful background music for a kids' educational cartoon. Gentle ukulele, soft glockenspiel and light hand claps, warm and playful, simple happy melody, relaxed medium tempo, unobtrusive, no vocals, loopable."
- **Sneaky:** "Playful sneaky tiptoe music for a cute cartoon polar bear. Pizzicato strings, soft bassoon and light woodblock, curious and funny, quiet and subtle, medium-slow tempo, no vocals, loopable."
- **Negative prompt:** "vocals, singing, heavy drums, distortion, loud".

**How the beds are made:** two seeds of each were crossfaded into one bed. `sm_music.py` loops each bed seamlessly and switches to the sneaky one during Garry scenes and cameos, with a 1.2 s crossfade.

## 8. Look and characters
- **Cast:** stick figures with clothes (looks in `Stick.tsx`):

  | Character | Look |
  |---|---|
  | Alice (`sm_alice`) | auburn hair, yellow headband, purple top |
  | Max | spiky orange hair |
  | Mum | dark bob |
  | Dad | beard |
  | Grandpa | white tufts, glasses |
  | Jack | curly hair, red hoodie |
  | Zara | braids, yellow top |

- **Garry:** a cute polar bear with a rotating wardrobe of scarf, beanie or bobble hat or earmuffs, puffer jacket, boots and mittens. Silent cameos (kayak, fishing, sliding, peeking, napping, snowballs) are added automatically about every fifth plain scene.
- **Scene types:**

  | Scene type | Shows |
  |---|---|
  | `line` | animated line chart |
  | `bars` | bar chart |
  | `race` | bar race |
  | `sheet` | spreadsheet filling in |
  | `stock` | interactive stock page |
  | `note` | stock note writing itself |
  | `photo` | archive photo with Ken Burns |
  | `video` | embedded clip |
  | `world` | NASA map flight with pins |
  | `kinetic` | kinetic text |

  A Claude screen is a stage with `screen=kind:claude`. The full spec is in GUIDE.md.
- **Movement:** props and signs idle-bob, and charts count up. Every chart carries an "As at" tag and a source line.

## 9. Open items and known issues
- **Second fact-check pass (in progress).** Read `tools/sm_chapters/verify2_*.md` when done. Figures flagged "approximate" or "from memory" in the writer reports should be looked at before publishing.
- **Rights to clear before publishing:**
  - All embedded clips: 45 files in `public/sm_*.mp4`, credited on screen. Sources include CNBC, BBC, TED, Stanford GSB, Khan Academy, Netflix, WSJ, the BG2 Pod (Coatue), C-SPAN, Principles by Ray Dalio, The David Rubenstein Show, and Carl Sagan's *Cosmos*.
  - Photos with uncertain licences: Bezos 2005 (`sm_photo_bezos2005.jpg`) and Benjamin Graham (`sm_photo_c19_graham.jpg`).
  - Kids' suitability: GTA, Margin Call, The Big Short and Oppenheimer appear only as "with a parent" cards or a making-of clip.
- **Older drafts.** Videos made before the plain-language and music changes are being replaced. Earlier ones are in `Superseded drafts/`.
- **Intro coverage check** after any re-split:
  ```bash
  .venv/bin/python -c "import json,glob,re; ids=sorted(int(re.search(r'ch(\d+)',f).group(1)) for f in glob.glob('beats_sm/ch*.json')); exec(open('tools/sm_intros.py').read()); print([i for i in ids if i not in INTROS])"
  ```
- **Code is not in git.** The `deliverables/` folder is ignored. Ask Sid before force-adding the code.
