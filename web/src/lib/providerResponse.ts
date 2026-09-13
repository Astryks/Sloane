type ProviderRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ProviderRecord {
  return typeof value === "object" && value !== null;
}

export function findNestedString(payload: unknown, keys: readonly string[], depth = 0): string | null {
  if (depth > 6 || !isRecord(payload)) return null;

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const value of Object.values(payload)) {
    const found = findNestedString(value, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

export function findNestedStatus(payload: unknown): string | null {
  return findNestedString(payload, ["status"]);
}

export function findNestedMediaUrl(payload: unknown, media: "audio" | "video"): string | null {
  if (!isRecord(payload)) return null;

  const direct = payload[`${media}_url`];
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const mediaPayload = payload[media];
  if (isRecord(mediaPayload)) {
    const nestedUrl = mediaPayload.url;
    if (typeof nestedUrl === "string" && nestedUrl.trim()) return nestedUrl.trim();
  }

  for (const value of Object.values(payload)) {
    const found = findNestedMediaUrl(value, media);
    if (found) return found;
  }
  return null;
}