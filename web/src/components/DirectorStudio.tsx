"use client";

// "Directed by Lucy" (2026-09-27): type an idea -> Lucy works out what you're
// trying to do (sell, tell a story, explain...), plans a shot-by-shot
// storyboard (free, editable), then produces and stitches the film on any
// model, pay as you go. See lib/director/* and /api/director/*.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ANGLES,
  CAMERA_MOVES,
  PRODUCTION_STYLES,
  SHOT_SIZES,
  ALL_ANGLE_IDS,
  ALL_MOVE_IDS,
  ALL_SIZE_IDS,
  ALL_STYLE_IDS,
  type ProductionStyleId,
} from "@/lib/director/filmScience";
import { MAX_SHOTS, MIN_SHOTS, DEFAULT_SHOTS, ALL_CAMERA_FORMATS, CAMERA_FORMATS, type CameraFormatId, type DirectorPlan, type DirectorShot } from "@/lib/director/plan";
import {
  VIDEO_PAYGO_ENGINES,
  DIRECTOR_FEE_CENTS,
  directorShotPriceCents,
  formatUsd,
  type VideoEngine,
} from "@/lib/videoEngines";
import type { DirectorRecipe } from "./DirectorRecipes";
import { ScriptHelp } from "./ScriptHelp";
import { coverageByDefault } from "@/lib/director/coverage";
import { VOICE_SAMPLE_CONSENT } from "@/lib/director/voiceSample";
import { CopyClip } from "./CopyClip";
import { CharacterGuide } from "./CharacterGuide";
import { DirectorPhotos, EMPTY_PHOTOS, isUploading, photosFromLinks, readyUrls, type CastPick, type RefPhotos } from "./DirectorPhotos";

const DRAFT_KEY = "lucy_director_draft";
const GOAL_LABEL: Record<string, string> = {
  sell: "Selling something",
  story: "Telling a story",
  explain: "Explaining / teaching",
  promote: "Promoting",
  entertain: "Entertaining",
};

type ShotStatus = { idx: number; status: string; keyframeUrl: string | null; videoUrl: string | null; error: string | null };
type FilmStatus = {
  status: string;
  error: string | null;
  finalVideoUrl: string | null;
  anchorUrl: string | null;
  shots: ShotStatus[];
  casting?: boolean;
  autoApprove?: boolean;
  characterPhotos?: string[];
  plan?: DirectorPlan;
  revisionsUsed?: number;
  maxRevisions?: number;
  totalCents?: number;
  refundIfCancelledCents?: number;
  dueOnApproveCents?: number;
};
const APPROVE_KEY = "lucy_director_approve";

/** The shot sheet as plain text for Claude/ChatGPT to edit and hand back. */
function sheetForAI(plan: DirectorPlan): string {
  const shots = plan.shots
    .map((s, i) => `SHOT ${i + 1} - ${s.size.replace(/_/g, " ")}, ${s.angle.replace(/_/g, " ")}, ${s.move.replace(/_/g, " ")}, about ${s.durationSeconds} seconds. ${s.action}${s.dialogue ? `\n${(s.speaker || "SPEAKER").toUpperCase()}: ${s.dialogue}` : ""}`)
    .join("\n\n");
  return `Here is the shot sheet for my film scene "${plan.title}". Improve it like a film director: better camera coverage (a wide, then over-the-shoulder close-ups on whoever is talking), natural lines with personality, one person speaking per shot, at most 18 spoken words per shot, numbers written as words. Keep the same characters and the same story. Reply with ONLY the full edited sheet in exactly this format.\n\n${shots}`;
}

function StepBadge({ n }: { n: number }) {
  return <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple text-xs font-extrabold text-white">{n}</span>;
}
const DONE_STATES = ["completed", "failed", "cancelled"];
const MOVIE_KEY = "lucy_movie_preset";
type MoviePreset = {
  id: string;
  name: string;
  data: { style?: string; engine?: string; aspect?: string; castIds?: string[]; setId?: string | null; notes?: string; look?: DirectorPlan["look"] | null };
};
const MAX_WORDS_PER_SHOT = 18; // ~8s of natural speech - Veo's longest shot
/** Number of "SHOT n" blocks in a pasted script (0 = a plain idea). */
function scriptShotCount(text: string): number {
  const n = (text.match(/^\s*SHOT\s*\d+/gim) ?? []).length;
  return n >= 2 ? Math.min(MAX_SHOTS, n) : 0;
}
// Same rule as lib/director/compile.ts continuesFromPrevious (kept tiny and local for the card label).
function lineContinues(plan: DirectorPlan, i: number): boolean {
  const prev = plan.shots[i - 1];
  const cur = plan.shots[i];
  if (!prev?.dialogue?.trim() || !cur?.dialogue?.trim()) return false;
  const same = !prev.speaker || !cur.speaker || prev.speaker.toLowerCase() === cur.speaker.toLowerCase();
  return same && !/[.!?…]["')\]]*\s*$/.test(prev.dialogue.replace(/\([^)]*\)/g, "").trim());
}

const inputCls = "w-full rounded-xl border border-border bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple";

export function DirectorStudio({
  header,
  modeSwitch,
  recipe,
}: {
  header?: React.ReactNode;
  modeSwitch?: React.ReactNode;
  recipe?: (DirectorRecipe & { v: number }) | null;
}) {
  const [idea, setIdea] = useState("");
  const [style, setStyle] = useState<ProductionStyleId | "auto">("auto");
  const [shotCount, setShotCount] = useState(DEFAULT_SHOTS);
  const [aspect, setAspect] = useState<"auto" | "16:9" | "9:16">("auto");
  const [engine, setEngine] = useState<VideoEngine>("veo");
  const [photos, setPhotos] = useState<RefPhotos>(EMPTY_PHOTOS);
  const [plan, setPlan] = useState<DirectorPlan | null>(null);
  const planState = plan;
  const [planning, setPlanning] = useState(false);
  const [revising, setRevising] = useState<number | "all" | null>(null);
  const [reviseText, setReviseText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filmId, setFilmId] = useState<string | null>(null);
  const [film, setFilm] = useState<FilmStatus | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedCast, setSelectedCast] = useState<CastPick[]>([]);
  // Real voice recordings per cast id, for the opt-in voice lock (2026-09-30).
  const [voiceSamples, setVoiceSamples] = useState<Record<string, string>>({});
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [presets, setPresets] = useState<MoviePreset[]>([]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [movieNotes, setMovieNotes] = useState("");
  const [presetSetId, setPresetSetId] = useState<string | null>(null);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const activePreset = presets.find((p) => p.id === presetId) ?? null;

  async function applyPreset(p: MoviePreset | null) {
    setPresetId(p?.id ?? null);
    try {
      if (p) localStorage.setItem(MOVIE_KEY, p.id);
      else localStorage.removeItem(MOVIE_KEY);
    } catch {}
    if (!p) return;
    const d = p.data;
    if (d.style && (d.style === "auto" || (ALL_STYLE_IDS as string[]).includes(d.style))) setStyle(d.style as ProductionStyleId | "auto");
    if (d.engine && VIDEO_PAYGO_ENGINES[d.engine as VideoEngine]) setEngine(d.engine as VideoEngine);
    if (d.aspect === "16:9" || d.aspect === "9:16" || d.aspect === "auto") setAspect(d.aspect);
    setMovieNotes(d.notes ?? "");
    setPresetSetId(d.setId ?? null);
    if (d.castIds?.length) {
      try {
        const all = ((await (await fetch("/api/director/characters")).json()).characters ?? []) as CastPick[];
        setSelectedCast(d.castIds.map((id) => all.find((c) => c.id === id)).filter((c): c is CastPick => !!c).map((c) => ({ id: c.id, name: c.name, description: c.description, voiceId: (c as CastPick).voiceId })));
      } catch {}
    }
  }

  // Load saved movies; re-open the last one used so nothing needs setting up again.
  useEffect(() => {
    fetch("/api/director/presets")
      .then((r) => r.json())
      .then((d) => {
        const list = (Array.isArray(d.presets) ? d.presets : []) as MoviePreset[];
        setPresets(list);
        let last: string | null = null;
        try {
          last = localStorage.getItem(MOVIE_KEY);
        } catch {}
        const p = list.find((x) => x.id === last);
        if (p) applyPreset(p);
      })
      .catch(() => {});
     
  }, []);

  async function saveMovie() {
    const name = window.prompt("Name this movie (its settings load automatically next time):", activePreset?.name ?? "My movie")?.trim();
    if (!name) return;
    const data = {
      style,
      engine,
      aspect,
      castIds: selectedCast.map((c) => c.id),
      setId: currentSetId,
      notes: movieNotes,
      look: plan?.look ?? activePreset?.data.look ?? null,
    };
    const res = await fetch("/api/director/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activePreset && activePreset.name === name ? activePreset.id : undefined, name, data }),
    });
    const out = await res.json();
    if (!res.ok) return setError(out.error ?? "Couldn't save");
    setPresets((list) => [out.preset, ...list.filter((x) => x.id !== out.preset.id)]);
    setPresetId(out.preset.id);
    try {
      localStorage.setItem(MOVIE_KEY, out.preset.id);
    } catch {}
    setNotice(`Saved "${name}" - its cast, set, style, notes${data.look ? ", film look" : ""} load automatically next time.`);
  }
  // "Use this recipe" from the examples gallery fills the form (new version = new tap).
  useEffect(() => {
    if (!recipe || filmId) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setIdea(recipe.idea);
    setStyle(recipe.style);
    setAspect(recipe.aspect);
    setPlan(null);
    setNotice("Recipe loaded - change the words to your own, then press 🎬 Just make it (or plan it first).");
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.v]);
  const autoCreateRef = useRef(false);
  const autoApproveRef = useRef(false);
  const [saveCastName, setSaveCastName] = useState("");
  const [castSaved, setCastSaved] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const restartPolling = () => setPollKey((k) => k + 1);

  const perShot = directorShotPriceCents(engine);
  const total = plan ? perShot * plan.shots.length : perShot * (scriptShotCount(idea) || shotCount);
  const engineEntries = Object.entries(VIDEO_PAYGO_ENGINES) as [VideoEngine, (typeof VIDEO_PAYGO_ENGINES)[VideoEngine]][];

  // Back from Stripe: restore the storyboard and produce the film once the credit lands.
  async function resumeFromCheckout() {
    const p = new URLSearchParams(window.location.search);
    if (p.get("director") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    let approveId: string | null = null;
    try {
      approveId = sessionStorage.getItem(APPROVE_KEY);
      sessionStorage.removeItem(APPROVE_KEY);
    } catch {}
    if (approveId) {
      setFilmId(approveId);
      if (p.get("canceled") === "1") return setNotice("Checkout canceled - nothing was charged. Your storyboard is still here.");
      setNotice("Payment received - filming your storyboard…");
      // Stripe's webhook can land a moment after the redirect - retry briefly.
      for (let i = 0; i < 15; i++) {
        if (await approve(approveId, true)) return setNotice(null);
        await new Promise((r) => setTimeout(r, 2500));
      }
      return setNotice("Your payment is still being confirmed - press Approve & film it in a moment.");
    }
    let draft: { idea: string; plan: DirectorPlan; engine: VideoEngine; refs?: Parameters<typeof photosFromLinks>[0]; cast?: CastPick[]; auto?: boolean } | null = null;
    try {
      draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
    if (!draft) return;
    setIdea(draft.idea);
    setPlan(draft.plan);
    if (VIDEO_PAYGO_ENGINES[draft.engine]) setEngine(draft.engine);
    if (p.get("canceled") === "1") return setNotice("Checkout canceled - nothing was charged. Your storyboard is still here.");
    if (draft.refs) setPhotos(photosFromLinks(draft.refs));
    if (draft.cast?.length) setSelectedCast(draft.cast);
    setNotice("Payment received - starting your film…");
    autoApproveRef.current = !!draft.auto;
    autoCreateRef.current = true;
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resumeFromCheckout().catch(() => {});
  }, []);


  // Poll the film while it's being produced.
  useEffect(() => {
    if (!filmId) return;
    let stop = false;
    (async () => {
      let wait = 4000;
      while (!stop) {
        try {
          const res = await fetch(`/api/director/status?filmId=${filmId}`);
          const data = (await res.json()) as FilmStatus;
          if (!stop && data.shots) {
            setFilm((prev) => {
              // Server plan changes after a redraw - pick it up when frames finish.
              if (data.plan && prev?.status === "frames" && data.status === "review") setPlan(data.plan);
              return data;
            });
          }
          if (DONE_STATES.includes(data.status)) return;
          wait = data.status === "anchor" || data.status === "frames" ? 4000 : 10000;
        } catch {}
        // 2026-09-29: each poll moves the film along on the server, so poll
        // gently - every 10s while filming (shots take minutes) and every
        // 30s when the tab is hidden - to save server time.
        await new Promise((r) => setTimeout(r, typeof document !== "undefined" && document.hidden ? 30000 : wait));
      }
    })();
    return () => {
      stop = true;
    };
  }, [filmId, pollKey]);

  async function planIt(): Promise<DirectorPlan | null> {
    setPlanning(true);
    setError(null);
    setNotice(null);
    setFilm(null);
    setFilmId(null);
    try {
      const res = await fetch("/api/director/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: movieNotes.trim() ? `${movieNotes.trim()}\n\n${idea}` : idea,
          look: activePreset?.data.look ?? undefined,
          style,
          shotCount: scriptShotCount(idea) || shotCount,
          aspectRatio: aspect,
          hasCharacterPhoto: readyUrls(photos, "character").length > 0 || selectedCast.length > 0,
          cast: selectedCast.map((c) => ({ name: c.name, description: c.description })),
          hasProductPhoto: readyUrls(photos, "product").length > 0,
          hasLocationPhoto: readyUrls(photos, "location").length > 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't plan that");
      setPlan(data.plan);
      if (data.source === "rules") {
        setNotice("Lucy's full planner was busy, so this is a simple draft built straight from your script. Tap “Re-plan from scratch (free)” for the full plan with camera angles and timing.");
      }
      return data.plan as DirectorPlan;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't plan that");
      return null;
    } finally {
      setPlanning(false);
    }
  }

  /** "Just make it": plan, cast, storyboard, film and stitch with no stops - one tap. */
  async function makeItNow() {
    const planned = await planIt();
    if (planned) await makeFilm(false, { plan: planned, auto: true });
  }

  async function saveLucysCast() {
    const links = film?.characterPhotos ?? [];
    if (!links.length || !saveCastName.trim()) return;
    setBusy("saveCast");
    try {
      const form = new FormData();
      form.append("name", saveCastName.trim());
      form.append("description", plan?.character ?? "");
      form.append("photos", JSON.stringify(links));
      const res = await fetch("/api/director/characters", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      setCastSaved(true);
      setNotice(`${data.character.name} is in Your cast - use them in your next film.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  }

  async function revise(shotIndex: number | null) {
    if (!plan) return;
    const key = shotIndex == null ? "all" : String(shotIndex);
    const instruction = (reviseText[key] ?? "").trim();
    if (!instruction) return;
    setRevising(shotIndex ?? "all");
    setError(null);
    try {
      const res = await fetch("/api/director/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, instruction, shotIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't apply that");
      setPlan(data.plan);
      setReviseText((r) => ({ ...r, [key]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply that");
    } finally {
      setRevising(null);
    }
  }

  function editShot(i: number, patch: Partial<DirectorShot>) {
    setPlan((p) => (p ? { ...p, shots: p.shots.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : p));
  }
  function editPlan(patch: Partial<DirectorPlan>) {
    setPlan((p) => (p ? { ...p, ...patch } : p));
  }

  /** Returns true if the film started (or a checkout redirect began). */
  async function makeFilm(silentOnNoCredit = false, opts: { plan?: DirectorPlan; auto?: boolean } = {}): Promise<boolean> {
    const plan = opts.plan ?? planState;
    if (!plan) return false;
    const refLinks = { character: readyUrls(photos, "character"), product: readyUrls(photos, "product"), location: readyUrls(photos, "location") };
    setCreating(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("engine", engine);
      form.append("idea", idea);
      form.append("plan", JSON.stringify(plan));
      if (selectedCast.length) form.append("savedCharacterIds", JSON.stringify(selectedCast.map((c) => c.id)));
      if (plan.modelVoices === false && Object.keys(voiceSamples).length) form.append("voiceSamples", JSON.stringify(voiceSamples));
      form.append("refs", JSON.stringify(refLinks));
      if (opts.auto) form.append("autoApprove", "1");
      const res = await fetch("/api/director/create", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setNotice(null);
        setFilmId(data.filmId);
        setFilm({ status: "anchor", error: null, finalVideoUrl: null, anchorUrl: null, shots: plan.shots.map((_, idx) => ({ idx, status: "pending", keyframeUrl: null, videoUrl: null, error: null })) });
        return true;
      }
      if (data.needCredit) {
        if (silentOnNoCredit) return false;
        try {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ idea, plan, engine, refs: refLinks, cast: selectedCast, auto: !!opts.auto }));
        } catch {}
        const co = await fetch("/api/video-paygo/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packId: "exact", cents: data.totalCents ?? perShot * plan.shots.length, returnTo: "director" }),
        });
        const cd = await co.json();
        if (cd.url) {
          window.location.href = cd.url;
          return true;
        }
        throw new Error(cd.error ?? "Checkout failed");
      }
      throw new Error(data.error ?? "Couldn't start your film");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start your film");
      return false;
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!autoCreateRef.current || !plan) return;
    autoCreateRef.current = false;
    // Stripe's webhook can land a moment after the redirect - retry briefly.
    (async () => {
      for (let i = 0; i < 15; i++) {
        if (await makeFilm(true, { auto: autoApproveRef.current })) return;
        await new Promise((r) => setTimeout(r, 2500));
      }
      setNotice("Your payment is still being confirmed - press Make this film in a moment.");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const reviewing = film?.status === "review";
  const producing = !!filmId && !!film && !DONE_STATES.includes(film.status) && !reviewing;
  const redrawsLeft = (film?.maxRevisions ?? 5) - (film?.revisionsUsed ?? 0);

  async function filmAction(path: string, body: Record<string, unknown>, label: string): Promise<Record<string, unknown> | null> {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`/api/director/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filmId, ...body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That didn't work");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function redraw(i: number) {
    const instruction = (reviseText[`frame${i}`] ?? "").trim();
    if (!instruction) return;
    const data = await filmAction("redraw", { shotIdx: i, instruction }, `redraw${i}`);
    if (data) {
      setReviseText((r) => ({ ...r, [`frame${i}`]: "" }));
      setFilm((f) => (f ? { ...f, status: "frames", revisionsUsed: (f.revisionsUsed ?? 0) + 1, shots: f.shots.map((s) => (s.idx === i ? { ...s, keyframeUrl: null, status: "keyframe" } : s)) } : f));
      restartPolling();
    }
  }

  async function saveShot(i: number) {
    if (!plan) return;
    const data = await filmAction("edit-shot", { shotIdx: i, shot: plan.shots[i] }, `save${i}`);
    if (data?.plan) {
      setPlan(data.plan as DirectorPlan);
      setNotice(`Shot ${i + 1} saved.`);
    }
  }

  async function approve(id: string | null = filmId, fromCheckout = false): Promise<boolean> {
    if (!id) return false;
    setBusy("approve");
    setError(null);
    try {
      const res = await fetch("/api/director/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filmId: id }) });
      const data = await res.json();
      if (res.ok) {
        setFilm((f) => (f ? { ...f, status: "shots", dueOnApproveCents: 0 } : f));
        restartPolling();
        return true;
      }
      if (data.needCredit && !fromCheckout) {
        // Free storyboard, paid film: top up the exact amount, then come back and film.
        try {
          sessionStorage.setItem(APPROVE_KEY, id);
        } catch {}
        const co = await fetch("/api/video-paygo/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packId: "exact", cents: data.totalCents, returnTo: "director" }),
        });
        const cd = await co.json();
        if (cd.url) {
          window.location.href = cd.url;
          return false;
        }
      }
      if (!fromCheckout) setError(data.error ?? "That didn't work");
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const [lineAudio, setLineAudio] = useState<Record<number, string>>({});
  async function hearLine(i: number, who: CastPick) {
    if (!plan) return;
    const s = plan.shots[i];
    setBusy(`hear${i}`);
    setError(null);
    try {
      const res = await fetch("/api/director/act-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: who.voiceId, line: s.dialogue, speaker: who.name, character: who.description, context: `${plan.logline} ${s.action}`, seconds: s.durationSeconds }),
      });
      const data = await res.json();
      if (!res.ok || !data.job) throw new Error(data.error ?? "Couldn't make the line");
      for (let t = 0; t < 40; t++) {
        await new Promise((r) => setTimeout(r, 3000));
        const r = await (await fetch(`/api/director/act-line?job=${encodeURIComponent(data.job)}`)).json();
        if (r.status === "done" && r.url) return setLineAudio((m) => ({ ...m, [i]: String(r.url) }));
        if (r.status === "failed") throw new Error("The voice couldn't be made - try again");
      }
      throw new Error("The voice is taking a while - try again in a minute");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the line");
    } finally {
      setBusy(null);
    }
  }

  async function retake(i: number) {
    const data = await filmAction("retake", { shotIdx: i, note: reviseText[`take${i}`] ?? "" }, `take${i}`);
    if (data) {
      setReviseText((r) => ({ ...r, [`take${i}`]: "" }));
      setFilm((f) => (f ? { ...f, status: "shots", finalVideoUrl: null, shots: f.shots.map((s) => (s.idx === i ? { ...s, status: "keyframe", videoUrl: null, error: null } : s)) } : f));
      setNotice(`Retaking shot ${i + 1} - Lucy will re-join the film when it's done.`);
      restartPolling();
    }
  }

  async function cancelFilm() {
    const data = await filmAction("cancel", {}, "cancel");
    if (data) {
      setFilm((f) => (f ? { ...f, status: "cancelled" } : f));
      setNotice(String(data.message ?? "Cancelled."));
    }
  }
  const doneShots = film?.shots.filter((s) => s.videoUrl) ?? [];
  const stepLabel: Record<string, string> = { pending: "Queued", keyframe: "Drawing the frame", video: "Filming", completed: "Done", failed: "Refunded" };

  return (
    <section id="pay-as-you-go" className="shadow-soft-lg scroll-mt-6 rounded-[28px] border border-white/60 bg-purple-wash/90 p-5 backdrop-blur-xl sm:p-7">
      {header}
      {modeSwitch}
      <div className="mt-4 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">🎬 Directed by Lucy</h2>
        <p className="mx-auto mt-1 max-w-lg text-base text-foreground">Make a movie scene in 3 steps.</p>
        <p className="mt-1 text-xs text-muted">
          {formatUsd(perShot)} per shot · pay as you go · failed shots refunded
        </p>
        <p className="mt-2 text-xs">
          <Link href="/make-a-movie" className="font-semibold text-purple underline">Full guide</Link>
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <div>
          <p className="mb-1 flex items-center text-sm font-bold text-foreground">
            <StepBadge n={1} /> Your characters (and places)
          </p>
          <CharacterGuide />
        </div>
        <DirectorPhotos
          photos={photos}
          setPhotos={setPhotos}
          selectedCast={selectedCast}
          setSelectedCast={setSelectedCast}
          onNotice={setNotice}
          onError={setError}
          presetSetId={presetSetId}
          onSetChange={setCurrentSetId}
        />

        <div>
          <p className="mb-1 flex items-center text-sm font-bold text-foreground">
            <StepBadge n={2} /> What&apos;s your movie about? <ScriptHelp />
          </p>
          <textarea
            aria-label="Describe your film"
            className="w-full rounded-2xl border border-border bg-white p-4 text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
            rows={5}
            maxLength={4000}
            placeholder="Write a simple idea - who, what happens, where, and anything they say. Then ask Claude to turn it into a detailed shot-by-shot script (tap ? for the prompt) and paste it back here."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          {scriptShotCount(idea) > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-purple">
              ✓ Found {scriptShotCount(idea)} shots in your script - Lucy will plan exactly {scriptShotCount(idea)}.
              {(idea.match(/^\s*SHOT\s*\d+/gim) ?? []).length > MAX_SHOTS ? ` (Only the first ${MAX_SHOTS} fit in one scene - put the rest in a second scene.)` : ""}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted">
            ✨ Make it a proper script: tap <strong className="text-foreground">?</strong>, copy the prompt into{" "}
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="font-semibold text-purple underline">Claude</a>,{" "}
            <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-purple underline">ChatGPT</a> or{" "}
            <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-purple underline">Gemini</a> with your idea, and paste the script it writes back here. Lucy keeps every line word for word.
          </p>
          <CopyClip castNames={selectedCast.map((c) => c.name)} notes={idea.length < 600 ? idea : ""} onScript={(script) => setIdea(script)} />
        </div>

        <div>
          <p className="mb-1 flex items-center text-sm font-bold text-foreground">
            <StepBadge n={3} /> Directed by Lucy
          </p>
          <p className="text-[11px] text-muted">
            Lucy turns your script into a shot sheet - every camera angle and every line, scene by scene. Check it, change anything in plain words (or copy it to your AI and paste its edits back), then film.
          </p>
        </div>
        <details className="rounded-2xl border border-purple/30 bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-bold text-foreground">🎞 Your movie <span className="font-normal text-muted">(save your cast, set and look for every scene)</span></summary>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-foreground">🎞 Your movie</span>
            <select
              aria-label="Your movie"
              className={`${inputCls} w-auto min-w-40 flex-1`}
              value={presetId ?? ""}
              onChange={(e) => applyPreset(presets.find((p) => p.id === e.target.value) ?? null)}
            >
              <option value="">None - start fresh</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="button" onClick={saveMovie} className="rounded-xl bg-purple/10 px-3 py-1.5 text-xs font-bold text-purple">
              💾 {activePreset ? "Update" : "Save as my movie"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Saves your style, model, shape, cast, set, notes and film look - so every scene looks, sounds and feels like the same movie.
          </p>
          <details className="mt-1" open={!!movieNotes || undefined}>
            <summary className="cursor-pointer text-[11px] font-semibold text-purple">📝 Movie notes - added to every scene (look, life, set)</summary>
            <textarea
              aria-label="Movie notes"
              className={`${inputCls} mt-1`}
              rows={4}
              maxLength={1500}
              placeholder="LOOK: shot on 35mm film, grain, warm lamp light… LIFE: calm office, people working… SET: modern trading desks…"
              value={movieNotes}
              onChange={(e) => setMovieNotes(e.target.value)}
            />
          </details>
        </details>

        <details className="rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-bold text-foreground">⚙️ Settings <span className="font-normal text-muted">(model, style, shots, shape - optional)</span></summary>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-[11px] font-semibold text-muted">
              Style
              <select className={inputCls} value={style} onChange={(e) => setStyle(e.target.value as ProductionStyleId | "auto")}>
                <option value="auto">Auto - Lucy decides</option>
                {ALL_STYLE_IDS.map((id) => (
                  <option key={id} value={id}>{PRODUCTION_STYLES[id].label}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-muted">
              Shots
              <select className={inputCls} value={shotCount} onChange={(e) => setShotCount(Number(e.target.value))}>
                {Array.from({ length: MAX_SHOTS - MIN_SHOTS + 1 }, (_, i) => MIN_SHOTS + i).map((n) => (
                  <option key={n} value={n}>{n} shots</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-muted">
              Model
              <select className={inputCls} value={engine} onChange={(e) => setEngine(e.target.value as VideoEngine)}>
                {engineEntries.map(([id, e]) => (
                  <option key={id} value={id}>{e.versionLabel} - {formatUsd(directorShotPriceCents(id))}/shot</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-muted">
              Shape
              <select className={inputCls} value={aspect} onChange={(e) => setAspect(e.target.value as "auto" | "16:9" | "9:16")}>
                <option value="auto">Auto</option>
                <option value="16:9">16:9 landscape</option>
                <option value="9:16">9:16 vertical</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            One model films every shot so the light and look match. {formatUsd(DIRECTOR_FEE_CENTS)} of each shot&apos;s price is Lucy&apos;s direction (planning, the consistency stills and the final stitch).
          </p>
        </details>

        {!filmId && !plan && idea.trim().length >= 3 && (
          <div className="rounded-2xl bg-white/70 p-3 text-xs text-muted">
            <p className="font-bold text-foreground">✅ Ready to plan</p>
            <p className="mt-1">
              🎬 {scriptShotCount(idea) || shotCount} shots · 🎭 {selectedCast.length ? selectedCast.map((c) => c.name).join(", ") : "Lucy casts it"} · 📍{" "}
              {photos.location.length ? "your place" : "Lucy picks the place"} · 🎥 {VIDEO_PAYGO_ENGINES[engine].label} · {aspect === "auto" ? "shape: auto" : aspect}
            </p>
            <p className="mt-1">Planning is free. Nothing is filmed until you approve the storyboard.</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => planIt()}
          disabled={planning || idea.trim().length < 3}
          className="w-full rounded-2xl bg-purple py-4 text-base font-extrabold text-white shadow-soft disabled:opacity-50"
        >
          {planning ? "Lucy is writing your shot sheet…" : plan ? "🎬 Re-direct from scratch (free)" : "🎬 Directed by Lucy - make my shot sheet (free)"}
        </button>
        {!filmId && !plan && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={makeItNow}
              disabled={planning || creating || idea.trim().length < 3 || isUploading(photos)}
              className="w-full rounded-2xl border-2 border-purple bg-white py-3 text-sm font-bold text-purple shadow-soft disabled:opacity-50"
            >
              {creating ? "Lucy is on it…" : `Skip the checks - just make it (${formatUsd(perShot * (scriptShotCount(idea) || shotCount))})`}
            </button>
            <p className="text-center text-[11px] text-muted">Lucy plans, draws and films it with no stops. About 5-10 minutes.</p>
          </div>
        )}

        {error && <p className="rounded-2xl bg-white/70 p-3 text-sm text-coral-dark">{error}</p>}
        {notice && <p className="rounded-2xl bg-white/80 p-3 text-sm text-foreground">{notice}</p>}

        {plan && (
          <div className="flex flex-col gap-3 rounded-2xl bg-white/80 p-4">
            <div>
              <input className="w-full bg-transparent text-lg font-extrabold text-foreground focus:outline-none" value={plan.title} onChange={(e) => editPlan({ title: e.target.value })} aria-label="Film title" />
              <p className="text-xs text-muted">{plan.logline}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase">
                <span className="rounded-full bg-purple/10 px-2 py-0.5 text-purple">{GOAL_LABEL[plan.goal] ?? plan.goal}</span>
                <span className="rounded-full bg-purple/10 px-2 py-0.5 text-purple">{PRODUCTION_STYLES[plan.style].label}</span>
                <span className="rounded-full bg-purple/10 px-2 py-0.5 text-purple">{plan.emotion}</span>
                <span className="rounded-full bg-purple/10 px-2 py-0.5 text-purple">{plan.aspectRatio}</span>
              </div>
            </div>

            <details className="rounded-xl border border-border p-2">
              <summary className="cursor-pointer text-xs font-semibold text-foreground">The look &amp; cast (locked for every shot so it feels like one film)</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["timeOfDay", "keyLight", "palette", "grade"] as const).map((k) => (
                  <label key={k} className="text-[11px] font-semibold text-muted">
                    {k === "timeOfDay" ? "Time of day" : k === "keyLight" ? "Key light" : k === "palette" ? "Palette" : "Film look / grade"}
                    <input className={inputCls} value={plan.look[k]} onChange={(e) => editPlan({ look: { ...plan.look, [k]: e.target.value } })} />
                  </label>
                ))}
                <label className="text-[11px] font-semibold text-muted">
                  🎥 Camera (the whole film)
                  <select
                    className={inputCls}
                    value={plan.look.format ?? (plan.style === "ugc" ? "phone" : "film35")}
                    onChange={(e) => editPlan({ look: { ...plan.look, format: e.target.value as CameraFormatId } })}
                  >
                    {ALL_CAMERA_FORMATS.map((id) => (
                      <option key={id} value={id}>{CAMERA_FORMATS[id].label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-2 text-[11px] font-semibold text-muted sm:col-span-2">
                  <input type="checkbox" className="mt-0.5" checked={plan.coverage ?? coverageByDefault(plan)} onChange={(e) => editPlan({ coverage: e.target.checked })} />
                  <span>
                    🎬 Film it like a real crew - a few camera setups (a wide, and over-the-shoulder close-ups on each person) drawn once and reused, so every cut is the same room, the same moment and the same faces. Best for conversations.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[11px] font-semibold text-muted sm:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={plan.chain ?? (plan.style === "ugc" || plan.look.format === "phone")}
                    onChange={(e) => editPlan({ chain: e.target.checked })}
                  />
                  <span>
                    🔗 One continuous take - every shot starts on the last frame of the shot before, so it plays like one unbroken handheld clip (how selfie vlogs stay seamless). Shots film one after another, so it takes a little longer.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[11px] font-semibold text-muted sm:col-span-2">
                  <input type="checkbox" className="mt-0.5" checked={plan.modelVoices !== false} onChange={(e) => editPlan({ modelVoices: e.target.checked })} />
                  <span>
                    🗣 Keep the video model&apos;s own voices (recommended - most natural; describe each voice in the cast, e.g. &quot;deep, calm, husky, British&quot;). Off = lock each person to a real recording of their voice that you upload below.
                  </span>
                </label>
                {plan.modelVoices === false && (
                  <VoiceSamplePicker
                    cast={selectedCast}
                    samples={voiceSamples}
                    setSamples={setVoiceSamples}
                    consent={voiceConsent}
                    setConsent={setVoiceConsent}
                  />
                )}
                {engine === "veo31" && !(plan.coverage ?? coverageByDefault(plan)) && (
                  <label className="flex items-start gap-2 text-[11px] font-semibold text-muted sm:col-span-2">
                    <input type="checkbox" className="mt-0.5" checked={!!plan.fromPhotos} onChange={(e) => editPlan({ fromPhotos: e.target.checked || undefined })} />
                    <span>
                      🧩 Film straight from my cast &amp; set photos (no drawn first frame) - Veo builds each shot from the real photos, which often looks more natural. The storyboard is still drawn so you can check the plan.
                    </span>
                  </label>
                )}
                {(["character", "wardrobe", "location", "product"] as const).map((k) => (
                  <label key={k} className="text-[11px] font-semibold capitalize text-muted">
                    {k}
                    <input className={inputCls} value={plan[k]} placeholder={k === "product" ? "none" : ""} onChange={(e) => editPlan({ [k]: e.target.value } as Partial<DirectorPlan>)} />
                  </label>
                ))}
              </div>
            </details>

            <ol className="flex flex-col gap-3">
              {plan.shots.map((s, i) => {
                const st = film?.shots[i];
                return (
                  <li key={i} className="rounded-xl border border-border bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-extrabold text-foreground">
                        Shot {i + 1} · <span className="font-semibold text-purple">{s.beat}</span>
                      </p>
                      {st && <span className="text-[10px] font-bold uppercase text-muted">{stepLabel[st.status] ?? st.status}</span>}
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-muted">🎥 Camera</p>
                    <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="text-[10px] font-semibold text-muted">
                        📷 Framing
                        <select className={inputCls} value={s.size} onChange={(e) => editShot(i, { size: e.target.value as DirectorShot["size"] })}>
                          {ALL_SIZE_IDS.map((id) => <option key={id} value={id}>{SHOT_SIZES[id].label}</option>)}
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-muted">
                        📐 Angle
                        <select className={inputCls} value={s.angle} onChange={(e) => editShot(i, { angle: e.target.value as DirectorShot["angle"] })}>
                          {ALL_ANGLE_IDS.map((id) => <option key={id} value={id}>{id.replace(/_/g, " ")}</option>)}
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-muted">
                        🎥 Camera move
                        <select className={inputCls} value={s.move} onChange={(e) => editShot(i, { move: e.target.value as DirectorShot["move"] })} title={CAMERA_MOVES[s.move].useFor}>
                          {ALL_MOVE_IDS.map((id) => <option key={id} value={id}>{CAMERA_MOVES[id].label}</option>)}
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-muted">
                        ⏱ Length
                        <select className={inputCls} value={s.durationSeconds} onChange={(e) => editShot(i, { durationSeconds: Number(e.target.value) })}>
                          {[3, 4, 5, 6, 7, 8, 10].map((n) => <option key={n} value={n}>{n}s</option>)}
                        </select>
                      </label>
                    </div>
                    <p className="mt-1 text-[10px] text-muted">{ANGLES[s.angle]} · {CAMERA_MOVES[s.move].useFor}</p>
                    <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-muted">
                      🎬 What happens <span className="font-normal normal-case">(action only - no spoken words here)</span>
                      <textarea className={`${inputCls} mt-1 font-normal normal-case`} rows={2} value={s.action} onChange={(e) => editShot(i, { action: e.target.value })} />
                    </label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        💬 Who speaks
                        <input className={`${inputCls} mt-1 font-normal normal-case`} value={s.speaker} placeholder="Nobody" onChange={(e) => editShot(i, { speaker: e.target.value })} />
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        💬 Says <span className="font-normal normal-case">(exact words · add (off screen) if we don&apos;t see them)</span>
                        {i > 0 && lineContinues(plan, i) && <span className="ml-1 rounded bg-purple/10 px-1 font-semibold normal-case text-purple">↪ continues from shot {i}</span>}
                        {s.dialogue.replace(/\([^)]*\)/g, " ").split(/\s+/).filter(Boolean).length > MAX_WORDS_PER_SHOT && (
                          <span className="ml-1 rounded bg-coral/10 px-1 font-semibold normal-case text-coral-dark">⚠ long for one 8-second shot - split it across two shots</span>
                        )}
                        <input className={`${inputCls} mt-1 font-normal normal-case`} value={s.dialogue} placeholder="No dialogue in this shot" onChange={(e) => editShot(i, { dialogue: e.target.value })} />
                        {(() => {
                          const who = selectedCast.find((c) => c.voiceId && s.speaker && c.name.split(" ")[0].toLowerCase() === s.speaker.split(" ")[0].toLowerCase());
                          if (!who || !s.dialogue.trim()) return null;
                          return (
                            <span className="mt-1 flex items-center gap-2 normal-case">
                              <button type="button" disabled={busy === `hear${i}`} onClick={() => hearLine(i, who)} className="rounded-lg bg-purple/10 px-2 py-1 text-[11px] font-bold text-purple disabled:opacity-50">
                                {busy === `hear${i}` ? "Acting it out…" : `🔊 Hear ${who.name} say it`}
                              </button>
                              {lineAudio[i] && <audio src={lineAudio[i]} controls className="h-7" />}
                            </span>
                          );
                        })()}
                      </label>
                    </div>
                    <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-muted">
                      📍 Where
                      <input className={`${inputCls} mt-1 font-normal normal-case`} value={s.setting} placeholder="Blank = the main location" onChange={(e) => editShot(i, { setting: e.target.value })} />
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        className={inputCls}
                        placeholder='Change this shot: "closer and more tense", "she laughs here"…'
                        value={reviseText[String(i)] ?? ""}
                        onChange={(e) => setReviseText((r) => ({ ...r, [String(i)]: e.target.value }))}
                      />
                      <button type="button" disabled={revising !== null} onClick={() => revise(i)} className="shrink-0 rounded-xl bg-purple/10 px-3 text-xs font-bold text-purple disabled:opacity-50">
                        {revising === i ? "…" : "Apply"}
                      </button>
                    </div>
                    {reviewing && (
                      <div className="mt-2 flex flex-col gap-2 rounded-lg bg-purple/5 p-2">
                        <div className="flex gap-2">
                          <input
                            className={inputCls}
                            placeholder={redrawsLeft > 0 ? 'Redraw this frame: "make her smile", "lower angle", "move to the rooftop"…' : "No redraws left - edit the text above and save"}
                            disabled={redrawsLeft <= 0}
                            value={reviseText[`frame${i}`] ?? ""}
                            onChange={(e) => setReviseText((r) => ({ ...r, [`frame${i}`]: e.target.value }))}
                          />
                          <button type="button" disabled={!!busy || redrawsLeft <= 0} onClick={() => redraw(i)} className="shrink-0 rounded-xl bg-purple px-3 text-xs font-bold text-white disabled:opacity-50">
                            {busy === `redraw${i}` ? "…" : `Redraw (${redrawsLeft} left)`}
                          </button>
                        </div>
                        <button type="button" disabled={!!busy} onClick={() => saveShot(i)} className="self-start text-[11px] font-semibold text-purple underline">
                          {busy === `save${i}` ? "Saving…" : "Save my text changes to this shot"}
                        </button>
                      </div>
                    )}
                    {st?.videoUrl && <video src={st.videoUrl} controls playsInline className="mt-2 w-full rounded-lg" />}
                    {film && (film.status === "completed" || film.status === "failed") && (
                      <div className="mt-2 flex gap-2">
                        <input
                          className={inputCls}
                          placeholder='Retake note (optional): "nobody behind him", "she smiles more"…'
                          value={reviseText[`take${i}`] ?? ""}
                          onChange={(e) => setReviseText((r) => ({ ...r, [`take${i}`]: e.target.value }))}
                        />
                        <button type="button" disabled={!!busy} onClick={() => retake(i)} className="shrink-0 rounded-xl bg-purple/10 px-3 text-xs font-bold text-purple disabled:opacity-50">
                          {busy === `take${i}` ? "…" : `🎲 Retake - ${formatUsd(perShot)}`}
                        </button>
                      </div>
                    )}
                    {!st?.videoUrl && st?.keyframeUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={st.keyframeUrl} alt={`Shot ${i + 1} frame`} className="mt-2 w-full rounded-lg" />
                    )}
                    {st?.error && <p className="mt-1 text-[11px] text-coral-dark">{st.error}</p>}
                  </li>
                );
              })}
            </ol>

            <div className="rounded-xl bg-purple/5 p-2 text-[11px] text-muted">
              <p>
                🤝 <strong className="text-foreground">Work on it with your AI:</strong> copy the shot sheet into Claude or ChatGPT, ask it to improve the camera work or the lines, then paste its whole reply in the box below and tap Apply.
              </p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(sheetForAI(plan)).then(() => setNotice("Shot sheet copied - paste it into Claude or ChatGPT."))}
                className="mt-1 rounded-lg bg-purple px-2 py-1 text-[11px] font-bold text-white"
              >
                📋 Copy the shot sheet for my AI
              </button>
            </div>
            <div className="flex gap-2">
              <textarea
                className={inputCls}
                rows={2}
                placeholder='Change the whole film ("set it at night", "more tension") - or paste your AI&apos;s edited shot sheet here…'
                value={reviseText.all ?? ""}
                onChange={(e) => setReviseText((r) => ({ ...r, all: e.target.value }))}
              />
              <button type="button" disabled={revising !== null} onClick={() => revise(null)} className="shrink-0 rounded-xl bg-purple/10 px-3 text-xs font-bold text-purple disabled:opacity-50">
                {revising === "all" ? "…" : "Apply"}
              </button>
            </div>

            <button type="button" onClick={() => setShowPrompts((v) => !v)} className="self-start text-[11px] font-semibold text-purple underline">
              {showPrompts ? "Hide" : "Show"} what Lucy sends to the model
            </button>
            {showPrompts && <PromptPreview plan={plan} engine={engine} photos={photos} castCount={selectedCast.length} />}

            <div className="rounded-xl bg-purple/5 p-3 text-sm">
              <p>
                <strong>{plan.shots.length} shots</strong> × {formatUsd(perShot)} on {VIDEO_PAYGO_ENGINES[engine].label} ={" "}
                <strong className="text-lg">{formatUsd(total)}</strong>
              </p>
              <p className="text-[11px] text-muted">Includes planning, a drawn storyboard you can change (5 redraws), filming and the final stitched film. Failed shots are refunded automatically.</p>
            </div>
            {!filmId && <button
              type="button"
              onClick={() => makeFilm(false)}
              disabled={creating || !!producing || isUploading(photos)}
              className="w-full rounded-2xl bg-purple py-4 text-base font-bold text-white shadow-soft disabled:opacity-50"
            >
              {creating ? "Starting…" : isUploading(photos) ? "Adding your photos…" : "Draw my storyboard - free →"}
            </button>}
            {!filmId && (
              <p className="-mt-1 text-center text-[11px] text-muted">
                The storyboard is free (3 a day, then {formatUsd(100)} each, taken off the film). You only pay {formatUsd(total)} when you approve filming -
                no subscription, no account needed.
              </p>
            )}
          </div>
        )}

        {film && (
          <div className="rounded-2xl bg-white/80 p-4">
            {reviewing && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-foreground">Your storyboard is ready - check every frame above.</p>
                <p className="text-xs text-muted">
                  Redraw any frame in plain words ({redrawsLeft} of {film.maxRevisions ?? 5} redraws left) or edit a shot&apos;s text. Nothing is filmed until you approve.
                </p>
                <button type="button" disabled={!!busy} onClick={() => approve()} className="w-full rounded-2xl bg-purple py-3 text-sm font-bold text-white shadow-soft disabled:opacity-50">
                  {busy === "approve" ? "Starting…" : `Approve & film it${film.dueOnApproveCents ? ` - ${formatUsd(film.dueOnApproveCents)}` : ""} 🎬`}
                </button>
                <button type="button" disabled={!!busy} onClick={cancelFilm} className="text-[11px] font-semibold text-muted underline">
                  {film.refundIfCancelledCents ? `Cancel and put ${formatUsd(film.refundIfCancelledCents)} back in my credit` : "Cancel - nothing is charged"}
                </button>
              </div>
            )}
            {film.status === "cancelled" && <p className="text-sm text-foreground">Cancelled - your credit has been refunded.</p>}
            {producing && (
              <p className="text-sm text-foreground">
                {film.status === "anchor" && film.casting ? "Making your character sheet (every angle of your person)…" : film.status === "anchor" ? "Setting up your cast, location and light…" : film.status === "frames" ? "Drawing your storyboard frames…" : film.status === "voicing" ? "Matching each person's voice across every shot…" : film.status === "stitching" ? "Joining your shots into one film…" : `Filming - ${doneShots.length} of ${film.shots.length} shots done…`}{" "}
                <span className="text-muted">({film.autoApprove ? "about 5-10 minutes - you can leave this tab open and come back" : "usually 2-5 minutes"})</span>
              </p>
            )}
            {film.status === "completed" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-foreground">Your film is ready 🎬</p>
                {film.finalVideoUrl && <video src={film.finalVideoUrl} controls playsInline className="w-full rounded-xl" />}
                {film.error && <p className="text-xs text-muted">{film.error}</p>}
                {selectedCast.length === 0 && !castSaved && (film.characterPhotos?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/70 p-2">
                    <span className="text-[11px] font-semibold text-muted">Love this character? Save them ({film.characterPhotos?.length} photos) for your next film:</span>
                    <input className={`${inputCls} w-32`} placeholder="Name" value={saveCastName} onChange={(e) => setSaveCastName(e.target.value)} />
                    <button type="button" disabled={!saveCastName.trim() || busy === "saveCast"} onClick={saveLucysCast} className="rounded-xl bg-purple/10 px-3 py-1.5 text-xs font-bold text-purple disabled:opacity-50">
                      {busy === "saveCast" ? "Saving…" : "Save to Your cast"}
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  {film.finalVideoUrl && <a href={film.finalVideoUrl} download className="rounded-full bg-purple px-3 py-1.5 font-bold text-white">Download film</a>}
                  {doneShots.length > 0 && (
                    <a href={`/stitch?videos=${doneShots.map((s) => encodeURIComponent(s.videoUrl as string)).join(",")}`} className="rounded-full border border-purple px-3 py-1.5 font-bold text-purple">
                      Edit / add music in the free editor
                    </a>
                  )}
                </div>
              </div>
            )}
            {film.status === "failed" && <p className="text-sm text-coral-dark">{film.error ?? "Your film couldn't be made - you've been refunded."}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Opt-in voice lock (2026-09-30): one real recording per cast member, with
 * consent. Nobody without a recording is re-voiced - their shots keep the
 * video model's own voice.
 */
function VoiceSamplePicker({
  cast,
  samples,
  setSamples,
  consent,
  setConsent,
}: {
  cast: CastPick[];
  samples: Record<string, string>;
  setSamples: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function upload(c: CastPick, file: File) {
    setErr(null);
    setBusyId(c.id);
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("speaker", c.name);
      form.append("consent", VOICE_SAMPLE_CONSENT);
      const res = await fetch("/api/director/voice-sample", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || typeof data.url !== "string") throw new Error(data.error || "Upload failed");
      setSamples((prev) => ({ ...prev, [c.id]: data.url }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyId(null);
    }
  }
  if (!cast.length) {
    return <p className="text-[11px] text-muted sm:col-span-2">Add people from Your cast first - the voice lock needs a named person and a recording of their voice.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-cream p-3 text-[11px] text-muted sm:col-span-2">
      <p>
        Upload 30-120 seconds of each person talking naturally (a quiet room, expressive, not read in a flat voice). Only people with a recording are re-voiced; everyone else keeps the model&apos;s voice.
      </p>
      <label className="flex items-start gap-2 font-semibold">
        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{VOICE_SAMPLE_CONSENT}</span>
      </label>
      {cast.map((c) => (
        <label key={c.id} className="flex flex-wrap items-center gap-2 font-semibold">
          <span className="min-w-24">{c.name}</span>
          <input
            type="file"
            accept="audio/*"
            disabled={!consent || busyId === c.id}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(c, f);
            }}
          />
          {busyId === c.id ? <span>Uploading…</span> : samples[c.id] ? <span>✓ recording added</span> : null}
        </label>
      ))}
      {err && <p className="text-coral-dark">{err}</p>}
    </div>
  );
}

function PromptPreview({ plan, engine, photos, castCount }: { plan: DirectorPlan; engine: VideoEngine; photos: RefPhotos; castCount: number }) {
  const [prompts, setPrompts] = useState<string[]>([]);
  useEffect(() => {
    import("@/lib/director/compile").then(({ compileShotPrompt }) => {
      const refs = { character: photos.character.length > 0 || castCount > 0, product: photos.product.length > 0, location: photos.location.length > 0 };
      setPrompts(plan.shots.map((_, i) => compileShotPrompt(plan, i, refs, { nativeAudio: VIDEO_PAYGO_ENGINES[engine].supportsNativeAudio })));
    });
  }, [plan, engine, photos, castCount]);
  return (
    <ol className="flex flex-col gap-2 rounded-xl bg-cream p-3 text-[11px] leading-relaxed text-muted">
      {prompts.map((p, i) => (
        <li key={i}>
          <strong className="text-foreground">Shot {i + 1}:</strong> {p}
        </li>
      ))}
    </ol>
  );
}
