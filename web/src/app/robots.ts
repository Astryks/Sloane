import type { MetadataRoute } from "next";

const siteUrl = "https://lucylabs.app";

const publicDisallow = ["/api/", "/admin", "/account", "/ad-studio"];

// Explicit allow rules for assistant / extended crawlers so discovery is not
// blocked if a host-level or future "*" rule tightens. Same public paths as "*".
const assistantBots = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: publicDisallow,
      },
      ...assistantBots.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: publicDisallow,
      })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
