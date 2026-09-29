import { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { initSchema } from "@/lib/db";
import { geminiWatchVideo } from "@/lib/gemini";
import { publicJson } from "@/lib/mediaProxy";
import { MAX_SHOTS } from "@/lib/director/plan";
import { underPlanCap } from "../_shared";

export const maxDuration = 60;

// "Copy a clip" (2026-09-29): Gemini watches a YouTube link or an uploaded
// MP4 and writes it out shot by shot in Lucy's script format - camera,
// framing, movement, blocking, who speaks and how - so a customer can copy a
// scene's direction without describing it. Dialogue is rewritten as new,
// original lines with the same intent (never transcribed), using the
// customer's cast names. Free, shares the daily planning cap.

const SYSTEM = `You are a film director's assistant. You watch a reference clip and write it out as a shot list the customer can film with their OWN characters.

Output ONLY the script, in exactly this format, one block per camera shot (a new shot every time the camera cuts), at most ${MAX_SHOTS} shots:

SHOT 1 - <framing: wide / medium / close-up / over the shoulder / insert>, <angle: eye level / low angle / high angle>, <camera move: locked-off / slow push in / dolly / handheld / tracking / pan>, about <N> seconds. <What we see and what the people do - blocking, gestures, where they look, the setting and light. Name people as instructed.>
NAME: (how they say it) The line.

Rules:
- Describe camera, movement, staging, pacing, lighting and mood precisely - this is what the customer wants to copy.
- NEVER transcribe the clip's dialogue. Write NEW original lines (at most 18 words per shot) that play the same beat and intent. Write numbers as words.
- If someone speaks off camera, write "(off screen)" in their delivery.
- A shot with no speech has no NAME line.
- Never name real actors, films, brands or logos from the clip. Describe people by role, not by who they are.
- If the clip has more than ${MAX_SHOTS} shots, cover the first ${MAX_SHOTS}.`;

function youTubeUrl(raw: string): string | null {
  const m = raw.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : null;
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json().catch(() => ({}))) as { url?: unknown; cast?: unknown; notes?: unknown };
    const raw = String(body.url ?? "").trim();
    const yt = youTubeUrl(raw);
    const isUpload = /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//.test(raw);
    if (!yt && !isUpload) return publicJson({ error: "Paste a YouTube link or upload an MP4" }, { status: 400 });
    if (!(await underPlanCap(req))) return publicJson({ error: "That's today's limit for Lucy's free help - try again tomorrow." }, { status: 429 });

    const cast = (Array.isArray(body.cast) ? body.cast : []).map(String).filter(Boolean).slice(0, 3);
    const castLine = cast.length
      ? `Use these names for the people, in order of importance in the clip: ${cast.join(", ")}.`
      : "Call the people by simple roles, e.g. THE BOSS, THE YOUNG MAN.";
    const notes = String(body.notes ?? "").trim().slice(0, 600);
    const prompt = `Write this clip as a shot list. ${castLine}${notes ? ` The customer's own story (use it for the new lines): ${notes}` : ""}`;

    const mime = yt ? "video/*" : raw.endsWith(".mov") ? "video/quicktime" : raw.endsWith(".webm") ? "video/webm" : "video/mp4";
    const script = await geminiWatchVideo(SYSTEM, prompt, yt ?? raw, mime);
    // The upload was only for Lucy to watch - don't keep the customer's clip.
    if (isUpload) await del(raw).catch(() => {});
    if (!script || !/SHOT\s*1/i.test(script)) {
      return publicJson({ error: "Lucy couldn't watch that clip - try a shorter one (under 2 minutes), or a public YouTube link." }, { status: 502 });
    }
    const shots = (script.match(/^\s*SHOT\s+\d+/gim) ?? []).length;
    return publicJson({ script: script.replace(/^```\w*\s*|```$/g, "").trim(), shots });
  } catch (err) {
    console.error("[director/analyze-clip] failed", err);
    return publicJson({ error: "Lucy couldn't watch that clip right now - try again in a minute." }, { status: 500 });
  }
}
