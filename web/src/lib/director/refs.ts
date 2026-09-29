// "Directed by Lucy" reference photos (2026-09-27). Pure, safe on client and
// server.
//
// Customers can add several photos per slot - e.g. a character sheet (front,
// three-quarters, profile, full body, back) - so faces hold from every angle.
// Google's image models (Nano Banana Pro / 2 / Lite) accept at most 14 images
// per picture, so the slots add up to exactly 14.

export type RefKind = "character" | "product" | "location";

export const REF_LIMITS: Record<RefKind, number> = { character: 8, product: 3, location: 3 };
export const MAX_REFS_PER_IMAGE = 14;

/** Stored on director_films.refs. The singular keys are the first photo (older films only have those). */
export type DirectorRefs = {
  character?: string;
  product?: string;
  location?: string;
  characters?: string[];
  products?: string[];
  locations?: string[];
  /** Named cast from Your cast (2026-09-29): their photos, in order, make up `characters`. */
  people?: CastPerson[];
};

export type CastPerson = {
  name: string;
  description: string;
  photos: string[];
  /** Lucy voice to lock to ("" = keep the voice from their first speaking shot). */
  voiceId?: string;
  /** Locked reference voice (WAV) once known; "none" = couldn't make one. */
  voiceRef?: string;
  voiceJob?: string;
  /** Shot the reference came from - it keeps its original audio. */
  voiceShot?: number;
};
export const MAX_CAST = 3;

/** Shares the 8 character slots fairly between up to 3 people (first photos first: face, 3/4s...). */
export function allocateCast(people: CastPerson[]): CastPerson[] {
  const list = people.slice(0, MAX_CAST);
  const each = Math.max(1, Math.floor(REF_LIMITS.character / Math.max(1, list.length)));
  return list.map((p) => ({ ...p, photos: p.photos.slice(0, each) }));
}

/**
 * Tells the image model who is who: "Images 3, 4 and 5 show Victor (...)".
 * Built from the final ordered image list, so it's right for any prompt.
 */
export function castLegend(ordered: string[], people: CastPerson[] | undefined): string {
  if (!people?.length) return "";
  const parts = people
    .map((p) => {
      const idx = p.photos.map((u) => ordered.indexOf(u) + 1).filter((n) => n > 0);
      if (!idx.length) return "";
      const which = idx.length === 1 ? `Image ${idx[0]} shows` : `Images ${idx.slice(0, -1).join(", ")} and ${idx[idx.length - 1]} show`;
      return `${which} ${p.name}${p.description ? ` (${p.description.slice(0, 160)})` : ""}`;
    })
    .filter(Boolean);
  if (!parts.length) return "";
  return `Who is who in the reference images: ${parts.join("; ")}. Keep each person's face, hair and build exactly as in their own images - never mix faces between people.`;
}

const LIST_KEY = { character: "characters", product: "products", location: "locations" } as const;

export function refList(refs: DirectorRefs | null | undefined, kind: RefKind): string[] {
  const list = refs?.[LIST_KEY[kind]];
  if (Array.isArray(list) && list.length) return list.filter((u) => typeof u === "string" && !!u);
  const single = refs?.[kind];
  return single ? [single] : [];
}

export function buildRefs(lists: Record<RefKind, string[]>): DirectorRefs {
  const out: DirectorRefs = {};
  for (const kind of ["character", "product", "location"] as const) {
    const list = lists[kind].slice(0, REF_LIMITS[kind]);
    if (!list.length) continue;
    out[kind] = list[0];
    out[LIST_KEY[kind]] = list;
  }
  return out;
}

/** Order matters to the image model (prompts refer to "the first image"); duplicates dropped, capped at 14. */
export function orderedRefs(...groups: Array<Array<string | null | undefined>>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of groups.flat()) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out.slice(0, MAX_REFS_PER_IMAGE);
}

// The standard character-sheet angles (what creators use for Nano Banana /
// Seedance / Kling references): a clean face close-up, both three-quarters,
// a profile, full body and the back - on a plain background so nothing but
// the person carries into the film.
export const SHEET_ANGLES = [
  { id: "face", label: "Face close-up", instruction: "a head-and-shoulders close-up, facing the camera straight on, neutral relaxed expression" },
  { id: "left34", label: "3/4 left", instruction: "a head-and-shoulders shot with the head and body turned three-quarters to their left" },
  { id: "right34", label: "3/4 right", instruction: "a head-and-shoulders shot with the head and body turned three-quarters to their right" },
  { id: "profile", label: "Side profile", instruction: "a head-and-shoulders side profile, facing left, the whole side of the face visible" },
  { id: "full", label: "Full body", instruction: "a full-body shot, head to toe, standing naturally and facing the camera, arms relaxed" },
  { id: "back", label: "Back view", instruction: "a full-body shot from behind, head to toe, showing the back of the hair and clothes" },
] as const;

export type SheetAngleId = (typeof SHEET_ANGLES)[number]["id"];

export function sheetAnglePrompt(angleId: SheetAngleId, description: string, outfit = ""): string {
  const angle = SHEET_ANGLES.find((a) => a.id === angleId) ?? SHEET_ANGLES[0];
  const newOutfit = outfit.trim().slice(0, 300);
  return [
    "Using the reference photo(s), create ONE new photograph of the exact same person for a character reference sheet.",
    newOutfit
      ? "Keep them identical: same face shape, eyes, nose, mouth, skin tone and texture, freckles or marks, hair colour, hairstyle and length, body type and age."
      : "Keep them identical: same face shape, eyes, nose, mouth, skin tone and texture, freckles or marks, hair colour, hairstyle and length, body type, age and the same clothes.",
    // 2026-09-29: change the outfit, keep the person.
    newOutfit ? `Change ONLY their clothes - they now wear: ${newOutfit}. Nothing of the old outfit remains.` : "",
    description ? `About them: ${description.trim().slice(0, 300)}.` : "",
    `Framing: ${angle.instruction}.`,
    "Plain light-grey studio background, soft even front light, no harsh shadows, nothing in their hands.",
    "Photorealistic, natural skin with real pores and fine detail, sharp focus. ONE single photo filling the frame - never a collage, grid or split screen. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

// Lucy makes the character sheet herself for every film with a person in it
// (2026-09-27): no photo -> a face portrait from the plan's description,
// then these angles; one or two photos -> just these angles. Three angles
// cover what films actually show (both three-quarters + full body) for
// ~3 Google images per film.
export const AUTO_CAST_ANGLES: SheetAngleId[] = ["left34", "right34", "full"];
/** Customers who already added this many character photos have their own sheet. */
export const AUTO_CAST_MAX_EXISTING = 2;

export function characterFromTextPrompt(character: string, wardrobe: string): string {
  return [
    "Create ONE photorealistic head-and-shoulders portrait photograph of an original person (not a celebrity) for a film's character reference sheet.",
    `The person: ${character.trim().slice(0, 400)}.`,
    wardrobe ? `Wearing: ${wardrobe.trim().slice(0, 200)}.` : "",
    "Facing the camera straight on, relaxed natural expression. Plain light-grey studio background, soft even front light.",
    "Real skin texture with pores and fine detail, natural imperfections, sharp focus. ONE single photo - never a collage or grid. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

// ---- Location sheets (2026-09-29) ----
// A set made from words: one establishing view, then the same place from
// two more camera positions, always empty, so every scene filmed there
// matches. Saved to "Your sets" like a cast member.
export const LOCATION_ANGLES = [
  { id: "wide", label: "Wide", instruction: "a wide establishing view from the entrance, showing the whole space" },
  // 2026-09-29: "main" kept coming back as a near-copy of "wide" - force a real move.
  { id: "main", label: "Main view", instruction: "a completely different camera position from the first image: standing in the middle of the space, turned about 90 degrees to look across the main area where the action happens, closer and at eye level - it must NOT repeat the first image's framing" },
  { id: "reverse", label: "Reverse", instruction: "the reverse angle - from the far side of the space looking back toward the entrance" },
] as const;
export type LocationAngleId = (typeof LOCATION_ANGLES)[number]["id"];

const ORDINAL = ["FIRST", "SECOND", "THIRD", "FOURTH"];

export function locationAnglePrompt(
  angleId: LocationAngleId,
  description: string,
  fromReference: boolean,
  logo?: { placement: string },
  art?: { placement: string },
): string {
  const angle = LOCATION_ANGLES.find((a) => a.id === angleId) ?? LOCATION_ANGLES[0];
  // Reference order: [room (if any), logo (if any), artwork (if any)].
  let next = fromReference ? 1 : 0;
  const logoImage = logo ? `the ${ORDINAL[next++]} image` : "";
  const artImage = art ? `the ${ORDINAL[next++]} image` : "";
  return [
    fromReference
      ? "Using the FIRST image, show the SAME place from a new camera position: identical architecture, furniture, colours, materials, light and time of day."
      : "Create ONE photorealistic film-set photograph of this place:",
    `${description.trim().slice(0, 600)}.`,
    `Camera: ${angle.instruction}.`,
    // 2026-09-29: a brand logo built into the set, never pasted on top.
    logo
      ? `${logoImage[0].toUpperCase()}${logoImage.slice(1)} is a company logo. Build it into the room as a real physical object - ${logo.placement.trim().slice(0, 200) || "brushed-metal letters mounted on a wall"} - reproducing its exact shape and lettering, lit by the room's own light with real shadows and reflections. If this camera angle can't see that spot, leave it out. No other logos or text.`
      : "",
    // 2026-09-29: the customer's own artwork hung in the set.
    art
      ? `${artImage[0].toUpperCase()}${artImage.slice(1)} is an artwork. Hang it as large framed canvases - ${art.placement.trim().slice(0, 200) || "on the main walls"} - the same painting and others in exactly the same hand, style, brushwork and palette, lit by the room's light.`
      : "",
    "Completely EMPTY - no people, no hands, no faces (except faces inside paintings).",
    "Cinematic, physically real light and materials, natural depth of field, 35mm film look. ONE single photo filling the frame - never a collage or grid. No text, no watermark.",
  ].join(" ");
}
