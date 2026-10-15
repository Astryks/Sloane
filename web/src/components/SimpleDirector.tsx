"use client";

// Directed by Lucy - the simple 3-step flow (2026-10-16):
//   1. Who's in it?   one card per person: photos + a name (+ a few words)
//   2. Where is it?   a photo of the place, a saved set, or a few words
//   3. What happens?  the idea in plain English, using their names
// then "Lucy, direct it". Names matter: the script says "Jess walks in",
// so each face must be tied to its name (the old single "Your characters"
// box blended everyone into one person).

import { useEffect, useState } from "react";
import { REF_LIMITS } from "@/lib/director/refs";
import { Thumb, uploadOne, type CastPick, type RefPhoto, type RefPhotos } from "./DirectorPhotos";

export type SimplePerson = { id: string; name: string; description: string; photos: RefPhoto[] };

type Saved = { id: string; name: string; description: string; photoUrl: string; photoUrls?: string[]; voiceId?: string };

const newId = () => Math.random().toString(36).slice(2, 10);
export const MAX_PEOPLE = 3;

export function emptyPerson(): SimplePerson {
  return { id: newId(), name: "", description: "", photos: [] };
}

/** People ready to send: named or with at least one uploaded photo. */
export function readyPeople(people: SimplePerson[]) {
  return people
    .map((p) => ({ name: p.name.trim(), description: p.description.trim(), photos: p.photos.filter((x) => x.status === "ready" && x.url).map((x) => x.url as string) }))
    .filter((p) => p.name || p.photos.length);
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-purple/20 bg-white/80 p-4">
      <p className="flex items-center text-sm font-extrabold text-foreground">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple text-xs font-extrabold text-white">{n}</span>
        {title}
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function AddPhoto({ onFiles, label = "Add photo" }: { onFiles: (files: FileList | null) => void; label?: string }) {
  return (
    <label className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl bg-purple/10 text-purple">
      <span className="text-xl leading-none">+</span>
      <span className="text-[9px] font-bold">{label}</span>
      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
    </label>
  );
}

export function SimpleDirector({
  people,
  setPeople,
  selectedCast,
  setSelectedCast,
  photos,
  setPhotos,
  place,
  setPlace,
  idea,
  setIdea,
  onError,
}: {
  people: SimplePerson[];
  setPeople: React.Dispatch<React.SetStateAction<SimplePerson[]>>;
  selectedCast: CastPick[];
  setSelectedCast: React.Dispatch<React.SetStateAction<CastPick[]>>;
  photos: RefPhotos;
  setPhotos: React.Dispatch<React.SetStateAction<RefPhotos>>;
  place: string;
  setPlace: (v: string) => void;
  idea: string;
  setIdea: (v: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [saved, setSaved] = useState<Saved[]>([]);
  const [sets, setSets] = useState<Saved[]>([]);
  const [showProduct, setShowProduct] = useState(false);

  // Your cast / Your sets, if this visitor saved any before.
  useEffect(() => {
    fetch("/api/director/characters?kind=character").then((r) => r.json()).then((d) => setSaved(Array.isArray(d.characters) ? d.characters : [])).catch(() => {});
    fetch("/api/director/characters?kind=location").then((r) => r.json()).then((d) => setSets(Array.isArray(d.characters) ? d.characters : [])).catch(() => {});
  }, []);

  const total = people.length + selectedCast.length;

  function addPersonPhotos(id: string, files: FileList | null) {
    if (!files?.length) return;
    onError(null);
    const person = people.find((p) => p.id === id);
    const room = REF_LIMITS.character - (person?.photos.length ?? 0);
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).slice(0, Math.max(0, Math.min(room, 4)));
    const items = picked.map((file) => ({ file, photo: { id: newId(), url: null, preview: URL.createObjectURL(file), status: "uploading" as const } }));
    const patch = (photoId: string, change: Partial<RefPhoto>) =>
      setPeople((all) => all.map((p) => (p.id === id ? { ...p, photos: p.photos.map((x) => (x.id === photoId ? { ...x, ...change } : x)) } : p)));
    setPeople((all) => all.map((p) => (p.id === id ? { ...p, photos: [...p.photos, ...items.map((i) => i.photo)] } : p)));
    for (const { file, photo } of items) {
      uploadOne(file)
        .then((url) => patch(photo.id, { url, status: "ready" }))
        .catch((err) => {
          patch(photo.id, { status: "error" });
          onError(err instanceof Error ? err.message : "Couldn't add that photo");
        });
    }
  }

  function addPlaceOrProduct(kind: "location" | "product", files: FileList | null) {
    if (!files?.length) return;
    onError(null);
    const room = REF_LIMITS[kind] - photos[kind].length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).slice(0, Math.max(0, room));
    const items = picked.map((file) => ({ file, photo: { id: newId(), url: null, preview: URL.createObjectURL(file), status: "uploading" as const } }));
    const patch = (photoId: string, change: Partial<RefPhoto>) =>
      setPhotos((all) => ({ ...all, [kind]: all[kind].map((x) => (x.id === photoId ? { ...x, ...change } : x)) }));
    setPhotos((all) => ({ ...all, [kind]: [...all[kind], ...items.map((i) => i.photo)] }));
    for (const { file, photo } of items) {
      uploadOne(file)
        .then((url) => patch(photo.id, { url, status: "ready" }))
        .catch((err) => {
          patch(photo.id, { status: "error" });
          onError(err instanceof Error ? err.message : "Couldn't add that photo");
        });
    }
  }

  function pickSet(s: Saved) {
    const urls = (s.photoUrls?.length ? s.photoUrls : [s.photoUrl]).filter(Boolean).slice(0, REF_LIMITS.location);
    setPhotos((all) => ({ ...all, location: urls.map((u) => ({ id: newId(), url: u, preview: u, status: "ready" as const, label: s.name })) }));
    if (!place.trim()) setPlace(s.name);
  }

  const names = [...selectedCast.map((c) => c.name), ...people.map((p) => p.name.trim()).filter(Boolean)];
  const example = names.length >= 2
    ? `${names[0]} and ${names[1]} meet in the office. ${names[0]} is nervous and asks for advice; ${names[1]} smiles and says "Start small - and start today." Warm, natural, cinematic.`
    : names.length === 1
      ? `${names[0]} walks in, looks around, and says "This is where it all starts." Hopeful, natural, cinematic.`
      : "A barista opens her café at sunrise, turns the sign and smiles at the first customer. Warm, natural, cinematic.";

  return (
    <div className="flex flex-col gap-3">
      <Step n={1} title="Who's in it?" hint="One clear photo of each person (face visible, nothing in their hands) and their name. No photo? Just type a name and Lucy will invent them.">
        {saved.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-[11px] font-semibold text-muted">Your cast - tap to add</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {saved.map((c) => {
                const on = selectedCast.some((x) => x.id === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!on && total >= MAX_PEOPLE}
                    onClick={() => setSelectedCast((sel) => (on ? sel.filter((x) => x.id !== c.id) : [...sel, { id: c.id, name: c.name, description: c.description, voiceId: c.voiceId }]))}
                    className={`flex shrink-0 flex-col items-center rounded-xl border p-1.5 text-[11px] font-semibold disabled:opacity-40 ${on ? "border-purple bg-purple/10 text-purple" : "border-border bg-white text-foreground"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.photoUrls?.[0] ?? c.photoUrl} alt={c.name} className="h-12 w-12 rounded-lg object-cover" />
                    <span className="mt-0.5 max-w-16 truncate">{on ? `✓ ${c.name}` : c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {people.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-border bg-white p-2">
              <div className="flex flex-wrap items-center gap-2">
                {p.photos.map((ph) => (
                  <Thumb key={ph.id} photo={ph} onRemove={() => setPeople((all) => all.map((x) => (x.id === p.id ? { ...x, photos: x.photos.filter((y) => y.id !== ph.id) } : x)))} />
                ))}
                {p.photos.length < 4 && <AddPhoto onFiles={(f) => addPersonPhotos(p.id, f)} />}
                <div className="flex min-w-40 flex-1 flex-col gap-1">
                  <input
                    aria-label={`Person ${i + 1} name`}
                    className="rounded-lg border border-border px-2 py-1.5 text-sm font-semibold"
                    placeholder={`Name (e.g. ${i === 0 ? "Jess" : i === 1 ? "Liam" : "Lawrence"})`}
                    maxLength={40}
                    value={p.name}
                    onChange={(e) => setPeople((all) => all.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    aria-label={`Person ${i + 1} description`}
                    className="rounded-lg border border-border px-2 py-1 text-xs"
                    placeholder="A few words - clothes, age, accent (optional)"
                    maxLength={300}
                    value={p.description}
                    onChange={(e) => setPeople((all) => all.map((x) => (x.id === p.id ? { ...x, description: e.target.value } : x)))}
                  />
                </div>
                {people.length > 1 && (
                  <button type="button" aria-label="Remove person" onClick={() => setPeople((all) => all.filter((x) => x.id !== p.id))} className="text-xs font-bold text-muted">
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          {total < MAX_PEOPLE && (
            <button type="button" onClick={() => setPeople((all) => [...all, emptyPerson()])} className="self-start text-xs font-bold text-purple">
              + Add another person
            </button>
          )}
        </div>
      </Step>

      <Step n={2} title="Where is it?" hint="A photo of the place (empty is best), or just describe it.">
        {sets.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {sets.map((s) => (
              <button key={s.id} type="button" onClick={() => pickSet(s)} className="flex shrink-0 flex-col items-center rounded-xl border border-border bg-white p-1.5 text-[11px] font-semibold text-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.photoUrls?.[0] ?? s.photoUrl} alt={s.name} className="h-12 w-16 rounded-lg object-cover" />
                <span className="mt-0.5 max-w-20 truncate">{s.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {photos.location.map((ph) => (
            <Thumb key={ph.id} photo={ph} onRemove={() => setPhotos((all) => ({ ...all, location: all.location.filter((y) => y.id !== ph.id) }))} />
          ))}
          {photos.location.length < REF_LIMITS.location && <AddPhoto onFiles={(f) => addPlaceOrProduct("location", f)} />}
          <input
            aria-label="Describe the place"
            className="min-w-48 flex-1 rounded-lg border border-border px-2 py-2 text-sm"
            placeholder="e.g. a sunny corner office, 40th floor, wood panels"
            maxLength={300}
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </div>
      </Step>

      <Step n={3} title="What happens?" hint="Tell Lucy the idea in plain English - who does what, and anything they say. Lucy picks the camera angles, shots and timing.">
        <textarea
          aria-label="Describe what happens"
          className="w-full rounded-2xl border border-border bg-white p-3 text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
          rows={4}
          maxLength={4000}
          placeholder={example}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        {!showProduct && photos.product.length === 0 ? (
          <button type="button" onClick={() => setShowProduct(true)} className="mt-1 text-xs font-bold text-purple">
            + Selling something? Add a product photo
          </button>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted">Product (front + label):</span>
            {photos.product.map((ph) => (
              <Thumb key={ph.id} photo={ph} onRemove={() => setPhotos((all) => ({ ...all, product: all.product.filter((y) => y.id !== ph.id) }))} />
            ))}
            {photos.product.length < REF_LIMITS.product && <AddPhoto onFiles={(f) => addPlaceOrProduct("product", f)} />}
          </div>
        )}
      </Step>
    </div>
  );
}
