import { NextRequest } from "next/server";
import { getOrCreatePaygoSessionUser, getPaygoSessionUser } from "@/lib/auth";
import { deleteDirectorPreset, initSchema, listDirectorPresets, saveDirectorPreset } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

// "Your movie" presets (2026-09-29): everything a scene reuses - style, model,
// shape, cast, set, standing notes (look/life/set lines) and the locked film
// look - so a new scene only needs its shots and dialogue.
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function clean(raw: unknown) {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const look = (d.look && typeof d.look === "object" ? d.look : null) as Record<string, unknown> | null;
  return {
    style: str(d.style, 30),
    engine: str(d.engine, 30),
    aspect: str(d.aspect, 10),
    castIds: (Array.isArray(d.castIds) ? d.castIds : []).map((x) => str(x, 60)).filter(Boolean).slice(0, 3),
    setId: str(d.setId, 60) || null,
    notes: str(d.notes, 1500),
    look: look
      ? { timeOfDay: str(look.timeOfDay, 80), keyLight: str(look.keyLight, 200), palette: str(look.palette, 200), grade: str(look.grade, 200) }
      : null,
  };
}

export async function GET() {
  await initSchema();
  const user = await getPaygoSessionUser();
  if (!user) return publicJson({ presets: [] });
  const rows = await listDirectorPresets(user.id);
  return publicJson({ presets: rows.map((p) => ({ id: p.id, name: p.name, data: p.data })) });
}

export async function POST(req: NextRequest) {
  await initSchema();
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; name?: unknown; data?: unknown };
  const name = str(body.name, 60).trim();
  if (!name) return publicJson({ error: "Give your movie a name" }, { status: 400 });
  const user = await getOrCreatePaygoSessionUser();
  const p = await saveDirectorPreset(user.id, str(body.id, 60) || null, name, clean(body.data));
  if (!p) return publicJson({ error: "Not found" }, { status: 404 });
  return publicJson({ preset: { id: p.id, name: p.name, data: p.data } });
}

export async function DELETE(req: NextRequest) {
  await initSchema();
  const user = await getPaygoSessionUser();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!user || !(await deleteDirectorPreset(user.id, id))) return publicJson({ error: "Not found" }, { status: 404 });
  return publicJson({ ok: true });
}
