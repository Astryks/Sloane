// Large-file export helpers for the free stitch editor.
// Prefer WORKERFS so multi-GB browser File objects are never copied into MEMFS;
// only the selected trim window is remuxed/re-encoded into a small temp file.

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { FFFSType } from "@ffmpeg/ffmpeg";

export const LARGE_SOURCE_BYTES = 500 * 1024 * 1024;
export const LARGE_PROJECT_WARNING_BYTES = 1024 * 1024 * 1024;
/** Soft block when sum of *trimmed* windows (bitrate-scaled) exceeds this. */
export const ABSURD_EXPORT_PAYLOAD_BYTES = 2 * 1024 * 1024 * 1024;
export const LONG_SOURCE_SECONDS = 5 * 60;

export type ExtractKind = "video" | "audio";
export type ExtractProgress = (message: string) => void;

/**
 * Estimate how many bytes the selected windows will feed into the encoder
 * (not raw upload size). Used for soft warnings only.
 */
export function estimateTrimmedPayloadBytes(
  clips: Array<{ fileSize: number; fullDurationSec: number; trimStart: number; trimEnd: number }>,
): number {
  let total = 0;
  for (const clip of clips) {
    const full = Math.max(0.1, clip.fullDurationSec);
    const window = Math.max(0, clip.trimEnd - clip.trimStart);
    const bitrate = clip.fileSize / full;
    total += bitrate * window;
  }
  return Math.round(total);
}

async function mountSource(
  ffmpeg: FFmpeg,
  file: File,
  mountPoint: string,
  safeName: string,
): Promise<string> {
  await ffmpeg.createDir(mountPoint);
  await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: safeName, data: file }] }, mountPoint);
  return `${mountPoint}/${safeName}`;
}

/**
 * Materialize only [startSec, endSec] into a small MEMFS file.
 * Prefer WORKERFS mount of the original File; fall back to writeFile only
 * when the source is under LARGE_SOURCE_BYTES. Never writeFile a multi-GB file.
 */
export async function extractMediaWindow(
  ffmpeg: FFmpeg,
  file: File,
  outputName: string,
  startSec: number,
  endSec: number,
  kind: ExtractKind,
  writtenFiles: string[],
  mountedDirs: string[],
  onStep?: ExtractProgress,
  largeSourceBytes: number = LARGE_SOURCE_BYTES,
): Promise<{ windowSec: number }> {
  const start = Math.max(0, startSec);
  const end = Math.max(start + 0.05, endSec);
  const windowSec = end - start;
  const mountPoint = `/wf_${writtenFiles.length}_${Math.random().toString(36).slice(2, 8)}`;
  const safeName = kind === "video" ? "source.mp4" : "source.bin";
  let sourcePath: string | null = null;
  let mounted = false;
  let fullCopyName: string | null = null;

  try {
    onStep?.(`extracting section from ${file.name}…`);
    sourcePath = await mountSource(ffmpeg, file, mountPoint, safeName);
    mounted = true;
    mountedDirs.push(mountPoint);
  } catch {
    if (file.size > largeSourceBytes) {
      throw new Error(
        `Could not stream “${file.name}” (${Math.round(file.size / (1024 * 1024))}MB) without loading it into memory. Keep the selected window short and try Chrome/Edge, or split the edit into shorter sections.`,
      );
    }
    onStep?.(`copying ${file.name} into local FFmpeg…`);
    fullCopyName = `full_${outputName}`;
    const { fetchFile } = await import("@ffmpeg/util");
    await ffmpeg.writeFile(fullCopyName, await fetchFile(file));
    writtenFiles.push(fullCopyName);
    sourcePath = fullCopyName;
  }

  if (!sourcePath) throw new Error("Missing source path for extract");

  const copyArgs =
    kind === "video"
      ? [
          "-ss", String(start), "-to", String(end), "-i", sourcePath,
          "-map", "0:v:0", "-map", "0:a?", "-c", "copy",
          "-avoid_negative_ts", "make_zero", "-y", outputName,
        ]
      : [
          "-ss", String(start), "-to", String(end), "-i", sourcePath,
          "-map", "0:a:0", "-c", "copy",
          "-avoid_negative_ts", "make_zero", "-y", outputName,
        ];

  let exitCode = await ffmpeg.exec(copyArgs);
  if (exitCode !== 0) {
    onStep?.(`re-encoding short section from ${file.name}…`);
    await ffmpeg.deleteFile(outputName).catch(() => {});
    const reencodeArgs =
      kind === "video"
        ? [
            "-ss", String(start), "-to", String(end), "-i", sourcePath,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-c:a", "aac", "-ac", "2", "-ar", "44100", "-y", outputName,
          ]
        : [
            "-ss", String(start), "-to", String(end), "-i", sourcePath,
            "-vn", "-c:a", "aac", "-ac", "2", "-ar", "44100", "-y", outputName,
          ];
    exitCode = await ffmpeg.exec(reencodeArgs);
    if (exitCode !== 0) {
      throw new Error(
        `Could not extract the selected section from “${file.name}”. Try a shorter window (a few seconds to a minute), then export again.`,
      );
    }
  }

  writtenFiles.push(outputName);

  if (fullCopyName) {
    await ffmpeg.deleteFile(fullCopyName).catch(() => {});
    const idx = writtenFiles.indexOf(fullCopyName);
    if (idx >= 0) writtenFiles.splice(idx, 1);
  }

  if (mounted) {
    await ffmpeg.unmount(mountPoint).catch(() => {});
    const idx = mountedDirs.indexOf(mountPoint);
    if (idx >= 0) mountedDirs.splice(idx, 1);
    await ffmpeg.deleteDir(mountPoint).catch(() => {});
  }

  return { windowSec };
}

/** Best-effort WORKERFS / temp cleanup for export finally blocks. */
export async function cleanupExportFs(
  ffmpeg: FFmpeg,
  writtenFiles: string[],
  mountedDirs: string[],
): Promise<void> {
  for (const dir of [...mountedDirs].reverse()) {
    await ffmpeg.unmount(dir).catch(() => {});
    await ffmpeg.deleteDir(dir).catch(() => {});
  }
  mountedDirs.length = 0;
  for (const name of writtenFiles) {
    await ffmpeg.deleteFile(name).catch(() => {});
  }
}
