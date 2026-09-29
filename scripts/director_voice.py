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
