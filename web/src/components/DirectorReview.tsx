"use client";

// Director's review panel + per-shot direction notes (2026-09-30). Free and
// instant: everything here is pure functions over the plan (no model calls).
// The engine suggestion is ONLY a suggestion - nothing here changes the
// film's engine or price; the customer picks the model above.

import { useMemo, useState } from "react";
import type { DirectorPlan } from "@/lib/director/plan";
import { BEAT_LABEL } from "@/lib/director/beats";
import { CHECK_LABEL, applyReviewFixes, directorReview, type ReviewCheck } from "@/lib/director/review";
import { recommendEngine } from "@/lib/director/playbooks";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoEngines";

type Refs = { character: boolean; product: boolean; location: boolean };

const AVAILABLE = Object.keys(VIDEO_PAYGO_ENGINES);
const gradeCls: Record<string, string> = { A: "bg-green-100 text-green-800", B: "bg-lime-100 text-lime-800", C: "bg-amber-100 text-amber-900", D: "bg-coral/10 text-coral-dark" };

export function DirectorReviewPanel({ plan, engine, idea, refs, onApply }: { plan: DirectorPlan; engine: VideoEngine; idea: string; refs: Refs; onApply: (next: DirectorPlan) => void }) {
  const opts = useMemo(() => ({ engine, idea, refs, nativeAudio: VIDEO_PAYGO_ENGINES[engine].supportsNativeAudio }), [engine, idea, refs]);
  const review = useMemo(() => directorReview(plan, opts), [plan, opts]);
  const [open, setOpen] = useState(false);
  const shown = open ? review.issues : review.issues.slice(0, 4);
  return (
    <div className="rounded-xl border border-purple/20 bg-white p-3 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-foreground">
          🎬 Director&apos;s review{" "}
          <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${gradeCls[review.grade]}`}>
            {review.score}/100 · {review.grade}
          </span>
          {plan.recipe && <span className="ml-2 font-semibold text-muted">shot like a {plan.recipe.replace(/_/g, " ")} scene</span>}
        </p>
        {review.autoFixes > 0 && (
          <button type="button" onClick={() => onApply(applyReviewFixes(plan, opts))} className="rounded-lg bg-purple px-3 py-1 text-[11px] font-bold text-white">
            ✨ Apply {review.autoFixes} fix{review.autoFixes === 1 ? "" : "es"}
          </button>
        )}
      </div>
      <p className="mt-1 text-muted">Free check before anything is filmed - no credits used. Average shot {review.asl.seconds}s (this style usually cuts every {review.asl.band[0]}-{review.asl.band[1]}s).</p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
        {(Object.keys(review.checks) as ReviewCheck[]).map((c) => (
          <div key={c} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-muted">{CHECK_LABEL[c]}</span>
            <span className="h-1.5 flex-1 rounded-full bg-border">
              <span className={`block h-1.5 rounded-full ${review.checks[c] >= 90 ? "bg-green-500" : review.checks[c] >= 70 ? "bg-amber-400" : "bg-coral"}`} style={{ width: `${review.checks[c]}%` }} />
            </span>
          </div>
        ))}
      </div>
      {review.issues.length ? (
        <ul className="mt-2 flex flex-col gap-1">
          {shown.map((x, i) => (
            <li key={i} className="rounded-lg bg-cream px-2 py-1">
              <span className="font-bold text-foreground">{x.shot ? `Shot ${x.shot}` : "Scene"}</span> · {x.message}
              <span className="block text-purple">→ {x.fix}{x.auto ? " (fixed by Apply)" : ""}</span>
            </li>
          ))}
          {review.issues.length > 4 && (
            <li>
              <button type="button" className="font-semibold text-purple underline" onClick={() => setOpen((v) => !v)}>
                {open ? "Show fewer" : `Show all ${review.issues.length} notes`}
              </button>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-2 font-semibold text-green-700">✓ Nothing to fix - every shot fits its beat, the grammar holds and the prompts fit.</p>
      )}
    </div>
  );
}

/** One shot's beat, and the engine that suits it (a suggestion; never applied automatically). */
export function ShotDirection({ plan, index, engine }: { plan: DirectorPlan; index: number; engine: VideoEngine }) {
  const s = plan.shots[index];
  const tip = useMemo(() => recommendEngine(plan, index, AVAILABLE, engine), [plan, index, engine]);
  const label = VIDEO_PAYGO_ENGINES[tip.engine as VideoEngine]?.versionLabel ?? tip.engine;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted">
      {s.beatFunction && (
        <span className="rounded-full bg-purple/10 px-2 py-0.5 font-bold text-purple" title="What this shot does in the scene, and how hard it hits (0-1)">
          {BEAT_LABEL[s.beatFunction]}
          {s.intensity !== undefined ? ` · ${s.intensity.toFixed(2)}` : ""}
        </span>
      )}
      {s.cutTo && <span className="rounded-full bg-cream px-2 py-0.5">then cut to {s.cutTo === "reaction" ? "a reaction" : "an insert"}</span>}
      {!tip.current && (
        <span className="rounded-full bg-cream px-2 py-0.5" title="A suggestion only - one model films the whole film, and you choose it above. Lucy never switches it for you.">
          💡 suits {label}
          {tip.available ? "" : " (not available)"} - {tip.reason}
        </span>
      )}
    </p>
  );
}
