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
};

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

export function sheetAnglePrompt(angleId: SheetAngleId, description: string): string {
  const angle = SHEET_ANGLES.find((a) => a.id === angleId) ?? SHEET_ANGLES[0];
  return [
    "Using the reference photo(s), create ONE new photograph of the exact same person for a character reference sheet.",
    "Keep them identical: same face shape, eyes, nose, mouth, skin tone and texture, freckles or marks, hair colour, hairstyle and length, body type, age and the same clothes.",
    description ? `About them: ${description.trim().slice(0, 300)}.` : "",
    `Framing: ${angle.instruction}.`,
    "Plain light-grey studio background, soft even front light, no harsh shadows, nothing in their hands.",
    "Photorealistic, natural skin with real pores and fine detail, sharp focus. ONE single photo filling the frame - never a collage, grid or split screen. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}
