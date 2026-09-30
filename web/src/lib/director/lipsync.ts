// Optional lip-sync step + free sync check (2026-09-30 realism pass).
//
// Everything here is OFF by default:
//   DIRECTOR_LIPSYNC=off|kling|latentsync|sync2pro   (paid fal call per shot; default off)
//   DIRECTOR_SYNC_CHECK=1                             (free: our own Modal CPU; default off)
//
// Where it runs: inside the opt-in voice lock only (a cast member uploaded
// their own voice). For each shot that person speaks in:
//   1. sync check (if on): faster-whisper word timing vs a MediaPipe mouth-
//      open signal on the ORIGINAL take, plus the transcript vs the script.
//   2. good take -> the usual speech-to-speech voice swap (timing kept, so
//      lips stay as filmed - no lip-sync needed).
//   3. bad take (mouth out of sync, or gibberish instead of the scripted
//      words, e.g. the Neilson v2 0:48 shot), or a voice swap that failed
//      twice, and DIRECTOR_LIPSYNC is set -> "dub": the scripted line is
//      spoken from the person's real recording (Chatterbox-Turbo), the
//      mouth is re-synced to it on fal (Kling / LatentSync / Sync 2 Pro),
//      and the new speech is laid over the original take's room sound.
//   4. with the check on, the dubbed result is checked too and the original
//      take is kept if it is still out of sync.
// Any failure keeps the take as filmed.

export type LipsyncProvider = "kling" | "latentsync" | "sync2pro";

export const LIPSYNC_ENDPOINTS: Record<LipsyncProvider, string> = {
  kling: "fal-ai/kling-video/lipsync/audio-to-video",
  latentsync: "fal-ai/latentsync",
  sync2pro: "fal-ai/sync-lipsync/v2/pro",
};

export function lipsyncProvider(value: string | undefined = process.env.DIRECTOR_LIPSYNC): LipsyncProvider | null {
  const v = (value ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");
  if (v === "kling") return "kling";
  if (v === "latentsync") return "latentsync";
  if (v === "sync2pro" || v === "sync2" || v === "sync") return "sync2pro";
  return null;
}

export function syncCheckEnabled(value: string | undefined = process.env.DIRECTOR_SYNC_CHECK): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

/** fal input for each provider (schemas checked 2026-09-30). Audio longer than the video is cut, never looped. */
export function lipsyncInput(provider: LipsyncProvider, videoUrl: string, audioUrl: string): Record<string, unknown> {
  if (provider === "sync2pro") return { video_url: videoUrl, audio_url: audioUrl, sync_mode: "cut_off" };
  if (provider === "latentsync") return { video_url: videoUrl, audio_url: audioUrl, guidance_scale: 1.5 };
  return { video_url: videoUrl, audio_url: audioUrl };
}

/**
 * The voice step's state for one shot, stored in director_shots.voice_request_id
 * (no schema change): null | "retry" | "done" | "failed" | "<call>" | "r:<call>"
 * (voice swap / its retry) | "sc:<call>" (sync check) | "tts:<call>" (dub line)
 * | "ls:<provider>:<request>" (lip-sync) | "mx:<call>" (mix over room sound)
 * | "vc:<call>" (checking the dubbed result).
 */
export type VoiceState =
  | { kind: "new" }
  | { kind: "retry" }
  | { kind: "done" }
  | { kind: "failed" }
  | { kind: "convert"; id: string; retry: boolean }
  | { kind: "check"; id: string }
  | { kind: "dub"; id: string }
  | { kind: "lipsync"; id: string; provider: LipsyncProvider }
  | { kind: "mix"; id: string }
  | { kind: "verify"; id: string };

export function parseVoiceState(state: string | null | undefined): VoiceState {
  if (!state) return { kind: "new" };
  if (state === "retry" || state === "done" || state === "failed") return { kind: state };
  const m = /^(sc|tts|mx|vc):(.+)$/.exec(state);
  if (m) {
    const kind = ({ sc: "check", tts: "dub", mx: "mix", vc: "verify" } as const)[m[1] as "sc" | "tts" | "mx" | "vc"];
    return { kind, id: m[2] };
  }
  const ls = /^ls:([a-z0-9]+):(.+)$/.exec(state);
  if (ls) {
    const provider = lipsyncProvider(ls[1]);
    if (provider) return { kind: "lipsync", id: ls[2], provider };
  }
  if (state.startsWith("r:")) return { kind: "convert", id: state.slice(2), retry: true };
  return { kind: "convert", id: state, retry: false };
}

export const voiceState = {
  check: (id: string) => `sc:${id}`,
  dub: (id: string) => `tts:${id}`,
  lipsync: (provider: LipsyncProvider, id: string) => `ls:${provider}:${id}`,
  mix: (id: string) => `mx:${id}`,
  verify: (id: string) => `vc:${id}`,
};

const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(um+|uh+|hmm+|mm+|er|ah)$/.test(w));

/** Share of the script's words that were actually heard (0-1). 1 when there is no script. */
export function lineRecall(heard: string, script: string): number {
  const want = words(script);
  if (!want.length) return 1;
  const have = new Map<string, number>();
  for (const w of words(heard)) have.set(w, (have.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of want) {
    const n = have.get(w) ?? 0;
    if (n > 0) {
      hit++;
      have.set(w, n - 1);
    }
  }
  return hit / want.length;
}

export type SyncResult = { ok?: boolean | null; score?: number; lag_s?: number; text?: string; words?: number };

/**
 * Is the take as filmed good enough to keep its lips? Out of sync (the check
 * says so) or the wrong words (under 60% of the scripted words heard -
 * gibberish or an invented line) -> no. Unknown (no face / no speech found)
 * -> yes: never dub on a guess.
 */
export function takeIsGood(r: SyncResult | null | undefined, script: string): boolean {
  if (!r) return true;
  if (r.ok === false) return false;
  if (typeof r.text === "string" && script.trim() && lineRecall(r.text, script) < 0.6) return false;
  return true;
}
