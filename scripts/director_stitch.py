#!/usr/bin/env python3
"""Directed by Lucy - stitch + colour match (Modal app, CPU only). 2026-09-27.

Joins a film's shots in order into one MP4 and makes them read as ONE film:
  * colour match - every shot is gently corrected toward shot 1's average
    brightness and R/G/B balance (per-channel gains measured with ffmpeg
    signalstats, clamped to +/-10% so a deliberate day->night change isn't
    flattened, just the random drift between generations);
  * conform - all shots scaled/padded to shot 1's size, 24 fps, yuv420p;
  * audio kept - each shot's own audio (native dialogue/ambience) is kept; a
    shot without audio gets silence so the concat never drops sound;
  * hard cuts between shots, like an edit.

Async API so the caller never waits on a serverless timeout:
  POST /start   {video_urls: [...]}      -> {call_id}
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
image = modal.Image.debian_slim(python_version="3.12").apt_install("ffmpeg").pip_install("fastapi[standard]")
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


def _upload(path, fal_key):
    init = urllib.request.Request(
        "https://rest.fal.ai/storage/upload/initiate",
        data=json.dumps({"file_name": "film.mp4", "content_type": "video/mp4"}).encode(),
        headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(init, timeout=30) as resp:
        d = json.loads(resp.read())
    with open(path, "rb") as f:
        put = urllib.request.Request(d["upload_url"], data=f.read(), headers={"Content-Type": "video/mp4"}, method="PUT")
    with urllib.request.urlopen(put, timeout=120):
        pass
    return d["file_url"]


@app.function(image=image, secrets=[fal_key_secret], timeout=600, cpu=4)
def stitch(video_urls):
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for i, url in enumerate(video_urls):
            p = os.path.join(tmp, f"in{i}.mp4")
            urllib.request.urlretrieve(url, p)
            paths.append(p)

        w, h, _, _ = _probe(paths[0])
        ref = _mean_rgb(paths[0])
        normalized = []
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
            # Same loudness in every shot, and tiny fades so cuts never click.
            af = f"loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.02,afade=t=out:st={max(dur - 0.03, 0):.3f}:d=0.03"
            out = os.path.join(tmp, f"n{i}.mp4")
            cmd = ["ffmpeg", "-y", "-v", "error", "-i", p]
            if not has_audio:
                cmd += ["-f", "lavfi", "-t", f"{max(dur, 0.1):.3f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]
            cmd += ["-vf", vf, "-map", "0:v:0", "-map", "0:a:0" if has_audio else "1:a:0",
                    "-af", af,
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", out]
            _run(cmd)
            normalized.append(out)

        listing = os.path.join(tmp, "list.txt")
        with open(listing, "w") as f:
            for n in normalized:
                f.write(f"file '{n}'\n")
        final = os.path.join(tmp, "film.mp4")
        # Every input now shares codec/size/fps/audio format, so a copy-concat is safe.
        joined = os.path.join(tmp, "joined.mp4")
        _run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", joined])
        # A faint continuous room tone under the whole film, so the sound never
        # drops to dead digital silence at a cut (a strong "AI clip" giveaway).
        _run(["ffmpeg", "-y", "-v", "error", "-i", joined,
              "-f", "lavfi", "-i", "anoisesrc=color=brown:amplitude=0.004:sample_rate=48000,lowpass=f=900,aformat=channel_layouts=stereo",
              "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]",
              "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
              "-movflags", "+faststart", final])
        return _upload(final, os.environ["FAL_KEY"])


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
        urls = [u for u in body.get("video_urls", []) if isinstance(u, str) and u.startswith("https://")][:8]
        if len(urls) < 2:
            raise fastapi.HTTPException(status_code=400, detail="Need at least two https video URLs")
        call = stitch.spawn(urls)
        return {"call_id": call.object_id}

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
