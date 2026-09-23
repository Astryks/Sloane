import type { MetadataRoute } from "next";

const siteUrl = "https://lucylabs.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/ai-video`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/about`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/ads`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/stitch`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/billing`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/alternatives/runway`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/alternatives/kling`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/alternatives/elevenlabs`, lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
