/** Official YouTube iframe embed with title + channel attribution. */
export function YoutubeEmbed({
  videoId,
  title,
  channel,
}: {
  videoId: string;
  title: string;
  channel: string;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-black/5">
      <div className="relative aspect-video w-full">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <figcaption className="border-t border-border bg-white/70 px-3 py-2 text-xs text-muted">
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          className="font-semibold text-purple hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {title}
        </a>
        <span> — {channel} (YouTube)</span>
      </figcaption>
    </figure>
  );
}
