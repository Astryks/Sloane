// Server-only: the hosted copy of each preset character photo that video
// models fetch as their input image. The browser only ever sees the
// /public copy in characters.ts - see mediaProxy.ts for why.
export const CHARACTER_INPUT_IMAGE_URL: Record<string, string> = {
  harper: "https://v3b.fal.media/files/b/0aa9eb60/yOpTgTwUZNYQcFCLsa822_harper.jpg",
  beth: "https://v3b.fal.media/files/b/0aa9eb60/Y2m8E19pk2G12R1ewoEYH_beth.jpg",
  vicky: "https://v3b.fal.media/files/b/0aa9eb60/GCrI6ghEIlnUFmhtS8X7v_vicky.jpg",
  marcus: "https://v3b.fal.media/files/b/0aa9fa6a/n5HtFS9LwobmqSacIVRGL_marcus_v3.jpg",
  jack: "https://v3b.fal.media/files/b/0aa9eb61/6_ml_AMMqKfis0tvQBm8G_jack.jpg",
};

export function characterInputImageUrl(id: string): string | null {
  return CHARACTER_INPUT_IMAGE_URL[id] ?? null;
}
