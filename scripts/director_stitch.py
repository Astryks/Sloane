#!/usr/bin/env python3
"""Directed by Lucy - stitch + colour match (Modal app, CPU only). 2026-09-27.

Joins a film's shots in order into one MP4 and makes them read as ONE film:
  * colour match - every shot is gently corrected toward shot 1's average
    brightness and R/G/B balance (per-channel gains measured with ffmpeg
    signalstats, clamped to +/-10% so a deliberate day->night change isn't
    flattened, just the random drift between generations);
  * conform - all shots scaled/padded to shot 1's size, 24 fps, yuv420p;
  * audio kept - each shot's own audio (native dialogue/ambience) is kept;
  * sound edit (2026-09-30 realism pass):
      - ONE film-level loudnorm (-16 LUFS, -1.5 dBTP) instead of one per shot,
        so room tone no longer pumps from shot to shot;
      - per-location room-tone beds built from the model's own ambience (the
        quietest seconds of that location's shots), crossfaded over 0.4s when
        the location changes - never digital silence at a cut;
      - 80ms equal-power fades at every cut, and an L-cut (the clip's own
        next 0.25s fading out under the next shot) wherever a clip was trimmed;
      - clips that run >1.5s past their planned length (8s reference-to-
        video clips for a short line) are trimmed to planned + 0.75s;
  * hard picture cuts between shots, like an edit.

Async API so the caller never waits on a serverless timeout:
  POST /start   {video_urls: [...], shots?: [{seconds, location}]} -> {call_id}
  GET  /result?call_id=...               -> {status: "running"} | {status: "done", video_url} | {status: "failed", error}
Both require `Authorization: Bearer <MODAL_SHARED_SECRET>`.

Output is uploaded to the same media storage the site already proxies via
/api/media, so users only ever see lucylabs.app links.

Deploy:  python3 -m modal deploy scripts/director_stitch.py
Then set MODAL_DIRECTOR_STITCH_URL in Vercel to the printed web URL.
"""
import hmac
import json
import os
import subprocess
import tempfile
import urllib.request

import modal

app = modal.App("director-stitch")
image = modal.Image.debian_slim(python_version="3.12").apt_install("ffmpeg").pip_install("fastapi[standard]", "numpy<3")
auth_secret = modal.Secret.from_name("lucy-inference-auth")
fal_key_secret = modal.Secret.from_name("fal-api-key")

MAX_GAIN = 0.10  # never correct a shot by more than 10% per channel


def _run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def _probe(path):
    """(width, height, has_audio, duration) parsed from `ffmpeg -i` (no ffprobe needed)."""
    import re
    info = subprocess.run(["ffmpeg", "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    m = re.search(r"Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})", info)
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    if not m:
        raise RuntimeError(f"not a video: {path}")
    dur = int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else 0.0
    return int(m.group(1)), int(m.group(2)), "Audio:" in info, dur


def _mean_rgb(path):
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", "fps=2,scale=64:-2,format=rgb24", "-f", "rawvideo", "-"],
        check=True, capture_output=True,
    )
    raw = proc.stdout
    n = len(raw) // 3 or 1
    r = sum(raw[0::3]) / n
    g = sum(raw[1::3]) / n
    b = sum(raw[2::3]) / n
    return r, g, b


def _clamp(x):
    return max(1 - MAX_GAIN, min(1 + MAX_GAIN, x))


def _upload(path, fal_key, content_type="video/mp4", name="film.mp4"):
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


# ---- sound edit (2026-09-30 realism pass) ----------------------------------
SR = 48000
FADE_S = 0.08  # equal-power fade at every internal cut edge (no clicks, no hard jumps)
L_CUT_S = 0.25  # a trimmed clip's own tail carries under the next shot (L-cut)
BED_XFADE_S = 0.4  # location beds crossfade across a change of location
BED_GAIN = 0.5  # the looped room tone sits ~6 dB under the model's own ambience
TRIM_SLACK_S = 1.5  # only trim a clip that runs this much past its planned length
TRIM_KEEP_S = 0.75  # ...and keep this much after the planned length


def _read_audio(path, seconds):
    """A clip's audio as float32 [n, 2] at 48k (silence if it has none)."""
    import numpy as np

    n = max(1, int(round(seconds * SR)))
    proc = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True)
    a = np.frombuffer(proc.stdout, dtype=np.float32).reshape(-1, 2) if proc.returncode == 0 and proc.stdout else np.zeros((0, 2), np.float32)
    out = np.zeros((n, 2), np.float32)
    out[: min(n, len(a))] = a[:n]
    return out, a  # (exactly `seconds` long, full decoded audio)


def _fade(n, rising):
    import numpy as np

    t = np.linspace(0, 1, n, dtype=np.float32)
    f = np.sin(t * np.pi / 2) if rising else np.cos(t * np.pi / 2)
    return f[:, None]


def _room_tone_of(full_audio, rng):
    """The quietest 1s windows of a clip's own audio - its room tone - or None."""
    import numpy as np

    win = SR
    if len(full_audio) < win * 2:
        return None
    rms = [(float(np.sqrt(np.mean(full_audio[i:i + win] ** 2))), i) for i in range(0, len(full_audio) - win, win // 2)]
    rms = [r for r in rms if r[0] > 1e-5]  # digital zero isn't room tone
    if not rms:
        return None
    rms.sort()
    picks = rms[:3]
    rng.shuffle(picks)
    return [full_audio[i:i + win].copy() for _, i in picks]


def _loop_bed(windows, n, rng):
    """Fills n samples by chaining room-tone windows with 50ms crossfades (random order, no audible loop)."""
    import numpy as np

    out = np.zeros((n, 2), np.float32)
    xf = int(0.05 * SR)
    pos = 0
    while pos < n:
        w = windows[int(rng.integers(len(windows)))]
        seg = w.copy()
        seg[:xf] *= _fade(xf, True)
        seg[-xf:] *= _fade(xf, False)
        end = min(n, pos + len(seg))
        out[pos:end] += seg[: end - pos]
        pos += len(seg) - xf
    return out


def _synthetic_tone(n, rng):
    """Very quiet darkened noise for a location with no usable room tone of its own."""
    import numpy as np

    white = rng.standard_normal((n, 2)).astype(np.float32)
    brown = np.cumsum(white, axis=0)
    brown -= np.linspace(brown[0], brown[-1], n, dtype=np.float32)  # no DC drift
    brown /= (np.abs(brown).max() + 1e-6)
    return brown * 0.0025


def _plan_trim(dur, planned):
    """Seconds to keep: an 8s reference-to-video clip for a 4.5s line is cut back, others untouched."""
    if planned and dur - planned > TRIM_SLACK_S:
        return round(planned + TRIM_KEEP_S, 3)
    return None


@app.function(image=image, secrets=[fal_key_secret], timeout=600, cpu=4)
def stitch(video_urls, shots=None):
    """shots (optional, aligned with video_urls): [{seconds, location, ambience}]
    - the planned length and location of each shot, used for trimming and the
    per-location room-tone beds. Old callers (urls only) still work."""
    import numpy as np

    shots = shots if isinstance(shots, list) and len(shots) == len(video_urls) else [{} for _ in video_urls]
    rng = np.random.default_rng(7)
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for i, url in enumerate(video_urls):
            p = os.path.join(tmp, f"in{i}.mp4")
            urllib.request.urlretrieve(url, p)
            paths.append(p)

        w, h, _, _ = _probe(paths[0])
        ref = _mean_rgb(paths[0])
        normalized, lengths, audio, tails, tones = [], [], [], [], []
        for i, p in enumerate(paths):
            _, _, has_audio, dur = _probe(p)
            m = _mean_rgb(p)
            gains = [_clamp(ref[c] / m[c]) if m[c] > 1 else 1.0 for c in range(3)] if i > 0 else [1.0, 1.0, 1.0]
            vf = (
                f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,"
                f"fps=24,colorchannelmixer=rr={gains[0]:.4f}:gg={gains[1]:.4f}:bb={gains[2]:.4f},"
                # 2026-09-29 film finish: one light, moving grain over every shot
                # hides the too-clean AI look and the seams between models.
                f"noise=c0s=5:c0f=t+u:c1s=2:c1f=t+u:c2s=2:c2f=t+u,format=yuv420p"
            )
            keep = _plan_trim(dur, float(shots[i].get("seconds") or 0))
            out = os.path.join(tmp, f"n{i}.mp4")
            cmd = ["ffmpeg", "-y", "-v", "error", "-i", p, "-vf", vf, "-an"]
            if keep:
                cmd += ["-t", f"{keep:.3f}"]
            _run(cmd + ["-c:v", "libx264", "-preset", "veryfast", "-crf", "19", out])
            vlen = _probe(out)[3] or keep or dur
            normalized.append(out)
            lengths.append(vlen)
            # 2026-09-30: NO per-shot loudnorm any more (it pumped each shot's
            # room tone up or down independently); one film-level pass below.
            a, full = _read_audio(p, vlen) if has_audio else (np.zeros((int(round(vlen * SR)), 2), np.float32), np.zeros((0, 2), np.float32))
            audio.append(a)
            n0 = len(a)
            tails.append(full[n0:n0 + int(L_CUT_S * SR)].copy() if keep and len(full) > n0 else None)
            tones.append(_room_tone_of(full, rng) if has_audio else None)

        offsets = [0]
        for L in lengths[:-1]:
            offsets.append(offsets[-1] + int(round(L * SR)))
        total = offsets[-1] + len(audio[-1]) + int(L_CUT_S * SR)
        mix = np.zeros((total, 2), np.float32)
        fn = int(FADE_S * SR)
        for i, a in enumerate(audio):
            a = a.copy()
            if i > 0 and len(a) > fn:
                a[:fn] *= _fade(fn, True)
            if i < len(audio) - 1 and len(a) > fn:
                if tails[i] is not None and len(tails[i]):
                    # L-cut: the trimmed tail of this shot keeps playing under the
                    # start of the next one, fading out.
                    t = tails[i] * _fade(len(tails[i]), False)
                    a = np.concatenate([a, t])
                else:
                    a[-fn:] *= _fade(fn, False)
            mix[offsets[i]: offsets[i] + len(a)] += a[: total - offsets[i]]

        # Per-location room-tone beds from the model's OWN ambience (the
        # quietest seconds of that location's shots), crossfaded where the
        # location changes. Replaces one synthetic brown-noise bed for the film.
        keys = [str(shots[i].get("location") or "main").strip().lower()[:60] for i in range(len(audio))]
        beds = {}
        for k in dict.fromkeys(keys):
            windows = [wnd for i in range(len(audio)) if keys[i] == k and tones[i] for wnd in tones[i]]
            beds[k] = windows
        bed = np.zeros((total, 2), np.float32)
        xf = int(BED_XFADE_S * SR)
        for i in range(len(audio)):
            a0 = max(0, offsets[i] - (xf // 2 if i > 0 and keys[i] != keys[i - 1] else 0))
            last = i == len(audio) - 1
            a1 = total if last else offsets[i + 1] + (xf // 2 if keys[i + 1] != keys[i] else 0)
            n = a1 - a0
            seg = _loop_bed(beds[keys[i]], n, rng) if beds[keys[i]] else _synthetic_tone(n, rng)
            if i > 0 and keys[i] != keys[i - 1] and n > xf:
                seg[:xf] *= _fade(xf, True)
            if not last and keys[i + 1] != keys[i] and n > xf:
                seg[-xf:] *= _fade(xf, False)
            bed[a0:a1] += seg
        mix += bed * BED_GAIN
        film_len = sum(lengths)
        mix = mix[: int(round(film_len * SR))]

        wav = os.path.join(tmp, "mix.f32")
        mix.astype(np.float32).tofile(wav)
        listing = os.path.join(tmp, "list.txt")
        with open(listing, "w") as f:
            for n_ in normalized:
                f.write(f"file '{n_}'\n")
        joined = os.path.join(tmp, "joined.mp4")
        # Every input now shares codec/size/fps, so a copy-concat is safe.
        _run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", joined])
        final = os.path.join(tmp, "film.mp4")
        # ONE loudness pass for the whole film (-16 LUFS, -1.5 dBTP) so the
        # level relationships between shots survive.
        _run(["ffmpeg", "-y", "-v", "error", "-i", joined, "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", wav,
              "-filter_complex", "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]",
              "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
              "-shortest", "-movflags", "+faststart", final])
        return _upload(final, os.environ["FAL_KEY"])


@app.function(image=image, secrets=[fal_key_secret], timeout=120)
def last_frame(video_url):
    """Continuous takes (2026-09-30): the final frame of a finished shot, so the
    next shot can start exactly where it ended (same face, room and light)."""
    with tempfile.TemporaryDirectory() as tmp:
        v = os.path.join(tmp, "in.mp4")
        urllib.request.urlretrieve(video_url, v)
        out = os.path.join(tmp, "last.png")
        _run(["ffmpeg", "-y", "-v", "error", "-sseof", "-0.25", "-i", v, "-frames:v", "1", "-update", "1", out])
        return _upload(out, os.environ["FAL_KEY"], "image/png", "last.png")


@app.function(image=image, secrets=[auth_secret])
@modal.asgi_app()
def web():
    import fastapi

    api = fastapi.FastAPI()

    def _auth(request: fastapi.Request):
        expected = os.environ.get("MODAL_SHARED_SECRET", "")
        if not expected or not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {expected}"):
            raise fastapi.HTTPException(status_code=401, detail="Unauthorized")

    @api.post("/start")
    async def start(request: fastapi.Request):
        _auth(request)
        body = await request.json()
        raw = body.get("video_urls", [])
        urls = [u for u in raw if isinstance(u, str) and u.startswith("https://")][:12]
        if len(urls) < 2:
            raise fastapi.HTTPException(status_code=400, detail="Need at least two https video URLs")
        shots = body.get("shots")
        if not (isinstance(shots, list) and len(shots) == len(raw) and len(urls) == len(raw)):
            shots = None
        else:
            shots = [
                {"seconds": float(x.get("seconds") or 0) if isinstance(x, dict) else 0,
                 "location": str(x.get("location") or "")[:80] if isinstance(x, dict) else ""}
                for x in shots[:12]
            ]
        call = stitch.spawn(urls, shots)
        return {"call_id": call.object_id}

    @api.post("/lastframe")
    async def lastframe(request: fastapi.Request):
        _auth(request)
        body = await request.json()
        url = body.get("video_url")
        if not (isinstance(url, str) and url.startswith("https://")):
            raise fastapi.HTTPException(status_code=400, detail="Need an https video URL")
        return {"url": await last_frame.remote.aio(url)}

    @api.get("/result")
    async def result(request: fastapi.Request, call_id: str):
        _auth(request)
        call = modal.FunctionCall.from_id(call_id)
        try:
            url = call.get(timeout=0)
            return {"status": "done", "video_url": url}
        except TimeoutError:
            return {"status": "running"}
        except Exception as err:  # noqa: BLE001 - report any failure to the caller
            return {"status": "failed", "error": str(err)[:300]}

    return api
