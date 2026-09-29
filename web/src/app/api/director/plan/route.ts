import { NextRequest } from "next/server";
import { initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { planFilm } from "@/lib/director/planner.server";
import { ALL_STYLE_IDS, type ProductionStyleId } from "@/lib/director/filmScience";
import { underPlanCap } from "../_shared";

export const maxDuration = 60;

// Free: idea (+ which reference photos will be attached) -> storyboard.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json()) as Record<string, unknown>;
    const idea = String(body.idea ?? "").trim();
    if (idea.length < 3) return publicJson({ error: "Describe your idea in a few words" }, { status: 400 });
    if (idea.length > 4000) return publicJson({ error: "Keep the idea or script under 4,000 characters - split a longer script into two scenes" }, { status: 400 });
    if (!(await underPlanCap(req))) return publicJson({ error: "You've planned a lot today - try again tomorrow, or make one of your storyboards." }, { status: 429 });
    const style = ALL_STYLE_IDS.includes(body.style as ProductionStyleId) ? (body.style as ProductionStyleId) : "auto";
    const aspect = body.aspectRatio === "16:9" || body.aspectRatio === "9:16" ? body.aspectRatio : "auto";
    const { plan, source } = await planFilm({
      idea,
      style,
      shotCount: Number(body.shotCount) || undefined,
      aspectRatio: aspect,
      hasCharacterPhoto: !!body.hasCharacterPhoto,
      hasProductPhoto: !!body.hasProductPhoto,
      hasLocationPhoto: !!body.hasLocationPhoto,
      cast: (Array.isArray(body.cast) ? body.cast : [])
        .slice(0, 3)
        .map((c) => ({ name: String((c as { name?: unknown })?.name ?? "").slice(0, 60), description: String((c as { description?: unknown })?.description ?? "").slice(0, 300) }))
        .filter((c) => c.name),
    });
    // "Your movie": keep the saved film look so every scene matches.
    const lk = body.look as Record<string, unknown> | undefined;
    if (lk && typeof lk === "object" && typeof lk.grade === "string" && lk.grade) {
      plan.look = {
        timeOfDay: String(lk.timeOfDay ?? plan.look.timeOfDay).slice(0, 80),
        keyLight: String(lk.keyLight ?? plan.look.keyLight).slice(0, 200),
        palette: String(lk.palette ?? plan.look.palette).slice(0, 200),
        grade: String(lk.grade).slice(0, 200),
      };
    }
    return publicJson({ plan, source });
  } catch (err) {
    console.error("[director/plan] failed", err);
    return publicJson({ error: "Couldn't plan that right now - please try again." }, { status: 500 });
  }
}
