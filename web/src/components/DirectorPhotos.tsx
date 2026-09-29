"use client";

// Reference photos for "Directed by Lucy" (2026-09-27): several photos per
// slot (a whole character sheet, product sides, location angles - 14 in
// total, the most Google's image models take), a one-tap character sheet
// made from one photo, and the saved cast. Each photo is shrunk in the
// browser and uploaded on its own (/api/director/upload), so big sets never
// hit the request size limit and photos survive the checkout redirect.

import Link from "next/link";
import { useEffect, useState } from "react";
import { LOCATION_ANGLES, MAX_CAST, REF_LIMITS, SHEET_ANGLES, type RefKind, type SheetAngleId } from "@/lib/director/refs";

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
export type CastPick = { id: string; name: string; description: string };
export const FREE_IMAGE_TOOLS = [
  { name: "ChatGPT", href: "https://chatgpt.com" },
  { name: "Gemini", href: "https://gemini.google.com" },
];

const SLOTS: Record<RefKind, { label: string; hint: string; tip: string }> = {
  character: {
    label: "Character",
    hint: "One clear face photo is enough",
    tip: "Lucy makes the other angles when she films. Want to see them first? Tap the button below.",
  },
  product: { label: "Product", hint: "Front + label", tip: "Plain background, label readable." },
  location: { label: "Location", hint: "A photo of the place, empty - or describe it below and Lucy draws it", tip: "No people in it - Lucy adds your characters." },
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
  selectedCast,
  setSelectedCast,
  onNotice,
  onError,
}: {
  photos: RefPhotos;
  setPhotos: React.Dispatch<React.SetStateAction<RefPhotos>>;
  selectedCast: CastPick[];
  setSelectedCast: React.Dispatch<React.SetStateAction<CastPick[]>>;
  onNotice: (msg: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const [cast, setCast] = useState<SavedCharacter[]>([]);
  const [sets, setSets] = useState<SavedCharacter[]>([]);
  const [setId, setSetId] = useState<string | null>(null);
  const [placeText, setPlaceText] = useState("");
  const [placeProgress, setPlaceProgress] = useState<string | null>(null);
  const [setName, setSetName] = useState("");
  const [outfit, setOutfit] = useState("");
  const [logo, setLogo] = useState<{ url: string; preview: string } | null>(null);
  const [logoPlacement, setLogoPlacement] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheetProgress, setSheetProgress] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/director/characters")
      .then((r) => r.json())
      .then((d) => setCast(Array.isArray(d.characters) ? d.characters : []))
      .catch(() => {});
    fetch("/api/director/characters?kind=location")
      .then((r) => r.json())
      .then((d) => setSets(Array.isArray(d.characters) ? d.characters : []))
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
    if (kind === "location") setSetId(null);
  }

  /** Rename a saved person or set so it matches the names in your script. */
  async function rename(c: SavedCharacter, kind: "character" | "location") {
    const name = window.prompt("New name (use the same name as in your script):", c.name)?.trim();
    if (!name || name === c.name) return;
    const description = window.prompt("Describe them (look, clothes, voice) - optional:", c.description) ?? c.description;
    const res = await fetch("/api/director/characters", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, name, description }),
    });
    const data = await res.json();
    if (!res.ok) return onError(data.error ?? "Couldn't rename");
    const update = (list: SavedCharacter[]) => list.map((x) => (x.id === c.id ? { ...x, name, description } : x));
    if (kind === "location") setSets(update);
    else {
      setCast(update);
      setSelectedCast((sel) => sel.map((x) => (x.id === c.id ? { ...x, name, description } : x)));
    }
    onNotice(`Renamed to ${name}.`);
  }

  /** Up to 3 people from Your cast in one film - Lucy keeps each face separate. */
  function pickCast(c: SavedCharacter) {
    setSelectedCast((sel) => {
      if (sel.some((x) => x.id === c.id)) return sel.filter((x) => x.id !== c.id);
      if (sel.length >= MAX_CAST) {
        onNotice(`Up to ${MAX_CAST} people from Your cast per film.`);
        return sel;
      }
      return [...sel, { id: c.id, name: c.name, description: c.description }];
    });
  }

  function pickSet(c: SavedCharacter) {
    if (setId === c.id) {
      setSetId(null);
      setPhotos((all) => ({ ...all, location: [] }));
      return;
    }
    setSetId(c.id);
    const links = (c.photoUrls?.length ? c.photoUrls : [c.photoUrl]).slice(0, REF_LIMITS.location);
    setPhotos((all) => ({ ...all, location: links.map((url) => ({ id: newId(), url, preview: url, status: "ready" as const })) }));
  }

  /** "Draw this place": a wide view from the words, then two more angles of the same room. */
  async function drawPlace() {
    const description = placeText.trim();
    if (description.length < 8) return onNotice("Describe the place in a sentence first.");
    onError(null);
    setSetId(null);
    setPhotos((all) => ({ ...all, location: [] }));
    const call = async (angle: string, refs: string[]) => {
      const res = await fetch("/api/director/location-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, angle, photos: refs, logo: logo?.url, logoPlacement }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't draw that view");
      return data.url as string;
    };
    try {
      setPlaceProgress("Drawing the place… 1 of 3");
      const first = await call(LOCATION_ANGLES[0].id, []);
      setPhotos((all) => ({ ...all, location: [{ id: newId(), url: first, preview: first, status: "ready", label: LOCATION_ANGLES[0].label }] }));
      setPlaceProgress("Drawing 2 more angles of the same place…");
      const more = await Promise.all(LOCATION_ANGLES.slice(1).map((a) => call(a.id, [first]).then((url): { url: string; label: string } => ({ url, label: a.label })).catch(() => null)));
      setPhotos((all) => ({
        ...all,
        location: [...all.location, ...more.filter((m): m is { url: string; label: string } => !!m).map((m) => ({ id: newId(), url: m.url, preview: m.url, status: "ready" as const, label: m.label }))],
      }));
      onNotice("Your set is ready! Check the pictures - remove any you don't like - then save it to Your sets.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't draw that place");
    } finally {
      setPlaceProgress(null);
    }
  }

  async function saveSet() {
    const links = readyUrls(photos, "location");
    if (!links.length || !setName.trim()) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name", setName.trim());
      form.append("description", placeText.trim());
      form.append("photos", JSON.stringify(links));
      form.append("kind", "location");
      const res = await fetch("/api/director/characters", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      setSets((c) => [data.character, ...c]);
      setSetId(data.character.id);
      setSetName("");
      onNotice(`${data.character.name} saved to Your sets - tap it for any scene filmed there.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
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
          body: JSON.stringify({ photos: sources, angle: angle.id, description: saveDesc, outfit }),
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
      setSaveName("");
      setPhotos((all) => ({ ...all, character: [] }));
      setSelectedCast((sel) => (sel.length < MAX_CAST ? [...sel, { id: data.character.id, name: data.character.name, description: data.character.description }] : sel));
      onNotice(`${data.character.name} saved with ${links.length} photo${links.length === 1 ? "" : "s"} and added to this film. Add the next person, or carry on.`);
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
    <details className="rounded-2xl border border-border bg-white/70 p-3" open={totalPhotos > 0 || cast.length > 0 || sets.length > 0 || undefined}>
      <summary className="cursor-pointer text-sm font-bold text-foreground">
        2. 📸 Cast, product &amp; place <span className="font-normal text-muted">(optional)</span>
      </summary>
      <ul className="mb-2 mt-2 flex flex-col gap-1 text-xs text-muted">
        <li>🙂 <strong className="text-foreground">A person?</strong> One photo of just them - face clear, nothing in their hands. Crop out other people.</li>
        <li>🧴 <strong className="text-foreground">Your product?</strong> Front + label. Plain background.</li>
        <li>🏠 <strong className="text-foreground">A place?</strong> A photo of it empty, or type what it looks like and tap <em>Draw this place</em>.</li>
        <li>🚫 Never use photos of real actors or stills from a film.</li>
        <li>
          🎨 No photo of your character? Make one free in{" "}
          {FREE_IMAGE_TOOLS.map((t, i) => (
            <span key={t.name}>
              {i > 0 && " or "}
              <a href={t.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-purple underline">{t.name}</a>
            </span>
          ))}{" "}
          - <Link href="/make-a-movie#characters" className="font-semibold text-purple underline">copy our prompt</Link>.
        </li>
      </ul>

      {cast.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[11px] font-semibold text-muted">Your cast - tap up to {MAX_CAST} people for this film</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cast.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCast(c)}
                className={`flex shrink-0 flex-col items-center rounded-xl border p-1.5 ${selectedCast.some((x) => x.id === c.id) ? "border-purple bg-purple/10" : "border-border bg-white"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.photoUrl} alt={c.name} className="h-12 w-12 rounded-lg object-cover" />
                <span className="mt-0.5 max-w-16 truncate text-[10px] font-bold">{c.name}</span>
                <span className="text-[9px] text-muted">{(c.photoUrls?.length ?? 1)} photo{(c.photoUrls?.length ?? 1) === 1 ? "" : "s"}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    rename(c, "character");
                  }}
                  className="text-[9px] font-semibold text-purple underline"
                >
                  ✏️ rename
                </span>
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
              {kind === "location" && (
                <div className="mt-2 flex flex-col gap-2">
                  {sets.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {sets.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pickSet(c)}
                          className={`flex shrink-0 flex-col items-center rounded-xl border p-1.5 ${setId === c.id ? "border-purple bg-purple/10" : "border-border bg-white"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.photoUrl} alt={c.name} className="h-12 w-20 rounded-lg object-cover" />
                          <span className="mt-0.5 max-w-20 truncate text-[10px] font-bold">{c.name}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              rename(c, "location");
                            }}
                            className="text-[9px] font-semibold text-purple underline"
                          >
                            ✏️ rename
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!list.length && (
                    <div className="flex flex-col gap-1">
                      <textarea
                        aria-label="Describe the place"
                        rows={2}
                        className={`${inputCls} w-full`}
                        placeholder="e.g. A 1980s Manhattan corner office, dark wood, big desk, black leather chair, skyscrapers through the windows at sunset"
                        value={placeText}
                        onChange={(e) => setPlaceText(e.target.value)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {logo ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logo.preview} alt="Logo" className="h-8 w-8 rounded bg-foreground object-contain" />
                            <input className={`${inputCls} min-w-40 flex-1`} placeholder="Where? e.g. brushed-steel letters behind the desk" value={logoPlacement} onChange={(e) => setLogoPlacement(e.target.value)} />
                            <button type="button" onClick={() => setLogo(null)} className="text-[10px] text-purple underline">Remove logo</button>
                          </>
                        ) : (
                          <label className="cursor-pointer text-[11px] font-semibold text-purple underline">
                            + Add your logo to the set (optional)
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (!f) return;
                                uploadOne(f)
                                  .then((url) => setLogo({ url, preview: URL.createObjectURL(f) }))
                                  .catch((err) => onError(err instanceof Error ? err.message : "Couldn't add that logo"));
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <button type="button" disabled={!!placeProgress || placeText.trim().length < 8} onClick={drawPlace} className="self-start rounded-xl bg-purple px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                        {placeProgress ?? "✨ Draw this place (3 angles, free)"}
                      </button>
                    </div>
                  )}
                  {placeProgress && list.length > 0 && <p className="text-[11px] font-semibold text-purple">{placeProgress}</p>}
                  {list.length > 0 && !setId && !placeProgress && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2">
                      <span className="text-[11px] font-semibold text-muted">Save this place for every scene here:</span>
                      <input className={`${inputCls} w-40`} placeholder="Name, e.g. Victor's office" value={setName} onChange={(e) => setSetName(e.target.value)} />
                      <button type="button" disabled={!setName.trim() || saving || isUploading(photos)} onClick={saveSet} className="rounded-xl bg-purple/10 px-3 py-1.5 text-xs font-bold text-purple disabled:opacity-50">
                        {saving ? "Saving…" : "Save to Your sets"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {kind === "character" && readyCharacters > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {!sheetProgress && photos.character.length < REF_LIMITS.character && photos.character.length < 4 && (
                    <div className="flex flex-col gap-1">
                      <input
                        className={`${inputCls} w-full`}
                        placeholder="Optional: new outfit, e.g. a crisp white button-down shirt, open collar"
                        value={outfit}
                        onChange={(e) => setOutfit(e.target.value)}
                      />
                      <button type="button" onClick={makeSheet} className="self-start rounded-xl bg-purple px-3 py-1.5 text-xs font-bold text-white">
                        ✨ Show me every angle first (free)
                      </button>
                    </div>
                  )}
                  {sheetProgress && <p className="text-[11px] font-semibold text-purple">{sheetProgress}</p>}
                  {!sheetProgress && (
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
      {selectedCast.length > 0 && (
        <p className="mt-2 text-xs text-foreground">
          🎭 <strong>In this film:</strong> {selectedCast.map((c) => c.name).join(", ")}
        </p>
      )}
      {totalPhotos > 0 && <p className="mt-1 text-[10px] text-muted">{totalPhotos} of 14 photos used.</p>}
    </details>
  );
}
