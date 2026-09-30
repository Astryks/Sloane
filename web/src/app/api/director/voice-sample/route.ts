import { NextRequest } from "next/server";
import { getOrCreatePaygoSessionUser } from "@/lib/auth";
import { initSchema, recordConsent, takeDirectorPlanSlot } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { uploadInputMedia } from "@/lib/mediaUpload";
import { VOICE_SAMPLE_CONSENT } from "@/lib/director/voiceSample";

// A REAL voice recording for one cast member (2026-09-30 realism pass).
// The Directed by Lucy voice lock is opt-in and only ever converts a shot's
// speech to a recording like this - never to a Lucy preset render or a clip
// made by the video model. Same consent rule as /api/clone-voice: the person
// uploading confirms it's their own voice or they have the speaker's
// explicit permission, and that statement is stored.
const MAX_BYTES = 4 * 1024 * 1024;
const DAILY_CAP = 20;
const AUDIO_EXT: Record<string, string> = { "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/wave": ".wav", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/webm": ".webm", "audio/ogg": ".ogg" };

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?]+$/g, "");

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || !audio.type.startsWith("audio/")) return publicJson({ error: "That file isn't an audio recording" }, { status: 400 });
    if (audio.size > MAX_BYTES) return publicJson({ error: "Keep the recording under 4MB - 60-120 seconds exported as M4A or MP3 at 192-256 kbps fits" }, { status: 400 });
    if (norm(String(form.get("consent") ?? "")) !== norm(VOICE_SAMPLE_CONSENT)) {
      return publicJson({ error: "Please confirm you have permission to use this voice." }, { status: 400 });
    }
    const user = await getOrCreatePaygoSessionUser();
    if (!(await takeDirectorPlanSlot(`voice-sample:${user.id}`, DAILY_CAP))) {
      return publicJson({ error: "You've added a lot of voice recordings today - try again tomorrow." }, { status: 429 });
    }
    await recordConsent({
      userId: user.id,
      contentType: "voice_reference",
      feature: "director-voice",
      consentText: `${VOICE_SAMPLE_CONSENT} (speaker: ${String(form.get("speaker") ?? "").slice(0, 120)})`,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    const url = await uploadInputMedia(Buffer.from(await audio.arrayBuffer()), audio.type, `voice${AUDIO_EXT[audio.type] ?? ".wav"}`, "vertex");
    return publicJson({ url });
  } catch (err) {
    console.error("[director/voice-sample] failed", err);
    return publicJson({ error: "Couldn't add that recording right now - please try again." }, { status: 500 });
  }
}
