import type { MetadataRoute } from "next";

const siteUrl = "https://lucylabs.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const paths: { path: string; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"]; priority: number }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/ai-video-generation", changeFrequency: "weekly", priority: 0.95 },
    { path: "/models", changeFrequency: "weekly", priority: 0.85 },
    { path: "/models/seedance", changeFrequency: "monthly", priority: 0.7 },
    { path: "/models/veo", changeFrequency: "monthly", priority: 0.7 },
    { path: "/models/kling", changeFrequency: "monthly", priority: 0.7 },
    { path: "/text-to-video", changeFrequency: "monthly", priority: 0.8 },
    { path: "/image-to-video", changeFrequency: "monthly", priority: 0.75 },
    { path: "/text-to-voice", changeFrequency: "monthly", priority: 0.7 },
    { path: "/ai-prompting", changeFrequency: "monthly", priority: 0.75 },
    { path: "/about", changeFrequency: "monthly", priority: 0.7 },
    { path: "/ads", changeFrequency: "weekly", priority: 0.8 },
    { path: "/stitch", changeFrequency: "weekly", priority: 0.8 },
    { path: "/billing", changeFrequency: "monthly", priority: 0.6 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/alternatives/runway", changeFrequency: "monthly", priority: 0.65 },
    { path: "/alternatives/pika", changeFrequency: "monthly", priority: 0.55 },
    { path: "/alternatives/luma", changeFrequency: "monthly", priority: 0.55 },
    { path: "/alternatives/elevenlabs", changeFrequency: "monthly", priority: 0.5 },
  ];
  return paths.map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path === "/" ? "/" : path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
