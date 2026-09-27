"use client";

// Reference photos for "Directed by Lucy" (2026-09-27): several photos per
// slot (a whole character sheet, product sides, location angles - 14 in
// total, the most Google's image models take), a one-tap character sheet
// made from one photo, and the saved cast. Each photo is shrunk in the
// browser and uploaded on its own (/api/director/upload), so big sets never
// hit the request size limit and photos survive the checkout redirect.

import Link from "next/link";
import { useEffect, useState } from "react";
import { REF_LIMITS, SHEET_ANGLES, type RefKind, type SheetAngleId } from "@/lib/director/refs";

export type RefPhoto = { id: string; url: string | null; preview: string; status: "uploading" | "ready" | "error"; label?: string };
export type RefPhotos = Record<RefKind, RefPhoto[]>;
export const EMPTY_PHOTOS: RefPhotos = { character: [], product: [], location: [] };

export function readyUrls(photos: RefPhotos, kind: RefKind): string[] {
  return photos[kind].filter((p) => p.status === "ready" && p.url).map((p) => p.url as string);
}
export function isUploading(photos: RefPhotos): boolean {
  return Object.values(photos).some((list) => list.some((p) => p.status === "uploading"));
}
/** Photos rebuilt from saved links (e.g. after checkout) - the link doubles as the preview. */
export function photosFromLinks(links: Partial<Record<RefKind, string[]>>): RefPhotos {
  const out: RefPhotos = { character: [], product: [], location: [] };
  for (const k of ["character", "product", "location"] as const) {
    out[k] = (links[k] ?? []).map((url) => ({ id: url, url, preview: url, status: "ready" as const }));
  }
  return out;
}

type SavedCharacter = { id: string; name: string; description: string; photoUrl: string; photoUrls?: string[] };

const SLOTS: Record<RefKind, { label: string; hint: string; tip: string }> = {
  character: {
    label: "Character",
    hint: "Face photos - more angles = more consistent",
    tip: "One clear photo is enough - Lucy makes the other angles herself when she films. Want to see and check them first? Tap “Make my character sheet”.",
  },
  product: { label: "Product", hint: "Front, label close-up, side", tip: "Plain background, label readable, no hands in the way." },
  location: { label: "Location", hint: "Wide shot + another angle", tip: "The empty place, no people - Lucy puts your character in it." },
};

let nextId = 0;
const newId = () => `p${Date.now()}-${nextId++}`;

/** Shrink to at most 1600px JPEG (~300-700KB) so up to 14 photos upload fast and fit the models' limits. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    if (blob) return blob;
  } catch {}
  return file; // e.g. a format this browser can't decode - the server checks the size
}

async function uploadOne(file: File): Promise<string> {
  const form = new FormData();
  form.append("photo", await shrink(file), "photo.jpg");
  const res = await fetch("/api/director/upload", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't add that photo");
  return data.url as string;
}

function Thumb({ photo, onRemove }: { photo: RefPhoto; onRemove: () => void }) {
  return (
    <div className="relative h-16 w-16 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.preview} alt={photo.label ?? "Reference photo"} className={`h-16 w-16 rounded-lg object-cover ${photo.status === "ready" ? "" : "opacity-50"}`} />
      {photo.status === "uploading" && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">…</span>}
      {photo.status === "error" && <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-50/80 text-[10px] font-bold text-red-600">Failed</span>}
      {photo.label && <span className="absolute bottom-0 left-0 right-0 truncate rounded-b-lg bg-black/50 px-0.5 text-center text-[8px] text-white">{photo.label}</span>}
      <button type="button" aria-label="Remove photo" onClick={onRemove} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-white">
        ×
      </button>
    </div>
  );
}

export function DirectorPhotos({
  photos,
  setPhotos,
  castId,
  setCastId,
  onNotice,
  onError,
}: {
  photos: RefPhotos;
  setPhotos: React.Dispatch<React.SetStateAction<RefPhotos>>;
  castId: string | null;
  setCastId: (id: string | null) => void;
  onNotice: (msg: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const [cast, setCast] = useState<SavedCharacter[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheetProgress, setSheetProgress] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/director/characters")
      .then((r) => r.json())
      .then((d) => setCast(Array.isArray(d.characters) ? d.characters : []))
      .catch(() => {});
  }, []);

  const patch = (kind: RefKind, id: string, p: Partial<RefPhoto>) =>
    setPhotos((all) => ({ ...all, [kind]: all[kind].map((x) => (x.id === id ? { ...x, ...p } : x)) }));

  function addFiles(kind: RefKind, files: FileList | null) {
    if (!files?.length) return;
    onError(null);
    const room = REF_LIMITS[kind] - photos[kind].length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).slice(0, Math.max(0, room));
    if (files.length > room) onNotice(`${SLOTS[kind].label}: up to ${REF_LIMITS[kind]} photos - added the first ${Math.max(0, room)}.`);
    const items = picked.map((file) => ({ file, photo: { id: newId(), url: null, preview: URL.createObjectURL(file), status: "uploading" as const } }));
    setPhotos((all) => ({ ...all, [kind]: [...all[kind], ...items.map((i) => i.photo)] }));
    for (const { file, photo } of items) {
      uploadOne(file)
        .then((url) => patch(kind, photo.id, { url, status: "ready" }))
        .catch((err) => {
          patch(kind, photo.id, { status: "error" });
          onError(err instanceof Error ? err.message : "Couldn't add that photo");
        });
    }
  }

  function remove(kind: RefKind, id: string) {
    setPhotos((all) => ({ ...all, [kind]: all[kind].filter((p) => p.id !== id) }));
    if (kind === "character" && photos.character.length <= 1) setCastId(null);
  }

  function pickCast(c: SavedCharacter) {
    if (castId === c.id) {
      setCastId(null);
      setPhotos((all) => ({ ...all, character: [] }));
      return;
    }
    setCastId(c.id);
    const links = c.photoUrls?.length ? c.photoUrls : [c.photoUrl];
    setPhotos((all) => ({ ...all, character: links.map((url) => ({ id: newId(), url, preview: url, status: "ready" as const })) }));
  }

  async function makeSheet() {
    const sources = readyUrls(photos, "character").slice(0, 4);
    if (!sources.length) return;
    const room = REF_LIMITS.character - photos.character.length;
    const angles = SHEET_ANGLES.slice(0, Math.max(0, room));
    if (!angles.length) return onNotice(`You already have ${REF_LIMITS.character} character photos - remove some to make a sheet.`);
    onError(null);
    let done = 0;
    let failed = 0;
    setSheetProgress(`Drawing ${angles.length} angles… (about a minute)`);
    const drawOne = async (angle: { id: SheetAngleId; label: string }) => {
      const id = newId();
      setPhotos((all) => ({ ...all, character: [...all.character, { id, url: null, preview: sources[0], status: "uploading", label: angle.label }] }));
      try {
        const res = await fetch("/api/director/character-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos: sources, angle: angle.id, description: saveDesc }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't draw that angle");
        patch("character", id, { url: data.url, preview: data.url, status: "ready" });
      } catch (err) {
        failed++;
        setPhotos((all) => ({ ...all, character: all.character.filter((p) => p.id !== id) }));
        onError(err instanceof Error ? err.message : "Couldn't draw that angle");
      } finally {
        done++;
        setSheetProgress(`Drawing angles… ${done} of ${angles.length} done`);
      }
    };
    // Two at a time - kind to Google's shared capacity, still quick.
    for (let i = 0; i < angles.length; i += 2) await Promise.all(angles.slice(i, i + 2).map(drawOne));
    setSheetProgress(null);
    onNotice(
      failed
        ? `Character sheet made with ${angles.length - failed} of ${angles.length} angles. Check them - remove any that don't look like the same person.`
        : "Character sheet made! Check every angle looks like the same person - remove any that don't. Then save them to Your cast.",
    );
  }

  async function saveCharacter() {
    const links = readyUrls(photos, "character");
    if (!links.length || !saveName.trim()) return;
    setSaving(true);
    onError(null);
    try {
      const form = new FormData();
      form.append("name", saveName.trim());
      form.append("description", saveDesc.trim());
      form.append("photos", JSON.stringify(links));
      const res = await fetch("/api/director/characters", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      setCast((c) => [data.character, ...c]);
      setCastId(data.character.id);
      setSaveName("");
      onNotice(`${data.character.name} saved with ${links.length} photo${links.length === 1 ? "" : "s"} - tap them in Your cast for any film.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const totalPhotos = photos.character.length + photos.product.length + photos.location.length;
  const readyCharacters = readyUrls(photos, "character").length;
  const inputCls = "rounded-xl border border-border bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple";

  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        2. Optional photos - add them when a real person, product or place must look exactly right
      </p>
      <details className="mb-2 rounded-xl bg-white/70 p-2 text-[11px] text-muted">
        <summary className="cursor-pointer font-semibold text-purple">📸 Which photos should I add? (easy guide)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li><strong className="text-foreground">A person?</strong> One clear face photo is enough - Lucy makes their character sheet (every side) automatically. Already have a sheet? Add up to 8 angles. No photo at all? Lucy invents the person and makes their sheet too.</li>
          <li><strong className="text-foreground">A product?</strong> Add the front, a close-up of the label, and the side. Plain background.</li>
          <li><strong className="text-foreground">A real place?</strong> Add a wide photo of it empty, plus another angle. No place? Skip it - Lucy invents one and puts your character inside it, with real shadows and light (never a fake cut-out look).</li>
          <li><strong className="text-foreground">Don&apos;t:</strong> use sunglasses, blurry or dark photos, group photos, or several different people in the Character box.</li>
        </ol>
        <p className="mt-2">
          Step-by-step with examples:{" "}
          <Link href="/character-sheet" className="font-semibold text-purple underline">how to make a character sheet</Link>
        </p>
      </details>

      {cast.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[11px] font-semibold text-muted">Your cast - tap to use in this film</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cast.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCast(c)}
                className={`flex shrink-0 flex-col items-center rounded-xl border p-1.5 ${castId === c.id ? "border-purple bg-purple/10" : "border-border bg-white"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.photoUrl} alt={c.name} className="h-12 w-12 rounded-lg object-cover" />
                <span className="mt-0.5 max-w-16 truncate text-[10px] font-bold">{c.name}</span>
                <span className="text-[9px] text-muted">{(c.photoUrls?.length ?? 1)} photo{(c.photoUrls?.length ?? 1) === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(["character", "product", "location"] as const).map((kind) => {
          const list = photos[kind];
          const full = list.length >= REF_LIMITS[kind];
          return (
            <div key={kind} className="rounded-2xl border border-dashed border-purple/30 bg-white/70 p-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold text-foreground">{SLOTS[kind].label}</span>
                <span className="text-[10px] text-muted">{list.length} of {REF_LIMITS[kind]}</span>
              </div>
              <p className="text-[10px] leading-tight text-muted">{list.length ? SLOTS[kind].tip : SLOTS[kind].hint}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {list.map((p) => (
                  <Thumb key={p.id} photo={p} onRemove={() => remove(kind, p.id)} />
                ))}
                {!full && (
                  <label className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg bg-purple/5 text-purple">
                    <span className="text-xl leading-none">+</span>
                    <span className="text-[9px] font-semibold">Add photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addFiles(kind, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              {kind === "character" && readyCharacters > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {!sheetProgress && photos.character.length < REF_LIMITS.character && photos.character.length < 4 && (
                    <button type="button" onClick={makeSheet} className="self-start rounded-xl bg-purple px-3 py-1.5 text-xs font-bold text-white">
                      ✨ Make my character sheet - Lucy draws {Math.min(SHEET_ANGLES.length, REF_LIMITS.character - photos.character.length)} more angles (free)
                    </button>
                  )}
                  {sheetProgress && <p className="text-[11px] font-semibold text-purple">{sheetProgress}</p>}
                  {!castId && !sheetProgress && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2">
                      <span className="text-[11px] font-semibold text-muted">Save this person for next time:</span>
                      <input className={`${inputCls} w-28`} placeholder="Name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                      <input className={`${inputCls} min-w-40 flex-1`} placeholder="Optional: age, look, style" value={saveDesc} onChange={(e) => setSaveDesc(e.target.value)} />
                      <button type="button" disabled={!saveName.trim() || saving || isUploading(photos)} onClick={saveCharacter} className="rounded-xl bg-purple/10 px-3 py-1.5 text-xs font-bold text-purple disabled:opacity-50">
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {totalPhotos > 0 && <p className="mt-1 text-[10px] text-muted">{totalPhotos} of 14 photos - Lucy uses all of them when she draws your storyboard.</p>}
    </div>
  );
}
