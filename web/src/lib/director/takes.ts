// Hero takes (2026-09-30): director_shots.alt_video_urls is a JSON array of URLs.
export function parseTakes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string" && t.startsWith("https://")).slice(0, 4) : [];
  } catch {
    return [];
  }
}
