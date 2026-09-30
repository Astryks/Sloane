#!/usr/bin/env python3
"""Directed by Lucy - one voice per character across every shot (Modal, GPU). 2026-09-29.

Veo invents a new voice for every clip, so the same character sounds a little
different from shot to shot. This service re-voices a finished shot to a
locked reference voice while keeping Veo's exact timing, so lip-sync stays
exactly as filmed:

  1. pull the shot's audio and split it into speech + everything else
     (Demucs htdemucs - room tone, footsteps, music stay untouched);
  2. convert only the speech to the target voice (Chatterbox voice
     conversion - same words, same timing, new timbre);
  3. level-match, mix back with the room sound, and put it back on the
     untouched video stream.

Modes (POST /start, Bearer MODAL_SHARED_SECRET):
  {"mode": "extract", "video_url": ...}
      -> the separated speech of a shot, uploaded as a WAV. The first shot a
         character speaks in becomes their locked voice this way.
  {"mode": "convert", "video_url": ..., "reference_url": ...}
      -> the shot re-voiced to the reference, as an MP4. Since the
         2026-09-30 realism pass the reference is always a REAL recording
         the customer uploaded (with consent). The old "preset" mode (a
         Chatterbox TTS render of a fixed sentence used as the conversion
         target) is refused: converting natural speech onto a synthetic
         target was the main reason voices sounded robotic.
  {"mode": "speak", "reference_url": ..., "segments": [...], "seconds": 8, "engine": "turbo"|"standard"}
      -> (2026-09-30) the line spoken zero-shot from the customer's own
         recording with Chatterbox-Turbo (paralinguistic tags such as
         [chuckle]/[sigh] from the acting pass) or standard Chatterbox with
         expressive exaggeration/cfg. Used for voice-first engines (Seedance
         2.x reference audio) and as the audio for the optional lip-sync step.
  {"mode": "sync_check", "video_url": ..., "expect": "speaker"|"reaction", "speaker_side": "left"|"right"}
      -> (2026-09-30) a free lip-sync score: faster-whisper word timings vs a
         MediaPipe mouth-open signal -> {ok, score, lag_s, text, flags} (text =
         what was actually said, so the caller can spot gibberish). Up to 3
         faces are tracked; flags: "mouth_on_non_speaker" (a listener's lips
         move with the speech, or anyone's in a reaction shot where the
         speaker is off-screen) and "speaker_mouth_closed".
  {"mode": "mix", "video_url": ..., "bed_video_url": ...}
      -> the (lip-synced) video with its speech over the original room sound.
GET /result?call_id=... -> {status: running|done|failed, url?, result?, error?}

Deploy (never run automatically; Sid runs it by hand):
    python3 -m modal deploy scripts/director_voice.py
Then set MODAL_DIRECTOR_VOICE_URL in Vercel to the printed web URL (unchanged
if it was deployed before). The first build takes ~10 minutes (bakes the
Turbo, VC, Demucs and Whisper weights into the image).
"""
import base64
import hmac
import json
import os
import subprocess
import tempfile
import urllib.request

import modal

app = modal.App("director-voice")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "git")
    .pip_install("torch==2.6.0", "torchaudio==2.6.0", extra_index_url="https://download.pytorch.org/whl/cu124")
    # 2026-09-30: chatterbox-tts 0.1.2 -> 0.1.7 (adds Chatterbox-Turbo with
    # paralinguistic tags; same torch 2.6 pin). faster-whisper + MediaPipe
    # power the free lip-sync check.
    # fastapi<0.142 (2026-09-30): fastapi 0.142.0 (released 2026-09-29) added
    # OpenTelemetry to the [standard] extra, which needs protobuf>=5, while
    # mediapipe 0.10.14 needs protobuf<5. pip then backtracked all the way to a
    # source-only numba that refuses Python 3.11, and the image build failed.
    # numba>=0.60 keeps pip on prebuilt wheels if it ever backtracks again.
    .pip_install(
        "chatterbox-tts==0.1.7", "demucs==4.0.1", "soundfile", "numpy<2", "fastapi[standard]<0.142",
        "faster-whisper==1.2.1", "mediapipe==0.10.14", "opencv-python-headless<4.11", "numba>=0.60",
    )
    # Bake the models into the image so a cold start doesn't re-download them.
    .run_commands(
        "python -c \"from demucs.pretrained import get_model; get_model('htdemucs')\"",
        "python -c \"from chatterbox.vc import ChatterboxVC; ChatterboxVC.from_pretrained(device='cpu')\"",
        "python -c \"from chatterbox.tts_turbo import ChatterboxTurboTTS; ChatterboxTurboTTS.from_pretrained(device='cpu')\"",
        "python -c \"from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8')\"",
    )
)
auth_secret = modal.Secret.from_name("lucy-inference-auth")
fal_key_secret = modal.Secret.from_name("fal-api-key")

SR = 44100


def _run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def _download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "lucy-director-voice"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(path, "wb") as f:
        f.write(resp.read())


def _upload(path, content_type, name, fal_key):
    init = urllib.request.Request(
        "https://rest.fal.ai/storage/upload/initiate",
        data=json.dumps({"file_name": name, "content_type": content_type}).encode(),
        headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(init, timeout=30) as resp:
        d = json.loads(resp.read())
    with open(path, "rb") as f:
        put = urllib.request.Request(d["upload_url"], data=f.read(), headers={"Content-Type": content_type}, method="PUT")
    with urllib.request.urlopen(put, timeout=120):
        pass
    return d["file_url"]


@app.cls(image=image, gpu="L4", secrets=[fal_key_secret], timeout=600, scaledown_window=120)
class Voice:
    @modal.enter()
    def load(self):
        import torch
        from chatterbox.vc import ChatterboxVC
        from demucs.pretrained import get_model

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.demucs = get_model("htdemucs").to(self.device).eval()
        self.vc = ChatterboxVC.from_pretrained(device=self.device)

    def _separate(self, video_path, tmp):
        """-> (speech, rest) float32 arrays [2, n] at 44.1k, plus n."""
        import numpy as np
        import soundfile as sf
        import torch
        from demucs.apply import apply_model

        wav = os.path.join(tmp, "mix.wav")
        _run(["ffmpeg", "-y", "-v", "error", "-i", video_path, "-vn", "-ac", "2", "-ar", str(SR), wav])
        mix, _ = sf.read(wav, dtype="float32", always_2d=True)
        mix = mix.T  # [2, n]
        ref = mix.mean(0)
        x = torch.from_numpy((mix - ref.mean()) / (ref.std() + 1e-8)).to(self.device)
        with torch.no_grad():
            out = apply_model(self.demucs, x[None], device=self.device, split=True, overlap=0.25)[0]
        out = out.cpu().numpy() * (ref.std() + 1e-8) + ref.mean()
        speech = out[self.demucs.sources.index("vocals")]
        rest = mix - speech
        return speech.astype(np.float32), rest.astype(np.float32), mix.shape[1]

    @modal.method()
    def extract(self, video_url):
        import soundfile as sf

        with tempfile.TemporaryDirectory() as tmp:
            v = os.path.join(tmp, "in.mp4")
            _download(video_url, v)
            speech, _, _ = self._separate(v, tmp)
            out = os.path.join(tmp, "voice.wav")
            sf.write(out, speech.mean(0), SR)
            return _upload(out, "audio/wav", "voice.wav", os.environ["FAL_KEY"])

    @modal.method()
    def mix(self, video_url, bed_video_url):
        """Lip-synced shot (new voice only) + the ORIGINAL shot's room sound
        (speech removed), so the dubbed line sits in the scene."""
        import numpy as np
        import soundfile as sf

        with tempfile.TemporaryDirectory() as tmp:
            v = os.path.join(tmp, "lip.mp4")
            bed = os.path.join(tmp, "bed.mp4")
            _download(video_url, v)
            _download(bed_video_url, bed)
            has_bed_audio = "Audio:" in subprocess.run(["ffmpeg", "-hide_banner", "-i", bed], capture_output=True, text=True).stderr
            voice = os.path.join(tmp, "voice.wav")
            _run(["ffmpeg", "-y", "-v", "error", "-i", v, "-vn", "-ac", "2", "-ar", str(SR), voice])
            vv, _ = sf.read(voice, dtype="float32", always_2d=True)
            vv = vv.T
            if has_bed_audio:
                _, rest, _ = self._separate(bed, tmp)
                n = min(vv.shape[1], rest.shape[1])
                mixed = np.clip(vv[:, :n] + rest[:, :n] * 0.9, -1.0, 1.0).T
            else:
                mixed = vv.T
            audio = os.path.join(tmp, "mixed.wav")
            sf.write(audio, mixed, SR)
            out = os.path.join(tmp, "out.mp4")
            _run(["ffmpeg", "-y", "-v", "error", "-i", v, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out])
            return _upload(out, "video/mp4", "shot.mp4", os.environ["FAL_KEY"])

    @modal.method()
    def convert(self, video_url, reference_url):
        import numpy as np
        import soundfile as sf
        import torch
        import torchaudio

        with tempfile.TemporaryDirectory() as tmp:
            v = os.path.join(tmp, "in.mp4")
            ref = os.path.join(tmp, "ref.wav")
            _download(video_url, v)
            _download(reference_url, ref)
            speech, rest, n = self._separate(v, tmp)
            src = os.path.join(tmp, "speech.wav")
            sf.write(src, speech.mean(0), SR)
            with torch.no_grad():
                conv = self.vc.generate(src, target_voice_path=ref)  # [1, m] at self.vc.sr
            conv = torchaudio.functional.resample(conv.cpu().float(), self.vc.sr, SR)[0].numpy()
            conv = np.pad(conv, (0, max(0, n - len(conv))))[:n]
            # 2026-09-30: never hand back the wrong person's voice. If the
            # converted line's pitch is far from the reference speaker's
            # (e.g. a woman's pitch left on Lawrence's line), fail so Lucy
            # retries, then flags the shot.
            ref_audio, _ = sf.read(ref, dtype="float32", always_2d=True)
            ref_f0, out_f0 = _median_f0(ref_audio.mean(1), SR_OF(ref)), _median_f0(conv, SR)
            if ref_f0 and out_f0 and not (0.72 < out_f0 / ref_f0 < 1.38):
                raise RuntimeError(f"voice mismatch: converted {out_f0:.0f}Hz vs speaker {ref_f0:.0f}Hz")
            # Same loudness as Veo's original speech.
            rms_in = float(np.sqrt(np.mean(speech.mean(0) ** 2)) + 1e-8)
            rms_out = float(np.sqrt(np.mean(conv ** 2)) + 1e-8)
            conv *= min(4.0, rms_in / rms_out)
            mixed = np.clip(rest + conv[None, :], -1.0, 1.0).T
            audio = os.path.join(tmp, "mixed.wav")
            sf.write(audio, mixed, SR)
            out = os.path.join(tmp, "out.mp4")
            _run([
                "ffmpeg", "-y", "-v", "error", "-i", v, "-i", audio,
                "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out,
            ])
            return _upload(out, "video/mp4", "shot.mp4", os.environ["FAL_KEY"])


def SR_OF(path):
    import soundfile as sf
    return sf.info(path).samplerate


def _median_f0(audio, sr):
    """Median speaking pitch in Hz (0 if too little voiced speech)."""
    import librosa
    import numpy as np
    y = librosa.resample(np.asarray(audio, dtype=np.float32), orig_sr=sr, target_sr=16000)[: 16000 * 20]
    f0, voiced, _ = librosa.pyin(y, fmin=60, fmax=400, sr=16000, frame_length=1024)
    f0 = f0[voiced & ~np.isnan(f0)]
    return float(np.median(f0)) if len(f0) > 20 else 0.0


def _duration(path):
    import re
    info = subprocess.run(["ffmpeg", "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    return int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else 0.0


# ---- acting controls (2026-09-30 realism pass) ------------------------------
#
# Chatterbox's two acting knobs: exaggeration (emotional intensity) and
# cfg_weight (how tightly it follows the reference's pace; lower = looser,
# livelier timing). Resemble's own guidance for expressive speech is cfg ~0.3
# with exaggeration >= 0.7; the old ranges (0.48-0.72 / 0.36-0.48) kept every
# line close to neutral, which is part of why reads sounded flat. Defaults are
# env-tunable so Sid can A/B them against the Brad distortion he heard at the
# extremes (2026-09-30) without a code change.
EXAG_RANGE = (0.35, 0.95)
CFG_RANGE = (0.25, 0.5)
EXPRESSIVE_EXAGGERATION = float(os.environ.get("DIRECTOR_TTS_EXAGGERATION", "0.7"))
EXPRESSIVE_CFG = float(os.environ.get("DIRECTOR_TTS_CFG", "0.3"))
MAX_ATEMPO = 1.1  # beyond ~1.1x time-stretching audibly smears a voice

# Paralinguistic tags Chatterbox-Turbo speaks as sounds. Only Turbo knows them;
# every other engine gets them stripped (it would read "[laugh]" as words).
TURBO_TAGS = ("laugh", "chuckle", "sigh", "gasp", "cough", "clear throat", "sniff", "groan", "shush")

# intent / stage-direction keywords -> (exaggeration, cfg_weight)
_INTENT_ACTING = (
    (("whisper", "quiet", "soft", "gentle", "tender", "sad", "hushed", "intimate", "resigned", "tired"), (0.4, 0.5)),
    (("excited", "angry", "shout", "boom", "roar", "laugh", "breathless", "furious", "thrilled", "yell", "punchline", "brag"), (0.92, 0.28)),
    (("firm", "authorit", "confident", "stern", "cold", "commanding", "harsh", "threat", "testing", "clipped"), (0.62, 0.42)),
    (("warm", "friendly", "curious", "smile", "playful", "bubbly", "reassur", "amused", "teasing"), (0.78, 0.32)),
    (("question", "sharp question", "asks"), (0.72, 0.32)),
    (("thinking", "hesitant", "unsure", "trailing", "nervous"), (0.6, 0.3)),
)


def _acting(delivery):
    """A line's intent or stage direction -> (exaggeration, cfg_weight), or (None, None)."""
    d = (delivery or "").lower()
    for words, values in _INTENT_ACTING:
        if any(w in d for w in words):
            return values
    return None, None


def _clamp(x, lo, hi, default):
    try:
        return max(lo, min(hi, float(x)))
    except (TypeError, ValueError):
        return default


def _segment_acting(seg):
    """Explicit values win; else the segment's intent; else expressive defaults."""
    ie, ic = _acting(seg.get("intent"))
    exag = _clamp(seg.get("exaggeration"), *EXAG_RANGE, ie if ie is not None else EXPRESSIVE_EXAGGERATION)
    cfg = _clamp(seg.get("cfg_weight"), *CFG_RANGE, ic if ic is not None else EXPRESSIVE_CFG)
    return exag, cfg


def _strip_tags(text):
    import re
    return re.sub(r"\s*\[(?:%s)\]\s*" % "|".join(TURBO_TAGS), " ", text).strip()


def _with_tag(text, tag):
    """Places one Turbo tag: sighs and gasps lead the phrase, laughs follow it."""
    tag = (tag or "").strip().lower().strip("[]")
    if tag not in TURBO_TAGS:
        return text
    return f"[{tag}] {text}" if tag in ("sigh", "gasp", "clear throat", "sniff", "shush") else f"{text} [{tag}]"


def _group_runs(segments):
    """Neighbouring phrases with similar acting are generated as ONE take (a
    paragraph read keeps its natural flow and breaths); a new take starts only
    where the delivery really changes or a long beat is planned."""
    runs = []
    for seg in segments[:8]:
        text = str(seg.get("text") or "").strip()[:300]
        if not text:
            continue
        exag, cfg = _segment_acting(seg)
        pause = int(_clamp(seg.get("pause_after_ms"), 60, 900, 220))
        tag = seg.get("tag")
        if runs and abs(runs[-1]["exag"] - exag) <= 0.12 and abs(runs[-1]["cfg"] - cfg) <= 0.08 and runs[-1]["pause"] < 450 and not tag:
            r = runs[-1]
            r["texts"].append(text)
            r["exag"] = (r["exag"] + exag) / 2
            r["cfg"] = (r["cfg"] + cfg) / 2
            r["pause"] = pause
        else:
            runs.append({"texts": [_with_tag(text, tag) if tag else text], "exag": exag, "cfg": cfg, "pause": pause, "intent": seg.get("intent") or ""})
    return runs


def _room_tone(seconds, path):
    """A very quiet, darkened noise bed - a pause that sounds like a room, never digital zero."""
    _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
          f"anoisesrc=d={max(0.05, seconds):.3f}:c=pink:r=48000:a=0.0012",
          "-af", "lowpass=f=2200,highpass=f=60", "-ac", "1", path])


def _trim_ends(raw, out):
    """Trims leading/trailing dead air only - breaths inside the take stay."""
    _run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
          "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
          "-ar", "48000", "-ac", "1", out])


def _join(parts, pauses, tmp):
    """Joins takes with room-tone gaps and 30ms crossfades at every seam
    (was: anullsrc digital-zero gaps and hard concat)."""
    if len(parts) == 1:
        return parts[0]
    inputs, chain = [], []
    for i, p in enumerate(parts):
        inputs.append(p)
        if i < len(parts) - 1:
            gap = os.path.join(tmp, f"gap{i}.wav")
            _room_tone(max(0.08, pauses[i] / 1000), gap)
            inputs.append(gap)
    args = ["ffmpeg", "-y", "-v", "error"]
    for p in inputs:
        args += ["-i", p]
    prev = "[0:a]"
    for k in range(1, len(inputs)):
        label = f"[x{k}]"
        chain.append(f"{prev}[{k}:a]acrossfade=d=0.03:c1=tri:c2=tri{label}")
        prev = label
    out = os.path.join(tmp, "joined.wav")
    _run(args + ["-filter_complex", ";".join(chain), "-map", prev, "-ar", "48000", "-ac", "1", out])
    return out


def _fit_to_shot(joined, seconds, tmp, loudnorm=True):
    """Pads the line to the shot with a room-tone bed (a short lead-in for
    lip-sync), speeding up by at most 1.1x. Words are never cut: if the line
    is still longer than the shot, the audio runs long and the caller decides."""
    target = max(2.0, float(seconds) - 0.4)
    speech = _duration(joined)
    tempo = min(MAX_ATEMPO, speech / target) if speech > target else 1.0
    total = max(float(seconds), speech / tempo + 0.45)
    bed = os.path.join(tmp, "bed.wav")
    _room_tone(total, bed)
    norm = "loudnorm=I=-18:TP=-2:LRA=11," if loudnorm else ""
    out = os.path.join(tmp, "line.wav")
    _run(["ffmpeg", "-y", "-v", "error", "-i", joined, "-i", bed, "-filter_complex",
          f"[0:a]atempo={tempo:.3f},{norm}alimiter=limit=0.89,adelay=200|200,apad=whole_dur={total:.2f}[v];"
          f"[v][1:a]amix=inputs=2:duration=first:dropout_transition=0,volume=2[o]",
          "-map", "[o]", "-t", f"{total:.2f}", "-ar", "48000", "-ac", "1", out])
    return out


def _lucy_take(tts, text, voice_id, exag, cfg, path):
    r = tts.run_generate_preset.remote(_strip_tags(text), voice_id, exag, cfg, None, None)
    if not isinstance(r, dict) or not r.get("audio_base64"):
        raise RuntimeError((r or {}).get("error", "no audio"))
    with open(path, "wb") as f:
        f.write(base64.b64decode(r["audio_base64"]))


@app.function(image=image, secrets=[fal_key_secret], timeout=300)
def tts_line(voice_id, text, seconds, delivery=""):
    """A shot's line in a Lucy voice (lucy-tts app), as one take, fitted to the
    shot: dead air trimmed at the ends, sped up at most 1.1x, laid on a room-
    tone bed with a short lead-in so the lip-sync model has room."""
    tts = modal.Cls.from_name("lucy-tts", "LucyTTS")()
    ae, ac = _acting(delivery)
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "raw.wav")
        _lucy_take(tts, text, voice_id, ae if ae is not None else EXPRESSIVE_EXAGGERATION, ac if ac is not None else EXPRESSIVE_CFG, raw)
        trimmed = os.path.join(tmp, "trim.wav")
        _trim_ends(raw, trimmed)
        return _upload(_fit_to_shot(trimmed, seconds, tmp, loudnorm=False), "audio/wav", "line.wav", os.environ["FAL_KEY"])


@app.function(image=image, secrets=[fal_key_secret], timeout=420)
def tts_acted(voice_id, segments, seconds):
    """An ACTED line in a Lucy voice. `segments` = Lucy's acting pass
    ({text, intent, exaggeration, cfg_weight, pause_after_ms, tag?}).
    Neighbouring phrases with similar delivery are read as one take (natural
    flow and breaths); takes are joined with room tone and crossfades."""
    tts = modal.Cls.from_name("lucy-tts", "LucyTTS")()
    with tempfile.TemporaryDirectory() as tmp:
        parts, pauses = [], []
        for i, run in enumerate(_group_runs(segments)):
            raw = os.path.join(tmp, f"raw{i}.wav")
            _lucy_take(tts, " ".join(run["texts"]), voice_id, run["exag"], run["cfg"], raw)
            trimmed = os.path.join(tmp, f"take{i}.wav")
            _trim_ends(raw, trimmed)
            parts.append(trimmed)
            pauses.append(run["pause"])
        if not parts:
            raise RuntimeError("no text")
        return _upload(_fit_to_shot(_join(parts, pauses, tmp), seconds, tmp), "audio/wav", "line.wav", os.environ["FAL_KEY"])


# ---- Chatterbox-Turbo from a REAL recording (2026-09-30) ---------------------
#
# Voice-first for a cast member who uploaded their own voice (consented
# /api/director/voice-sample): the line is spoken zero-shot from that
# recording. Turbo (350M, one-step decoder) speaks paralinguistic tags
# ([chuckle], [sigh]...) mapped from the acting intent; it ignores
# exaggeration/cfg. The standard Chatterbox model (engine="standard") takes
# the expressive exaggeration/cfg settings instead. Nothing here calls a
# paid API; it runs on our own Modal GPU only when the customer opted in.
@app.cls(image=image, gpu="L4", secrets=[fal_key_secret], timeout=600, scaledown_window=120)
class Speaker:
    @modal.enter()
    def load(self):
        import torch

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._turbo = None
        self._standard = None

    def _model(self, engine):
        if engine == "standard":
            if self._standard is None:
                from chatterbox.tts import ChatterboxTTS
                self._standard = ChatterboxTTS.from_pretrained(device=self.device)
            return self._standard
        if self._turbo is None:
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            self._turbo = ChatterboxTurboTTS.from_pretrained(device=self.device)
        return self._turbo

    @modal.method()
    def speak(self, reference_url, segments, seconds, engine="turbo"):
        import soundfile as sf
        import torch

        model = self._model(engine)
        with tempfile.TemporaryDirectory() as tmp:
            ref = os.path.join(tmp, "ref.wav")
            _download(reference_url, ref)
            if _duration(ref) < 5.5:
                raise RuntimeError("voice recording too short (Turbo needs more than 5 seconds)")
            if engine != "standard":
                model.prepare_conditionals(ref)  # once per line, not once per take
            parts, pauses = [], []
            for i, run in enumerate(_group_runs(segments)):
                text = " ".join(run["texts"])
                with torch.no_grad():
                    if engine == "standard":
                        wav = model.generate(_strip_tags(text), audio_prompt_path=ref, exaggeration=run["exag"], cfg_weight=run["cfg"])
                    else:
                        wav = model.generate(text)
                raw = os.path.join(tmp, f"raw{i}.wav")
                sf.write(raw, wav.squeeze(0).cpu().numpy(), model.sr)
                trimmed = os.path.join(tmp, f"take{i}.wav")
                _trim_ends(raw, trimmed)
                parts.append(trimmed)
                pauses.append(run["pause"])
            if not parts:
                raise RuntimeError("no text")
            return _upload(_fit_to_shot(_join(parts, pauses, tmp), seconds, tmp), "audio/wav", "line.wav", os.environ["FAL_KEY"])


# ---- free lip-sync check (2026-09-30) ---------------------------------------
#
# Does the mouth move when the words are spoken? faster-whisper word timings
# (CPU, tiny model) give when speech happens; MediaPipe Face Mesh gives how
# open each face's mouth is on each sampled frame. The score is the
# correlation between the two, at the best lag within +/-0.3s. No paid API.
#
# Coverage grammar (2026-09-30): up to 3 faces are tracked by their position
# across the frame. The speaker is the face on their screen side (the plan's
# 180-degree sides: "left" = left of frame), else the largest face; in a
# reaction shot (expect="reaction") nobody in frame is the speaker. Flags:
#   mouth_on_non_speaker - a non-speaker's lips move with the speech
#                          (correlation >= 0.3 and 90th-percentile openness
#                          >= 0.04) - e.g. the listener lip-flapping to an
#                          off-screen line;
#   speaker_mouth_closed - the speaker's mouth hardly opens while they talk
#                          (90th-percentile openness during speech < 0.025).
SYNC_FPS = 12.5
LISTENER_MIN_CORR = 0.3
LISTENER_MIN_OPEN = 0.04
SPEAKER_MIN_OPEN = 0.025


def _best_corr(speech, mouth, n):
    """Best correlation (and lag in frames) between speech and a mouth signal within +/-0.3s."""
    import numpy as np

    best, best_lag = -1.0, 0
    max_lag = int(0.3 * SYNC_FPS)
    for lag in range(-max_lag, max_lag + 1):
        a = speech[max(0, lag): n + min(0, lag)]
        b = mouth[max(0, -lag): n - max(0, lag)]
        if len(a) < 5 or a.std() == 0 or b.std() == 0:
            continue
        c = float(np.corrcoef(a, b)[0, 1])
        if c > best:
            best, best_lag = c, lag
    return best, best_lag


@app.function(image=image, timeout=300, cpu=2.0)
def sync_check(video_url, expect="speaker", speaker_side=None):
    import numpy as np

    expect = "reaction" if expect == "reaction" else "speaker"
    speaker_side = speaker_side if speaker_side in ("left", "right") else None
    with tempfile.TemporaryDirectory() as tmp:
        v = os.path.join(tmp, "in.mp4")
        _download(video_url, v)
        wav = os.path.join(tmp, "a.wav")
        _run(["ffmpeg", "-y", "-v", "error", "-i", v, "-vn", "-ac", "1", "-ar", "16000", wav])
        duration = _duration(v)
        n = max(1, int(duration * SYNC_FPS))
        speech = np.zeros(n, dtype=np.float32)
        from faster_whisper import WhisperModel

        model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
        segs, _ = model.transcribe(wav, word_timestamps=True, vad_filter=True)
        words = 0
        heard = []
        for seg in segs:
            heard.append(seg.text.strip())
            for w in seg.words or []:
                words += 1
                speech[int(w.start * SYNC_FPS): max(int(w.start * SYNC_FPS) + 1, int(w.end * SYNC_FPS))] = 1.0
        text = " ".join(heard)[:600]
        tracks = [t for t in _mouth_tracks(v, n, tmp) if (~np.isnan(t["open"])).sum() >= n * 0.5]
        base = {"expect": expect, "words": words, "frames": n, "faces": len(tracks), "text": text}
        if words == 0 or not tracks:
            return {**base, "ok": None, "reason": "no speech or no face", "flags": []}

        speaker = None
        if expect == "speaker":
            if speaker_side and len(tracks) >= 2:
                speaker = min(tracks, key=lambda t: t["x"]) if speaker_side == "left" else max(tracks, key=lambda t: t["x"])
            else:
                speaker = max(tracks, key=lambda t: t["height"])
        talking = speech > 0
        flags = []
        listeners = []
        for t in tracks:
            m = np.where(np.isnan(t["open"]), np.nanmean(t["open"]), t["open"])
            corr, lag = _best_corr(speech, m, n)
            p90 = float(np.nanpercentile(t["open"], 90))
            if t is speaker:
                during = t["open"][talking]
                during = during[~np.isnan(during)]
                speaker_open = float(np.percentile(during, 90)) if len(during) >= max(3, talking.sum() * 0.5) else None
                speaker_corr, speaker_lag = corr, lag
                if speaker_open is not None and speaker_open < SPEAKER_MIN_OPEN:
                    flags.append("speaker_mouth_closed")
            else:
                listeners.append({"x": round(t["x"], 3), "score": round(corr, 3), "open_p90": round(p90, 4)})
                if corr >= LISTENER_MIN_CORR and p90 >= LISTENER_MIN_OPEN and "mouth_on_non_speaker" not in flags:
                    flags.append("mouth_on_non_speaker")
        out = {**base, "flags": flags, "listeners": listeners}
        if speaker is None:
            return {**out, "ok": not flags}
        lag_s = speaker_lag / SYNC_FPS
        in_sync = speaker_corr >= float(os.environ.get("DIRECTOR_SYNC_MIN_SCORE", "0.2")) and abs(lag_s) <= 0.17
        return {**out, "ok": in_sync and not flags, "score": round(speaker_corr, 3), "lag_s": round(lag_s, 3), "speaker_x": round(speaker["x"], 3), "speaker_open_p90": None if speaker_open is None else round(speaker_open, 4)}


def _mouth_tracks(video_path, n, tmp, max_faces=3):
    """Per face (tracked by horizontal position): mean x (0 = left of frame), mean face height, and inner-lip gap / face height per sampled frame (NaN = not seen)."""
    import cv2
    import mediapipe as mp
    import numpy as np

    frames_dir = os.path.join(tmp, "f")
    os.makedirs(frames_dir, exist_ok=True)
    _run(["ffmpeg", "-y", "-v", "error", "-i", video_path, "-vf", f"fps={SYNC_FPS},scale=480:-2", os.path.join(frames_dir, "%05d.jpg")])
    files = sorted(os.listdir(frames_dir))[:n]
    tracks = []  # {"xs": [...], "hs": [...], "open": array, "last_x": float}
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=False, max_num_faces=max_faces, refine_landmarks=False) as mesh:
        for i, name in enumerate(files):
            img = cv2.cvtColor(cv2.imread(os.path.join(frames_dir, name)), cv2.COLOR_BGR2RGB)
            res = mesh.process(img)
            if not res.multi_face_landmarks:
                continue
            taken = set()
            for face in res.multi_face_landmarks:
                lm = face.landmark
                height = abs(lm[152].y - lm[10].y)  # chin - forehead
                if height <= 0:
                    continue
                x = (lm[234].x + lm[454].x) / 2  # cheek to cheek centre
                gap = abs(lm[14].y - lm[13].y) / height  # lower inner lip - upper inner lip
                near = [k for k, t in enumerate(tracks) if k not in taken and abs(t["last_x"] - x) <= 0.15]
                if near:
                    k = min(near, key=lambda j: abs(tracks[j]["last_x"] - x))
                elif len(tracks) < max_faces:
                    tracks.append({"xs": [], "hs": [], "open": np.full(n, np.nan, dtype=np.float32), "last_x": x})
                    k = len(tracks) - 1
                else:
                    continue
                taken.add(k)
                t = tracks[k]
                t["xs"].append(x)
                t["hs"].append(height)
                t["last_x"] = x
                t["open"][i] = gap
    return [{"x": float(np.mean(t["xs"])), "height": float(np.mean(t["hs"])), "open": t["open"]} for t in tracks if t["xs"]]


@app.function(image=image, secrets=[auth_secret])
@modal.asgi_app()
def web():
    import fastapi

    api = fastapi.FastAPI()

    def _auth(request: fastapi.Request):
        expected = os.environ.get("MODAL_SHARED_SECRET", "")
        if not expected or not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {expected}"):
            raise fastapi.HTTPException(status_code=401, detail="Unauthorized")

    def _https(u):
        return isinstance(u, str) and u.startswith("https://")

    @api.post("/start")
    async def start(request: fastapi.Request):
        _auth(request)
        body = await request.json()
        mode = body.get("mode")
        if mode == "extract" and _https(body.get("video_url")):
            call = Voice().extract.spawn(body["video_url"])
        elif mode == "convert" and _https(body.get("video_url")) and _https(body.get("reference_url")):
            call = Voice().convert.spawn(body["video_url"], body["reference_url"])
        elif mode == "tts" and isinstance(body.get("voice_id"), str) and isinstance(body.get("segments"), list) and body["segments"]:
            call = tts_acted.spawn(body["voice_id"], body["segments"], float(body.get("seconds") or 8))
        elif mode == "tts" and isinstance(body.get("voice_id"), str) and isinstance(body.get("text"), str):
            call = tts_line.spawn(body["voice_id"], body["text"][:400], float(body.get("seconds") or 8), str(body.get("delivery") or "")[:120])
        elif mode == "speak" and _https(body.get("reference_url")) and isinstance(body.get("segments"), list) and body["segments"]:
            engine = "standard" if body.get("engine") == "standard" else "turbo"
            call = Speaker().speak.spawn(body["reference_url"], body["segments"], float(body.get("seconds") or 8), engine)
        elif mode == "sync_check" and _https(body.get("video_url")):
            expect = "reaction" if body.get("expect") == "reaction" else "speaker"
            side = body.get("speaker_side") if body.get("speaker_side") in ("left", "right") else None
            call = sync_check.spawn(body["video_url"], expect, side)
        elif mode == "mix" and _https(body.get("video_url")) and _https(body.get("bed_video_url")):
            call = Voice().mix.spawn(body["video_url"], body["bed_video_url"])
        elif mode == "preset":
            # 2026-09-30: synthetic (TTS) conversion targets are no longer allowed.
            raise fastapi.HTTPException(status_code=410, detail="Preset voice references are retired - upload a real recording")
        else:
            raise fastapi.HTTPException(status_code=400, detail="Bad request")
        return {"call_id": call.object_id}

    @api.get("/result")
    async def result(request: fastapi.Request, call_id: str):
        _auth(request)
        call = modal.FunctionCall.from_id(call_id)
        try:
            value = call.get(timeout=0)
            # sync_check returns a dict (score, lag); everything else a media URL.
            return {"status": "done", "result": value} if isinstance(value, dict) else {"status": "done", "url": value}
        except TimeoutError:
            return {"status": "running"}
        except Exception as err:  # noqa: BLE001
            return {"status": "failed", "error": str(err)[:300]}

    return api
