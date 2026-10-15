"use client";

// Lucy Studio (2026-10-16): the Higgsfield-style way into Directed by Lucy.
// One prompt bar: add Elements (your people, places, products) and @mention
// them, pick a genre / camera / shape / model chip, press Generate. Lucy plans
// a free storyboard first (like Higgsfield's Supercomputer, the plan and the
// price come before any spend), you can change it in plain English, then
// "Film it". Built on the same /api/director/* pipeline as DirectorStudio.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CAMERA_MOVES, type CameraMoveId, type ProductionStyleId } from "@/lib/director/filmScience";
import { MAX_SHOTS, MIN_SHOTS, DEFAULT_SHOTS, type DirectorPlan } from "@/lib/director/plan";
import { REF_LIMITS } from "@/lib/director/refs";
import { VIDEO_PAYGO_ENGINES, directorShotPriceCents, formatUsd, type VideoEngine } from "@/lib/videoEngines";
import { uploadOne } from "./DirectorPhotos";
import { RECIPES } from "./DirectorRecipes";
import { LogoMark } from "./LogoMark";

type Kind = "character" | "location" | "product";
type Photo = { url: string | null; preview: string; status: "uploading" | "ready" | "error" };
type Element = { key: string; kind: Kind; name: string; description: string; savedId?: string; photos: Photo[] };
type Saved = { id: string; name: string; description: string; photoUrl: string; photoUrls?: string[] };
type Shot = { idx: number; status: string; keyframeUrl: string | null; videoUrl: string | null; error: string | null };
type Film = { status: string; error: string | null; finalVideoUrl: string | null; shots: Shot[]; autoApprove?: boolean; totalCents?: number; dueOnApproveCents?: number; plan?: DirectorPlan };
type Creation = { id: string; title: string; status: string; aspect: "16:9" | "9:16"; videoUrl: string | null; posterUrl: string | null };
type CreatePayload = { engine: VideoEngine; idea: string; plan: DirectorPlan; savedCharacterIds: string[]; people: Array<{ name: string; description: string; photos: string[] }>; refs: Record<Kind, string[]>; autoApprove: boolean };

const PENDING_KEY = "lucy_studio_pending";
const MAX_CHARACTERS = 3;
const DONE = ["completed", "failed", "cancelled"];
const KIND_LABEL: Record<Kind, string> = { character: "Person", location: "Place", product: "Product" };
const KIND_ICON: Record<Kind, string> = { character: "🧑", location: "📍", product: "📦" };

const GENRES: Array<{ id: ProductionStyleId | "auto"; label: string; aspect?: "16:9" | "9:16" }> = [
  { id: "auto", label: "✨ Lucy decides" },
  { id: "cinematic", label: "🎬 Cinematic", aspect: "16:9" },
  { id: "commercial", label: "🛍️ Ad", aspect: "16:9" },
  { id: "ugc", label: "📱 UGC / vlog", aspect: "9:16" },
  { id: "documentary", label: "🎥 Documentary", aspect: "16:9" },
];
const CAMERAS: Array<CameraMoveId | "auto"> = ["auto", "handheld_follow", "handheld_selfie", "slow_push_in", "tracking_follow", "orbit", "crane_up", "dolly_out_reveal", "locked_off"];
const STAGE: Record<string, string> = {
  anchor: "Casting your people",
  frames: "Drawing the storyboard frames",
  review: "Your frames are ready",
  shots: "Filming the shots",
  voicing: "Recording the voices",
  stitching: "Editing it together",
  completed: "Done",
  failed: "Something went wrong",
  cancelled: "Cancelled",
};

const newKey = () => Math.random().toString(36).slice(2, 10);
const readyPhotos = (e: Element) => e.photos.filter((p) => p.status === "ready" && p.url).map((p) => p.url as string);
const chip = "rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10";
const selectCls = `${chip} appearance-none cursor-pointer pr-6 [background-image:none]`;

export function LucyStudio() {
  const [elements, setElements] = useState<Element[]>([]);
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState<ProductionStyleId | "auto">("auto");
  const [camera, setCamera] = useState<CameraMoveId | "auto">("auto");
  const [aspect, setAspect] = useState<"auto" | "16:9" | "9:16">("auto");
  const [shots, setShots] = useState(DEFAULT_SHOTS);
  const [engine, setEngine] = useState<VideoEngine>("veo");
  const [oneTake, setOneTake] = useState(false);
  const [reviewFrames, setReviewFrames] = useState(true);

  const [plan, setPlan] = useState<DirectorPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [change, setChange] = useState("");
  const [revising, setRevising] = useState(false);
  const [starting, setStarting] = useState(false);
  const [filmId, setFilmId] = useState<string | null>(null);
  const [film, setFilm] = useState<Film | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [saved, setSaved] = useState<Record<"character" | "location", Saved[]>>({ character: [], location: [] });
  const [picker, setPicker] = useState<Kind | null>(null);
  const [mention, setMention] = useState<string | null>(null);
  const [creations, setCreations] = useState<Creation[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const perShot = directorShotPriceCents(engine);
  const shotTotal = plan ? plan.shots.length : shots;
  const price = perShot * shotTotal;
  const characters = elements.filter((e) => e.kind === "character");
  const uploading = elements.some((e) => e.photos.some((p) => p.status === "uploading"));
  const engineEntries = Object.entries(VIDEO_PAYGO_ENGINES) as [VideoEngine, (typeof VIDEO_PAYGO_ENGINES)[VideoEngine]][];

  function loadCreations() {
    fetch("/api/director/films")
      .then((r) => r.json())
      .then((d) => setCreations(Array.isArray(d.films) ? d.films : []))
      .catch(() => {});
  }

  // Poll the film while Lucy makes it (each poll also moves it along on the server).
  useEffect(() => {
    if (!filmId) return;
    let stop = false;
    (async () => {
      while (!stop) {
        try {
          const data = (await (await fetch(`/api/director/status?filmId=${filmId}`)).json()) as Film;
          if (stop) return;
          if (data.shots) setFilm(data);
          if (DONE.includes(data.status) || data.status === "review") {
            if (DONE.includes(data.status)) loadCreations();
            return;
          }
          await new Promise((r) => setTimeout(r, data.status === "anchor" || data.status === "frames" ? 4000 : document.hidden ? 30000 : 10000));
        } catch {
          await new Promise((r) => setTimeout(r, 8000));
        }
      }
    })();
    return () => {
      stop = true;
    };
  }, [filmId, pollKey]);

  // ---------- Elements ----------
  function addFiles(kind: Kind, files: FileList | null, name = "") {
    if (!files?.length) return;
    if (kind === "character" && characters.length >= MAX_CHARACTERS) return setError(`Up to ${MAX_CHARACTERS} people per scene.`);
    const list = Array.from(files).slice(0, REF_LIMITS[kind]);
    const key = newKey();
    const label = name || (kind === "character" ? `Person ${characters.length + 1}` : kind === "location" ? "The place" : "The product");
    const photos: Photo[] = list.map((f) => ({ url: null, preview: URL.createObjectURL(f), status: "uploading" }));
    setElements((all) => [...all.filter((e) => kind === "character" || e.kind !== kind), { key, kind, name: label, description: "", photos }]);
    list.forEach((file, i) => {
      uploadOne(file)
        .then((url) => patchPhoto(key, i, { url, status: "ready" }))
        .catch((err) => {
          patchPhoto(key, i, { status: "error" });
          setError(err instanceof Error ? err.message : "Couldn't add that photo");
        });
    });
    setPicker(null);
    if (kind === "character" && !name) setNotice(`Tap “@${label}” above the prompt to give them a real name.`);
  }
  function patchPhoto(key: string, i: number, change: Partial<Photo>) {
    setElements((all) => all.map((e) => (e.key === key ? { ...e, photos: e.photos.map((p, j) => (j === i ? { ...p, ...change } : p)) } : e)));
  }
  function addSaved(kind: "character" | "location", s: Saved) {
    if (elements.some((e) => e.savedId === s.id)) return setPicker(null);
    if (kind === "character" && characters.length >= MAX_CHARACTERS) return setError(`Up to ${MAX_CHARACTERS} people per scene.`);
    const urls = (s.photoUrls?.length ? s.photoUrls : [s.photoUrl]).filter(Boolean).slice(0, REF_LIMITS[kind]);
    const el: Element = { key: newKey(), kind, name: s.name, description: s.description, savedId: s.id, photos: urls.map((u) => ({ url: u, preview: u, status: "ready" })) };
    setElements((all) => [...all.filter((e) => kind === "character" || e.kind !== kind), el]);
    setPicker(null);
    return el;
  }
  function addTextPerson(name: string) {
    if (!name.trim() || characters.length >= MAX_CHARACTERS) return;
    setElements((all) => [...all, { key: newKey(), kind: "character", name: name.trim(), description: "", photos: [] }]);
  }
  function renameElement(key: string) {
    const el = elements.find((e) => e.key === key);
    if (!el) return;
    const name = window.prompt(`Name this ${KIND_LABEL[el.kind].toLowerCase()}`, el.name)?.trim();
    if (!name) return;
    const description = el.kind === "character" ? window.prompt(`A few words about ${name} (optional) - e.g. "late 20s, calm, dry humour"`, el.description)?.trim() ?? el.description : el.description;
    setElements((all) => all.map((e) => (e.key === key ? { ...e, name, description } : e)));
    if (el.name && prompt.includes(`@${el.name}`)) setPrompt((p) => p.split(`@${el.name}`).join(`@${name}`));
    setNotice(null);
  }

  // @mentions: typing "@" opens the people list; picking one inserts "@Name ".
  const mentionable = useMemo(() => [...characters.map((c) => c.name), ...elements.filter((e) => e.kind !== "character").map((e) => e.name)], [characters, elements]);
  function onPromptChange(v: string) {
    setPrompt(v);
    const m = /(^|\s)@([\w-]*)$/.exec(v);
    setMention(m ? m[2].toLowerCase() : null);
  }
  function insertMention(name: string) {
    setPrompt((p) => p.replace(/@([\w-]*)$/, `@${name} `));
    setMention(null);
    promptRef.current?.focus();
  }

  // ---------- Plan / film ----------
  function ideaText(): string {
    const place = elements.find((e) => e.kind === "location");
    const camLine = camera !== "auto" ? `Camera: ${CAMERA_MOVES[camera].instruction}.` : "";
    const takeLine = oneTake ? "Film it as one continuous handheld take, each shot flowing straight on from the last." : "";
    return [prompt.replace(/@([\w-]+)/g, "$1").trim(), place && !/^the place$/i.test(place.name) ? `Where: ${place.name}` : "", camLine, takeLine].filter(Boolean).join("\n\n");
  }

  async function generate() {
    if (prompt.trim().length < 3) {
      promptRef.current?.focus();
      return setError("Describe your scene in a few words.");
    }
    setPlanning(true);
    setError(null);
    setNotice(null);
    setPlan(null);
    setFilm(null);
    setFilmId(null);
    try {
      const res = await fetch("/api/director/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: ideaText(),
          style: genre,
          shotCount: shots,
          aspectRatio: aspect,
          hasCharacterPhoto: characters.some((c) => readyPhotos(c).length > 0),
          hasProductPhoto: elements.some((e) => e.kind === "product" && readyPhotos(e).length > 0),
          hasLocationPhoto: elements.some((e) => e.kind === "location" && readyPhotos(e).length > 0),
          cast: characters.map((c) => ({ name: c.name, description: c.description })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't plan that");
      let next = data.plan as DirectorPlan;
      if (camera !== "auto") next = { ...next, shots: next.shots.map((s) => ({ ...s, move: camera })) };
      if (oneTake) next = { ...next, chain: true };
      setPlan(next);
      setTimeout(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't plan that");
    } finally {
      setPlanning(false);
    }
  }

  async function applyChange() {
    if (!plan || !change.trim()) return;
    setRevising(true);
    setError(null);
    try {
      const res = await fetch("/api/director/revise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, instruction: change.trim(), shotIndex: null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't apply that");
      setPlan(data.plan);
      setChange("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply that");
    } finally {
      setRevising(false);
    }
  }

  function payload(p: DirectorPlan): CreatePayload {
    return {
      engine,
      idea: ideaText(),
      plan: p,
      savedCharacterIds: characters.filter((c) => c.savedId).map((c) => c.savedId as string),
      people: characters.filter((c) => !c.savedId).map((c) => ({ name: c.name, description: c.description, photos: readyPhotos(c) })),
      refs: {
        character: [],
        location: elements.filter((e) => e.kind === "location").flatMap(readyPhotos),
        product: elements.filter((e) => e.kind === "product").flatMap(readyPhotos),
      },
      autoApprove: !reviewFrames,
    };
  }

  async function checkout(cents: number, pending: Record<string, unknown>) {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {}
    const co = await fetch("/api/video-paygo/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId: "exact", cents, returnTo: "studio" }) });
    const cd = await co.json();
    if (cd.url) window.location.href = cd.url;
    else throw new Error(cd.error ?? "Checkout failed");
  }

  /** Starts the film. Returns true when it started or a checkout redirect began. */
  async function startFilm(body: CreatePayload, silentOnNoCredit = false): Promise<boolean> {
    setStarting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("engine", body.engine);
      form.append("idea", body.idea);
      form.append("plan", JSON.stringify(body.plan));
      if (body.savedCharacterIds.length) form.append("savedCharacterIds", JSON.stringify(body.savedCharacterIds));
      if (body.people.length) form.append("people", JSON.stringify(body.people));
      form.append("refs", JSON.stringify(body.refs));
      if (body.autoApprove) form.append("autoApprove", "1");
      const res = await fetch("/api/director/create", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setPlan(body.plan);
        setFilmId(data.filmId);
        setFilm({ status: "anchor", error: null, finalVideoUrl: null, shots: body.plan.shots.map((_, idx) => ({ idx, status: "pending", keyframeUrl: null, videoUrl: null, error: null })) });
        return true;
      }
      if (data.needCredit) {
        if (silentOnNoCredit) return false;
        await checkout(data.totalCents ?? perShot * body.plan.shots.length, { kind: "create", body });
        return true;
      }
      throw new Error(data.error ?? "Couldn't start your film");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start your film");
      return false;
    } finally {
      setStarting(false);
    }
  }

  async function approve(id = filmId, silentOnNoCredit = false): Promise<boolean> {
    if (!id) return false;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/director/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filmId: id }) });
      const data = await res.json();
      if (res.ok) {
        setFilm((f) => (f ? { ...f, status: "shots" } : f));
        setPollKey((k) => k + 1);
        return true;
      }
      if (data.needCredit) {
        if (silentOnNoCredit) return false;
        await checkout(data.totalCents, { kind: "approve", filmId: id });
        return true;
      }
      throw new Error(data.error ?? "Couldn't start filming");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start filming");
      return false;
    } finally {
      setStarting(false);
    }
  }

  // Back from Stripe: finish whatever was waiting on the credit (the webhook can lag a few seconds).
  async function resumeAfterCheckout() {
    const p = new URLSearchParams(window.location.search);
    if (!p.has("studio") && !p.has("canceled")) return;
    window.history.replaceState(null, "", window.location.pathname);
    let pending: { kind: string; body?: CreatePayload; filmId?: string } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
      sessionStorage.removeItem(PENDING_KEY);
    } catch {}
    if (!pending) return;
    if (pending.kind === "approve" && pending.filmId) {
      setFilmId(pending.filmId);
      if (!p.has("studio")) return;
      for (let i = 0; i < 15; i++) {
        if (await approve(pending.filmId, true)) return;
        await new Promise((r) => setTimeout(r, 2500));
      }
    } else if (pending.kind === "create" && pending.body) {
      setPlan(pending.body.plan);
      setPrompt(pending.body.idea);
      if (!p.has("studio")) return;
      for (let i = 0; i < 15; i++) {
        if (await startFilm(pending.body, true)) return;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    setNotice("Your payment is still being confirmed - press the button again in a moment.");
  }

  useEffect(() => {
    fetch("/api/director/characters?kind=character").then((r) => r.json()).then((d) => setSaved((s) => ({ ...s, character: Array.isArray(d.characters) ? d.characters : [] }))).catch(() => {});
    fetch("/api/director/characters?kind=location").then((r) => r.json()).then((d) => setSaved((s) => ({ ...s, location: Array.isArray(d.characters) ? d.characters : [] }))).catch(() => {});
    loadCreations();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resumeAfterCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreation(c: Creation) {
    setPlan(null);
    setFilm(null);
    setFilmId(c.id);
    setPollKey((k) => k + 1);
    setTimeout(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function pickRecipe(r: (typeof RECIPES)[number]) {
    setPrompt(r.idea);
    setGenre(r.style);
    setAspect(r.aspect);
    setPlan(null);
    setFilm(null);
    setFilmId(null);
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function reset() {
    setPlan(null);
    setFilm(null);
    setFilmId(null);
    setError(null);
    setNotice(null);
  }

  const reviewing = film?.status === "review";
  const producing = !!film && !DONE.includes(film.status) && !reviewing;
  const tall = (plan?.aspectRatio ?? film?.plan?.aspectRatio) === "9:16";

  return (
    <div className="min-h-screen bg-[#0c0b10] pb-64 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={30} />
          <span className="text-sm font-extrabold tracking-tight">Lucy Studio</span>
        </Link>
        <nav className="flex items-center gap-2 text-xs">
          <Link href="/stitch" className="rounded-full px-3 py-1.5 text-white/70 hover:text-white">Free editor</Link>
          <Link href="/?director=1" className="rounded-full px-3 py-1.5 text-white/70 hover:text-white">Full workspace</Link>
          <Link href="/account" className="rounded-full border border-white/15 px-3 py-1.5 text-white/90 hover:bg-white/10">Account</Link>
        </nav>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4">
        {/* Stage: the storyboard, the film in progress, or the finished film */}
        <div ref={stageRef} className="scroll-mt-4">
          {!plan && !film && (
            <section className="pt-8 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">What should Lucy film?</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm text-white/60">
                Add your people and place, describe the scene, and Lucy directs it - camera angles, coverage, voices and the edit. The storyboard is free; you see the price before anything is filmed.
              </p>
            </section>
          )}

          {plan && !film && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-purple">Storyboard · free</p>
                  <h2 className="mt-1 text-2xl font-extrabold">{plan.title}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-white/60">{plan.logline}</p>
                </div>
                <button onClick={reset} className={chip}>Start over</button>
              </div>
              <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plan.shots.map((s, i) => (
                  <li key={i} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                      Shot {i + 1} · {s.durationSeconds}s · {s.size.replace(/_/g, " ")} · {CAMERA_MOVES[s.move]?.label ?? s.move}
                    </p>
                    <p className="mt-1.5 text-sm text-white/90">{s.action}</p>
                    {s.dialogue && (
                      <p className="mt-2 text-sm italic text-purple-wash">
                        <span className="not-italic font-bold text-white/70">{s.speaker || "Voice"}:</span> “{s.dialogue}”
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyChange()}
                  placeholder="Change anything - “make Jess angrier”, “end on a close-up”, “add a shot of the city”"
                  className="flex-1 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-purple"
                />
                <button onClick={applyChange} disabled={revising || !change.trim()} className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
                  {revising ? "Rewriting…" : "Change it"}
                </button>
              </div>
              <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/50">
                  {plan.shots.length} shots × {formatUsd(perShot)} on {VIDEO_PAYGO_ENGINES[engine].versionLabel} · failed shots refunded
                  {reviewFrames ? " · you approve the frames before filming" : ""}
                </p>
                <button
                  onClick={() => startFilm(payload(plan))}
                  disabled={starting || uploading}
                  className="rounded-2xl bg-purple px-6 py-3 text-sm font-extrabold text-white shadow-lg disabled:opacity-50"
                >
                  {starting ? "Starting…" : reviewFrames ? `Draw the frames (free) →` : `🎬 Film it · ${formatUsd(perShot * plan.shots.length)}`}
                </button>
              </div>
            </section>
          )}

          {film && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-purple">{STAGE[film.status] ?? "Working"}</p>
                  <h2 className="mt-1 text-2xl font-extrabold">{plan?.title ?? film.plan?.title ?? "Your film"}</h2>
                </div>
                <button onClick={reset} className={chip}>New scene</button>
              </div>

              {film.status === "completed" && film.finalVideoUrl ? (
                <div className="mt-5 flex flex-col items-center gap-3">
                  <video src={film.finalVideoUrl} controls autoPlay playsInline className={`rounded-2xl bg-black ${tall ? "max-h-[70vh] w-auto" : "w-full"}`} />
                  <a href={film.finalVideoUrl} download className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black">Download MP4</a>
                </div>
              ) : (
                <>
                  {producing && (
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full animate-pulse rounded-full bg-purple" style={{ width: `${progressPct(film)}%` }} />
                    </div>
                  )}
                  <div className={`mt-5 grid gap-3 ${tall ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 lg:grid-cols-4"}`}>
                    {film.shots.map((s) => (
                      <div key={s.idx} className={`relative overflow-hidden rounded-xl border border-white/10 bg-black/40 ${tall ? "aspect-[9/16]" : "aspect-video"}`}>
                        {s.videoUrl ? (
                          <video src={s.videoUrl} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                        ) : s.keyframeUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.keyframeUrl} alt={`Shot ${s.idx + 1}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-white/40">{producing ? "…" : ""}</div>
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold">Shot {s.idx + 1}</span>
                        {s.error && <span className="absolute inset-x-1 bottom-1 rounded bg-black/70 p-1 text-[10px] text-coral">{s.error}</span>}
                      </div>
                    ))}
                  </div>
                  {producing && <p className="mt-3 text-xs text-white/50">You can leave this page - it keeps going, and it&apos;ll be in Your creations below.</p>}
                </>
              )}

              {reviewing && (
                <div className="mt-5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-white/60">Happy with the frames? Lucy films each one, adds the voices and edits it together.</p>
                  <button onClick={() => approve()} disabled={starting} className="rounded-2xl bg-purple px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50">
                    {starting ? "Starting…" : `🎬 Film it${film.dueOnApproveCents ? ` · ${formatUsd(film.dueOnApproveCents)}` : ""}`}
                  </button>
                </div>
              )}
              {film.status === "failed" && <p className="mt-4 text-sm text-coral">{film.error ?? "This film couldn't be finished - any unused credit has been refunded."}</p>}
            </section>
          )}
        </div>

        {/* Recreate: start from a proven scene */}
        {!plan && !film && (
          <section>
            <h3 className="mb-3 text-sm font-extrabold text-white/80">Recreate</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {RECIPES.map((r) => (
                <button key={r.id} onClick={() => pickRecipe(r)} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left">
                  <video
                    src={r.video}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                    className="aspect-[4/5] w-full bg-black object-cover"
                  />
                  <div className="p-2.5">
                    <p className="text-xs font-bold">{r.emoji} {r.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-white/50">{r.blurb}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {creations.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-extrabold text-white/80">Your creations</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {creations.map((c) => (
                <button key={c.id} onClick={() => openCreation(c)} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left">
                  <div className="relative aspect-video bg-black">
                    {c.videoUrl ? (
                      <video src={c.videoUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : c.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.posterUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    {c.status !== "completed" && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold">{STAGE[c.status] ?? c.status}</span>}
                  </div>
                  <p className="truncate p-2.5 text-xs font-bold">{c.title}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* The prompt bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#0c0b10] via-[#0c0b10]/95 to-transparent px-3 pb-3 pt-8">
        <div className="relative mx-auto max-w-4xl rounded-3xl border border-white/15 bg-[#17151f] p-3 shadow-2xl">
          {(error || notice) && <p className={`mb-2 px-1 text-xs ${error ? "text-coral" : "text-white/60"}`}>{error ?? notice}</p>}

          {/* Elements */}
          <div className="flex flex-wrap items-center gap-2">
            {elements.map((e) => (
              <span key={e.key} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-2 text-xs">
                {e.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.photos[0].preview} alt="" className={`h-6 w-6 rounded-full object-cover ${e.photos.some((p) => p.status === "uploading") ? "opacity-40" : ""}`} />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">{KIND_ICON[e.kind]}</span>
                )}
                <button onClick={() => renameElement(e.key)} className="font-semibold hover:underline" title="Rename">
                  {e.kind === "character" ? "@" : ""}{e.name}
                </button>
                <button onClick={() => setElements((all) => all.filter((x) => x.key !== e.key))} className="text-white/40 hover:text-white" aria-label={`Remove ${e.name}`}>×</button>
              </span>
            ))}
            {(["character", "location", "product"] as Kind[]).map((k) => (
              <button key={k} onClick={() => setPicker(picker === k ? null : k)} className="rounded-full border border-dashed border-white/20 px-2.5 py-1 text-xs text-white/70 hover:bg-white/5">
                + {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          {picker && (
            <ElementPicker
              kind={picker}
              saved={picker === "product" ? [] : saved[picker]}
              onSaved={(s) => {
                const el = addSaved(picker as "character" | "location", s);
                if (el && el.kind === "character" && !prompt.includes(`@${el.name}`)) setPrompt((p) => `${p}${p && !p.endsWith(" ") ? " " : ""}@${el.name} `);
              }}
              onFiles={(f, name) => {
                addFiles(picker, f, name);
                if (picker === "character" && name && !prompt.includes(`@${name}`)) setPrompt((p) => `${p}${p && !p.endsWith(" ") ? " " : ""}@${name} `);
              }}
              onName={(name) => {
                addTextPerson(name);
                if (!prompt.includes(`@${name.trim()}`)) setPrompt((p) => `${p}${p && !p.endsWith(" ") ? " " : ""}@${name.trim()} `);
                setPicker(null);
              }}
              onClose={() => setPicker(null)}
            />
          )}

          {/* Prompt */}
          <div className="relative mt-2">
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
              }}
              rows={2}
              placeholder={characters.length ? `@${characters[0].name} walks into the café and says "Morning!" - type @ to mention someone` : "Describe the scene - who's in it, where, what happens, what they say. Type @ to mention someone."}
              className="w-full resize-none rounded-2xl bg-transparent px-2 py-2 text-[15px] text-white placeholder:text-white/35 focus:outline-none"
            />
            {mention !== null && mentionable.length > 0 && (
              <div className="absolute bottom-full left-2 z-30 mb-1 min-w-40 overflow-hidden rounded-xl border border-white/15 bg-[#221f2c] shadow-xl">
                {mentionable
                  .filter((n) => n.toLowerCase().startsWith(mention))
                  .map((n) => (
                    <button key={n} onMouseDown={(e) => { e.preventDefault(); insertMention(n); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10">
                      @{n}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Chips + Generate */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <select
              aria-label="Genre"
              value={genre}
              onChange={(e) => {
                const g = GENRES.find((x) => x.id === e.target.value);
                setGenre(e.target.value as ProductionStyleId | "auto");
                if (g?.aspect && aspect === "auto") setAspect(g.aspect);
              }}
              className={selectCls}
            >
              {GENRES.map((g) => <option key={g.id} value={g.id} className="bg-[#17151f]">{g.label}</option>)}
            </select>
            <select aria-label="Camera" value={camera} onChange={(e) => setCamera(e.target.value as CameraMoveId | "auto")} className={selectCls}>
              {CAMERAS.map((c) => <option key={c} value={c} className="bg-[#17151f]">{c === "auto" ? "🎥 Camera: Lucy decides" : `🎥 ${CAMERA_MOVES[c].label}`}</option>)}
            </select>
            <select aria-label="Shape" value={aspect} onChange={(e) => setAspect(e.target.value as "auto" | "16:9" | "9:16")} className={selectCls}>
              <option value="auto" className="bg-[#17151f]">▭ Shape: auto</option>
              <option value="16:9" className="bg-[#17151f]">▭ 16:9 wide</option>
              <option value="9:16" className="bg-[#17151f]">▯ 9:16 vertical</option>
            </select>
            <select aria-label="Shots" value={shots} onChange={(e) => setShots(Number(e.target.value))} className={selectCls}>
              {Array.from({ length: MAX_SHOTS - MIN_SHOTS + 1 }, (_, i) => MIN_SHOTS + i).map((n) => <option key={n} value={n} className="bg-[#17151f]">{n} shots</option>)}
            </select>
            <select aria-label="Model" value={engine} onChange={(e) => setEngine(e.target.value as VideoEngine)} className={selectCls}>
              {engineEntries.map(([id, item]) => <option key={id} value={id} className="bg-[#17151f]">{item.versionLabel}</option>)}
            </select>
            <button onClick={() => setOneTake((v) => !v)} aria-pressed={oneTake} className={`${chip} ${oneTake ? "border-purple bg-purple/30" : ""}`}>One take</button>
            <button onClick={() => setReviewFrames((v) => !v)} aria-pressed={reviewFrames} className={`${chip} ${reviewFrames ? "border-purple bg-purple/30" : ""}`} title="See the drawn frames (free) before paying to film">
              Check frames first
            </button>
            <button
              onClick={generate}
              disabled={planning || uploading}
              className="ml-auto rounded-2xl bg-purple px-5 py-2.5 text-sm font-extrabold text-white shadow-lg disabled:opacity-50"
            >
              {planning ? "Lucy is planning…" : uploading ? "Uploading…" : `Generate · ${formatUsd(price)}`}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-white/35">The storyboard is free - nothing is charged until you press Film it.</p>
        </div>
      </div>
    </div>
  );
}

function progressPct(film: Film): number {
  const order = ["anchor", "frames", "review", "shots", "voicing", "stitching", "completed"];
  const base = Math.max(0, order.indexOf(film.status)) / (order.length - 1);
  const done = film.shots.filter((s) => s.videoUrl).length / Math.max(1, film.shots.length);
  return Math.round(100 * Math.min(1, film.status === "shots" ? 0.45 + done * 0.35 : base));
}

function ElementPicker({
  kind,
  saved,
  onSaved,
  onFiles,
  onName,
  onClose,
}: {
  kind: Kind;
  saved: Saved[];
  onSaved: (s: Saved) => void;
  onFiles: (files: FileList | null, name: string) => void;
  onName: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const hint =
    kind === "character"
      ? "One clear photo of their face (nothing in their hands), and their name. No photo? Just type a name and Lucy invents them."
      : kind === "location"
        ? "A photo of the place. Or skip it and just say where in your prompt."
        : "The front of the product and its label.";
  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold">{KIND_ICON[kind]} Add a {KIND_LABEL[kind].toLowerCase()}</p>
        <button onClick={onClose} className="text-xs text-white/50 hover:text-white">Close</button>
      </div>
      <p className="mt-1 text-[11px] text-white/50">{hint}</p>
      {saved.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {saved.map((s) => (
            <button key={s.id} onClick={() => onSaved(s)} className="w-16 shrink-0 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <span className="mt-1 block truncate text-[10px] text-white/70">{s.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {kind === "character" && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name, e.g. Jess" className="w-40 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-purple" />
        )}
        <label className="cursor-pointer rounded-xl bg-white px-3 py-2 text-xs font-bold text-black">
          Upload photo{kind === "character" ? "s" : ""}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onFiles(e.target.files, name.trim());
              e.target.value = "";
            }}
          />
        </label>
        {kind === "character" && (
          <button onClick={() => onName(name)} disabled={!name.trim()} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
            No photo - just the name
          </button>
        )}
      </div>
    </div>
  );
}
