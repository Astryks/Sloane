#!/usr/bin/env python3
"""Ad Studio's video-stitching Modal app - concatenates one video clip per
approved scene into a single final video.

Deliberately a SEPARATE Modal app from lucy-tts (scripts/modal_app.py):
this is CPU-only work (ffmpeg concat, no model inference), so it gets its
own lightweight image with no GPU/CUDA/torch - no reason to pay for or
provision GPU capacity for what's just file muxing.

Uses ffmpeg's `concat` FILTER (re-encoding), not the faster `concat` DEMUXER
(`-c copy`, stream-copy only) - a real, deliberate choice: stream-copy concat
requires every input clip to share the exact same codec/resolution/pixel
format, which isn't guaranteed here since different scenes in one project
could in principle use different fal video engines. Re-encoding is slower
but correct regardless of what produced each clip.

Video-only (no audio streams in the concat) because every scene's fal
generation call sets `generate_audio: false` (see adStudio.ts) - dialogue/
music is a separate, later layer (lipsync dub), not something this step
needs to carry.

Two real bugs fixed here (security audit, 2026-09-16), both closed the same
way as scripts/modal_app.py's own auth fix:
1. This endpoint had no auth at all - anyone with the URL could trigger
   free CPU compute (arbitrary video downloads + ffmpeg concat) at this
   app's expense.
2. FAL_KEY used to be passed in the request body on every call - sent
   across the wire to a third-party infra provider on every single stitch,
   multiplying the key's exposure surface for no real benefit now that the
   one-time Modal-secret setup this used to avoid is already required for
   modal_app.py anyway. It's now a Modal Secret this function reads
   directly, never transmitted by the caller.
One-time setup (see STATUS.md): both secrets already exist if
modal_app.py's own auth was already set up -
    modal secret create lucy-inference-auth MODAL_SHARED_SECRET=<same value as modal_app.py's>
    modal secret create fal-api-key FAL_KEY=<the real fal.ai key>

Deploy: modal deploy scripts/ad_studio_stitch.py
"""
import hmac
import json
import os
import subprocess
import tempfile
import urllib.request

import fastapi
import modal

app = modal.App("ad-studio-stitch")

image = modal.Image.debian_slim(python_version="3.12").apt_install("ffmpeg").pip_install("fastapi[standard]")

auth_secret = modal.Secret.from_name("lucy-inference-auth")
fal_key_secret = modal.Secret.from_name("fal-api-key")


def _require_shared_secret(request: fastapi.Request):
    expected = os.environ.get("MODAL_SHARED_SECRET")
    if not expected:
        raise fastapi.HTTPException(status_code=500, detail="Server misconfigured: MODAL_SHARED_SECRET not set")
    # Real fix (2026-09-17, follow-up audit): see modal_app.py's identical
    # fix - plain `!=` on a secret is a timing side-channel.
    if not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {expected}"):
        raise fastapi.HTTPException(status_code=401, detail="Unauthorized")


def _upload_to_fal(path: str, fal_key: str, content_type: str, file_name: str) -> str:
    init_req = urllib.request.Request(
        "https://rest.fal.ai/storage/upload/initiate",
        data=json.dumps({"file_name": file_name, "content_type": content_type}).encode(),
        headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(init_req, timeout=30) as resp:
        init_data = json.loads(resp.read())
    upload_url, file_url = init_data["upload_url"], init_data["file_url"]
    with open(path, "rb") as f:
        data = f.read()
    put_req = urllib.request.Request(upload_url, data=data, headers={"Content-Type": content_type}, method="PUT")
    with urllib.request.urlopen(put_req, timeout=120):
        pass
    return file_url


@app.function(image=image, timeout=600, secrets=[auth_secret, fal_key_secret])
@modal.fastapi_endpoint(method="POST")
def stitch(item: dict, request: fastapi.Request):
    _require_shared_secret(request)
    video_urls = item["video_urls"]
    fal_key = os.environ["FAL_KEY"]
    if not video_urls:
        return {"error": "No video URLs provided"}

    with tempfile.TemporaryDirectory() as tmp:
        local_paths = []
        for i, url in enumerate(video_urls):
            path = os.path.join(tmp, f"clip_{i:03d}.mp4")
            urllib.request.urlretrieve(url, path)
            local_paths.append(path)

        output_path = os.path.join(tmp, "final.mp4")
        cmd = ["ffmpeg", "-y"]
        for p in local_paths:
            cmd += ["-i", p]
        n = len(local_paths)
        filter_complex = "".join(f"[{i}:v]" for i in range(n)) + f"concat=n={n}:v=1:a=0[outv]"
        cmd += ["-filter_complex", filter_complex, "-map", "[outv]", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", output_path]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return {"error": f"ffmpeg concat failed: {result.stderr[-2000:]}"}

        final_url = _upload_to_fal(output_path, fal_key, "video/mp4", "ad_studio_final.mp4")
        return {"video_url": final_url}
