import Link from "next/link";

const HUBS: { href: string; label: string }[] = [
  { href: "/study-film", label: "Study index" },
  { href: "/camera-moves", label: "Camera moves" },
  { href: "/video-styles", label: "Video styles" },
  { href: "/study-great-films", label: "Great films" },
  { href: "/study-trailers-and-scenes", label: "Trailers & scenes" },
  { href: "/ad-inspiration", label: "Ad inspiration" },
  { href: "/famous-long-takes", label: "Long takes" },
  { href: "/famous-opening-shots", label: "Opening shots" },
  { href: "/music-videos-to-study", label: "Music videos" },
  { href: "/tv-title-sequences", label: "TV titles" },
  { href: "/award-winning-ads", label: "Award ads" },
  { href: "/oscar-cinematography", label: "Oscar cinematography" },
  { href: "/shot-composition", label: "Composition" },
  { href: "/blocking-and-staging", label: "Blocking" },
  { href: "/model-reviews", label: "Model reviews" },
];

export function StudyHubNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Filmmaking study hubs" className="flex flex-wrap gap-2">
      {HUBS.map((h) => (
        <Link
          key={h.href}
          href={h.href}
          className={
            h.href === current
              ? "rounded-full bg-purple/15 px-3 py-1 text-xs font-bold text-purple"
              : "rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-semibold text-foreground hover:bg-white"
          }
        >
          {h.label}
        </Link>
      ))}
    </nav>
  );
}
