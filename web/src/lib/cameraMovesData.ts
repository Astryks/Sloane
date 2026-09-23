/** Shared camera-move copy for GEO /camera-moves (matches Prompt Guide CameraMoveChooser prompts). */
export type CameraMoveSeo = {
  id: string;
  title: string;
  group: string;
  does: string;
  when: string;
  prompt: string;
  note?: string;
};

export const CAMERA_MOVES_SEO: CameraMoveSeo[] = [
  {
    id: "pan",
    title: "Pan (left / right)",
    group: "Pan",
    does: "Camera rotates on a fixed spot; the frame slides sideways. Horizon stays level.",
    when: "Follow a gaze, reveal what enters frame, redirect attention inside one space.",
    prompt:
      "camera slowly pans right to reveal what enters frame, horizon stays level, no zoom, one move only",
  },
  {
    id: "tilt",
    title: "Tilt (up / down)",
    group: "Tilt",
    does: "Lens tips up or down; reveals height, sky, ground, or a detail.",
    when: "Power / architecture (tilt up); find a product or settle a beat (tilt down).",
    prompt:
      "camera slowly tilts up from her chest to her face then the skyline above, she stays centered, motivated by her gaze, one move only",
  },
  {
    id: "dolly-track",
    title: "Dolly / tracking",
    group: "Dolly / tracking",
    does: "Camera physically travels with or past the subject (track left/right, dolly in/out).",
    when: "Walk-and-talk, keep a walker moving without cutting, intimacy (dolly in), reveal scale (dolly out).",
    prompt:
      "camera tracks left beside her as she walks, keep her torso framed medium and centered, horizon level, one move only",
  },
  {
    id: "push-pull",
    title: "Push-in / pull-out",
    group: "Push-in / pull-out",
    does: "Optical or framing push/pull — subject fills or leaves frame without a hard cut.",
    when: "Rising tension on a face; release into geography.",
    prompt:
      "camera slowly pushes in toward her eyes, she stays centered in frame, soft breathing only, hold the final close frame clean — one move only",
  },
  {
    id: "whip-pan",
    title: "Whip pan",
    group: "Whip pan",
    does: "Fast blur pan between two clear end-frames.",
    when: "Energy cut without an edit — use sparingly.",
    prompt:
      "fast whip pan left with motion blur between two clear sharp end-frames, start sharp and land sharp, use once only",
  },
  {
    id: "orbit",
    title: "Orbit / arc",
    group: "Orbit / arc",
    does: "Camera circles the subject; the world slides, the subject stays centered.",
    when: "Spectacle, product hero, bullet-time energy.",
    prompt:
      "camera slowly arcs around her, she stays centered and mostly still while the background slides past, one move only",
  },
  {
    id: "crane",
    title: "Crane / boom",
    group: "Crane / boom",
    does: "Camera rises or descends for height and scale.",
    when: "Open on a world, exit a scene with lift, hero moment.",
    prompt:
      "camera slowly rises from eye-level up to a high wide shot, she shrinks slightly in frame as more of the location appears, one move only",
  },
  {
    id: "handheld",
    title: "Handheld",
    group: "Handheld",
    does: "Slight organic sway — phone / documentary energy (not shake-cam).",
    when: "UGC, selfie, walk-and-talk authenticity.",
    prompt:
      "slight handheld camera sway at eye level, soft natural phone-selfie energy — not shake-cam, keep her face readable",
  },
  {
    id: "static",
    title: "Static locked-off",
    group: "Static locked-off",
    does: "Tripod-still; nothing moves except the subject.",
    when: "Land a payoff, read a label, freeze emotion clean.",
    prompt:
      "camera locked still on a fixed tripod frame, only her soft breathing moves, hold the final frame clean",
  },
  {
    id: "rack-focus",
    title: "Rack focus",
    group: "Rack focus",
    does: "Focus shifts from near to far (or reverse); frame stays put.",
    when: "Redirect attention without moving camera — dialogue, product vs face.",
    prompt:
      "focus pulls from the product in the foreground to her eyes, camera frame stays locked still, one focus pull only",
    note:
      "Honest for AI video: models may approximate focus pulls unevenly. Prefer locking the frame and describing a clear near→far attention shift; verify on your chosen Lucy model.",
  },
];
