import Link from "next/link";

/**
 * Compact outbound stills generators — matches Prompt Guide “Others” public hrefs.
 * Flux skipped: PromptGuide points at blackforestlabs.ai with “via other tools” (no clean generator UI).
 * No fal/Higgsfield. Opens new tab.
 */
const STILLS_GENERATORS: { label: string; href: string }[] = [
  { label: "ChatGPT / GPT Image", href: "https://chatgpt.com" },
  { label: "Gemini", href: "https://gemini.google.com" },
  { label: "Midjourney", href: "https://www.midjourney.com" },
  { label: "Ideogram", href: "https://ideogram.ai" },
];

const linkChip =
  "rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-purple/40 hover:text-foreground";

type Props = {
  /** Show the muted “stills first…” helper line (empty-state CTA). Practice block usually has its own note. */
  showHelper?: boolean;
  className?: string;
};

export function MakeStillsOutboundLinks({ showHelper = true, className = "" }: Props) {
  return (
    <div className={className}>
      {showHelper && (
        <p className="mb-2 text-[11px] leading-snug text-muted">
          Stills first — make them here after you start, or outside and upload into each scene.
        </p>
      )}
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">Make stills</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {STILLS_GENERATORS.map((g) => (
          <a
            key={g.href}
            href={g.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkChip}
          >
            {g.label} ↗
          </a>
        ))}
        <Link href="/#prompt-guide" className={linkChip}>
          Prompt guide (stills) →
        </Link>
      </div>
    </div>
  );
}
