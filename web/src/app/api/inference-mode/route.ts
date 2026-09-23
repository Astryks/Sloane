import { getInferenceBackend } from "@/lib/inferenceBackend";
import { publicJson } from "@/lib/mediaProxy";

// Public, read-only - lets the client know whether to show the cold-start
// copy ("can take up to a few minutes") for Serverless, or skip it for Pod
// (always warm). Not sensitive: just says which backend is active, same
// info visible from how fast generation actually responds.
export async function GET() {
  try {
    return publicJson({ mode: await getInferenceBackend() });
  } catch (err) {
    console.error("[inference-mode] failed to read mode", err);
    return publicJson({ error: "Could not read inference mode." }, { status: 502 });
  }
}
