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
  {"mode": "preset", "voice_id": "voice_tech", "text": "..."}
      -> a reference WAV spoken by a Lucy voice (calls the lucy-tts app).
  {"mode": "convert", "video_url": ..., "reference_url": ...}
      -> the shot re-voiced to the reference, as an MP4.
GET /result?call_id=... -> {status: running|done|failed, url?, error?}

Deploy:  python3 -m modal deploy scripts/director_voice.py
Then set MODAL_DIRECTOR_VOICE_URL in Vercel to the printed web URL.
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
    .pip_install("chatterbox-tts==0.1.2", "demucs==4.0.1", "soundfile", "numpy<2", "fastapi[standard]")
    # Bake both models into the image so a cold start doesn't re-download them.
    .run_commands(
        "python -c \"from demucs.pretrained import get_model; get_model('htdemucs')\"",
        "python -c \"from chatterbox.vc import ChatterboxVC; ChatterboxVC.from_pretrained(device='cpu')\"",
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


def _acting(delivery):
    """2026-09-30: the line's stage direction -> Chatterbox acting controls
    (exaggeration = emotional intensity, cfg_weight = how tightly it sticks to
    the reference's pace; lower = looser, more natural timing)."""
    d = (delivery or "").lower()
    if any(w in d for w in ("whisper", "quiet", "soft", "gentle", "tender", "sad", "hushed")):
        return 0.35, 0.5
    if any(w in d for w in ("excited", "angry", "shout", "boom", "roar", "laugh", "breathless", "furious", "thrilled", "yell")):
        return 0.95, 0.3
    if any(w in d for w in ("firm", "authorit", "confident", "stern", "cold", "commanding", "harsh")):
        return 0.6, 0.45
    if any(w in d for w in ("warm", "friendly", "curious", "smile", "playful", "bubbly")):
        return 0.7, 0.38
    return None, None


@app.function(image=image, secrets=[fal_key_secret], timeout=300)
def tts_line(voice_id, text, seconds, delivery=""):
    """A shot's line in a Lucy voice (lucy-tts app), fitted to the shot: trimmed
    of dead air, sped up (max 1.3x) if it's too long, and padded to the shot's
    length with a short lead-in so the lip-sync model has room."""
    tts = modal.Cls.from_name("lucy-tts", "LucyTTS")()
    exaggeration, cfg_weight = _acting(delivery)
    r = tts.run_generate_preset.remote(text, voice_id, exaggeration, cfg_weight)
    if not isinstance(r, dict) or not r.get("audio_base64"):
        raise RuntimeError((r or {}).get("error", "no audio"))
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "raw.wav")
        with open(raw, "wb") as f:
            f.write(base64.b64decode(r["audio_base64"]))
        trimmed = os.path.join(tmp, "trim.wav")
        _run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
              "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
              "-ar", "48000", "-ac", "1", trimmed])
        target = max(2.0, float(seconds) - 0.5)  # leave a beat at the end
        speech = _duration(trimmed)
        tempo = min(1.3, speech / target) if speech > target else 1.0
        out = os.path.join(tmp, "line.wav")
        _run(["ffmpeg", "-y", "-v", "error", "-i", trimmed, "-af",
              f"atempo={tempo:.3f},adelay=250|250,apad=whole_dur={float(seconds):.2f}",
              "-t", f"{float(seconds):.2f}", "-ar", "48000", "-ac", "1", out])
        return _upload(out, "audio/wav", "line.wav", os.environ["FAL_KEY"])


def _clamp(x, lo, hi, default):
    try:
        return max(lo, min(hi, float(x)))
    except (TypeError, ValueError):
        return default


@app.function(image=image, secrets=[fal_key_secret], timeout=420)
def tts_acted(voice_id, segments, seconds):
    """2026-09-30: an ACTED line. `segments` = one entry per sentence/phrase
    from Lucy's acting pass: {text, exaggeration, cfg_weight, speed,
    pause_after_ms}. Each is generated with its own intensity/pace (a question
    lifts, a threat drops and slows, an aside is quick and light), trimmed,
    then joined with the planned pauses - so inflection follows the intent of
    each sentence instead of one flat read of the whole line."""
    tts = modal.Cls.from_name("lucy-tts", "LucyTTS")()
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for i, seg in enumerate(segments[:8]):
            text = str(seg.get("text") or "").strip()[:300]
            if not text:
                continue
            # 2026-09-30, after a real listen: time-stretching (speed) and pushing
            # far from the voice's tuned 0.6/0.4 distorted Brad. Stay close to
            # each voice's own tuning; pacing comes from the pauses instead.
            r = tts.run_generate_preset.remote(
                text, voice_id,
                _clamp(seg.get("exaggeration"), 0.48, 0.72, 0.6),
                _clamp(seg.get("cfg_weight"), 0.36, 0.48, 0.4),
                None,
                None,
            )
            if not isinstance(r, dict) or not r.get("audio_base64"):
                raise RuntimeError((r or {}).get("error", "no audio"))
            raw = os.path.join(tmp, f"raw{i}.wav")
            with open(raw, "wb") as f:
                f.write(base64.b64decode(r["audio_base64"]))
            trimmed = os.path.join(tmp, f"seg{i}.wav")
            _run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
                  "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                  "-ar", "48000", "-ac", "1", trimmed])
            parts.append(trimmed)
            pause = int(_clamp(seg.get("pause_after_ms"), 60, 900, 220))
            if i < len(segments) - 1:
                gap = os.path.join(tmp, f"gap{i}.wav")
                _run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", f"{pause / 1000:.3f}", gap])
                parts.append(gap)
        if not parts:
            raise RuntimeError("no text")
        listing = os.path.join(tmp, "list.txt")
        with open(listing, "w") as f:
            for p in parts:
                f.write(f"file '{p}'\n")
        joined = os.path.join(tmp, "joined.wav")
        _run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", joined])
        target = max(2.0, float(seconds) - 0.4)
        speech = _duration(joined)
        tempo = min(1.25, speech / target) if speech > target else 1.0
        out = os.path.join(tmp, "line.wav")
        _run(["ffmpeg", "-y", "-v", "error", "-i", joined, "-af",
              f"atempo={tempo:.3f},loudnorm=I=-18:TP=-2:LRA=9,alimiter=limit=0.89,adelay=200|200,apad=whole_dur={float(seconds):.2f}",
              "-t", f"{float(seconds):.2f}", "-ar", "48000", "-ac", "1", out])
        return _upload(out, "audio/wav", "line.wav", os.environ["FAL_KEY"])


@app.function(image=image, secrets=[fal_key_secret], timeout=300)
def preset_reference(voice_id, text):
    """A reference clip in a Lucy voice, made by the lucy-tts app."""
    tts = modal.Cls.from_name("lucy-tts", "LucyTTS")()
    r = tts.run_generate_preset.remote(text, voice_id)
    if not isinstance(r, dict) or not r.get("audio_base64"):
        raise RuntimeError((r or {}).get("error", "no audio"))
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, "ref.wav")
        with open(p, "wb") as f:
            f.write(base64.b64decode(r["audio_base64"]))
        return _upload(p, "audio/wav", "ref.wav", os.environ["FAL_KEY"])


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
        elif mode == "mix" and _https(body.get("video_url")) and _https(body.get("bed_video_url")):
            call = Voice().mix.spawn(body["video_url"], body["bed_video_url"])
        elif mode == "preset" and isinstance(body.get("voice_id"), str):
            text = str(body.get("text") or "Hello there. This is how I sound when I talk, nice and natural, every single time.")[:300]
            call = preset_reference.spawn(body["voice_id"], text)
        else:
            raise fastapi.HTTPException(status_code=400, detail="Bad request")
        return {"call_id": call.object_id}

    @api.get("/result")
    async def result(request: fastapi.Request, call_id: str):
        _auth(request)
        call = modal.FunctionCall.from_id(call_id)
        try:
            return {"status": "done", "url": call.get(timeout=0)}
        except TimeoutError:
            return {"status": "running"}
        except Exception as err:  # noqa: BLE001
            return {"status": "failed", "error": str(err)[:300]}

    return api
