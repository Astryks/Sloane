// Auto-captions (2026-09-17, per direct request - "auto captions would be
// good too"). Runs Whisper entirely in the visitor's own browser via
// transformers.js (WASM/WebGPU, whichever the browser supports) inside a
// dedicated Worker so transcription - real CPU work, seconds to a couple
// minutes depending on clip length - never blocks the page's UI thread.
// Same zero-server-cost principle as the rest of /stitch: the only network
// fetch here is the model itself (a few dozen MB, whisper-tiny.en),
// downloaded straight from Hugging Face's CDN to the visitor's own
// browser and cached there after - our server is never involved.
import { pipeline, type AutomaticSpeechRecognitionPipeline, type ProgressInfo } from "@huggingface/transformers";

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

// Memoized across every call this worker ever receives - the model is
// downloaded/initialized once per page session, not once per clip.
function getTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      progress_callback: (info: ProgressInfo) => {
        self.postMessage({ type: "progress", info });
      },
    }) as unknown as Promise<AutomaticSpeechRecognitionPipeline>;
  }
  return transcriberPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, audio } = e.data as { type: string; audio?: Float32Array };
  if (type !== "transcribe" || !audio) return;
  try {
    const transcriber = await getTranscriber();
    const output = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });
    const result = Array.isArray(output) ? output[0] : output;
    self.postMessage({ type: "result", chunks: (result as { chunks?: unknown[] })?.chunks ?? [] });
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
