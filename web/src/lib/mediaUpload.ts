import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { uploadBufferToFal } from "./fal";

// Where to store a user's uploaded reference photo/audio before a model
// reads it (2026-09-27). Engines we call directly (Google Vertex, BytePlus
// ModelArk) get our own Vercel Blob storage, so no reseller touches those
// jobs at all; engines still served by fal keep fal storage (it's where
// their own pipeline expects inputs, and it auto-expires).
export async function uploadInputMedia(
  data: Buffer,
  contentType: string,
  fileName: string,
  provider: "fal" | "modelark" | "vertex",
): Promise<string> {
  if (provider === "fal" || !process.env.BLOB_READ_WRITE_TOKEN) return uploadBufferToFal(data, contentType, fileName);
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const blob = await put(`inputs/${randomUUID()}${ext}`, data, { access: "public", contentType, addRandomSuffix: false });
  return blob.url;
}
