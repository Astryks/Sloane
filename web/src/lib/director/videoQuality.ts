// Draft / Final quality for director films (2026-09-30). Server-only.
//
// Draft = today's behaviour: 720p on the engine the customer picked (Veo 3.1
// Fast for "veo", Veo 3.1 for "veo31").
// Final = 1080p on the GA Veo 3.1 model (veo-3.1-generate-001).
//
// Pricing (checked 2026-09-30 against secondary price trackers - Sid should
// confirm on the Vertex pricing page): Veo 3.1 standard is the same per second
// at 720p and 1080p, so Final on "veo31" costs us the same as today's veo31
// shot. Final on "veo" switches Fast -> standard (~4x our cost), so it is NOT
// offered to customers at the Fast price. Credits and shot prices are not
// changed here: Final is owner-only unless DIRECTOR_FINAL_FOR_VEO31=1 opens it
// to customers on veo31 (price unchanged).

import { isOwner } from "../owner";
import type { User } from "../db";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "../videoPaygo";
import { isVertexEndpoint, vertexEndpointToken, VERTEX_VEO_STANDARD_MODEL } from "../vertexVeo";
import type { DirectorPlan, FilmQuality } from "./plan";

/** Engines where Final can run at all: Veo 3.1 Fast / Standard on Vertex (Lite has no 1080p reference path). */
export function finalCapable(engine: VideoEngine): boolean {
  if (engine !== "veo" && engine !== "veo31") return false;
  return isVertexEndpoint(VIDEO_PAYGO_ENGINES[engine]?.falEndpoint);
}

export function finalAllowed(engine: VideoEngine, owner: boolean): boolean {
  if (!finalCapable(engine)) return false;
  if (owner) return true;
  return engine === "veo31" && process.env.DIRECTOR_FINAL_FOR_VEO31 === "1";
}

export function finalAllowedFor(engine: VideoEngine, user: Pick<User, "email" | "is_guest"> | null | undefined): boolean {
  return finalAllowed(engine, isOwner(user ?? null));
}

/** The quality a film actually gets: Final only when asked for AND allowed. */
export function effectiveQuality(plan: Pick<DirectorPlan, "quality">, engine: VideoEngine, owner: boolean): FilmQuality {
  return plan.quality === "final" && finalAllowed(engine, owner) ? "final" : "draft";
}

/** Final renders on the GA Veo 3.1 model at 1080p. */
export const FINAL_ENDPOINT = vertexEndpointToken(VERTEX_VEO_STANDARD_MODEL);
export const FINAL_RESOLUTION = "1080p";
