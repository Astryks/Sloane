import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "Is this a film school?",
    a: "No — it is a curated link + craft-note library so creators can study publicly available films/ads, then practice original prompts on Lucy.",
  },
];

const GROUPS: { title: string; items: { href: string; label: string; blurb: string }[] }[] = [
  {
    title: "Camera & shot craft",
    items: [
      { href: "/camera-moves", label: "Camera moves", blurb: "Pan, tilt, dolly, whip, orbit, crane, handheld, static, rack focus" },
      { href: "/shot-composition", label: "Shot composition", blurb: "Thirds, leading lines, negative space, OTS" },
      { href: "/blocking-and-staging", label: "Blocking & staging", blurb: "Where people move relative to camera" },
      { href: "/famous-long-takes", label: "Famous long takes", blurb: "Goodfellas, Touch of Evil, 1917…" },
      { href: "/famous-opening-shots", label: "Famous opening shots", blurb: "Cold opens that teach world & tone" },
    ],
  },
  {
    title: "Films, trailers, cinematography",
    items: [
      { href: "/study-great-films", label: "IMDb-inspired study list", blurb: "~20 Top-250-adjacent films with craft notes" },
      { href: "/study-trailers-and-scenes", label: "Trailers & scenes", blurb: "Most-watched trailer contenders + VF breakdowns" },
      { href: "/oscar-cinematography", label: "Oscar cinematography", blurb: "Light & lens lessons" },
    ],
  },
  {
    title: "Ads & music / TV motion",
    items: [
      { href: "/ad-inspiration", label: "Ad inspiration", blurb: "Super Bowl & classic spots (links)" },
      { href: "/award-winning-ads", label: "Award-winning ads", blurb: "Cannes / D&AD starting points" },
      { href: "/music-videos-to-study", label: "Music videos", blurb: "Camera & edit landmarks" },
      { href: "/tv-title-sequences", label: "TV title sequences", blurb: "Tone in 90 seconds" },
    ],
  },
  {
    title: "Make on Lucy",
    items: [
      { href: "/video-styles", label: "Video styles", blurb: "UGC, cinematic, demo, unboxing…" },
      { href: "/ugc-ad", label: "Make a UGC ad", blurb: "Stills → storyboard → clips" },
      { href: "/ai-music-video", label: "AI music video", blurb: "Honest sync path" },
      { href: "/storyboard-to-video", label: "Storyboard to video", blurb: "Start a storyboard = Lucy project" },
      { href: "/consistent-character", label: "Consistent character", blurb: "@Image refs & angles" },
      { href: "/model-reviews", label: "Model reviews", blurb: "Public-source Seedance / Veo / Kling" },
    ],
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Filmmaking study hubs"
          subtitle="Learn camera language from public films & ads — then practice original prompts on Lucy."
        />
        <SeoCard title="Start here">
          <StudyHubNav current="/study-film" />
          <CtaRow
            primaryHref="/camera-moves"
            primaryLabel="Camera moves"
            secondaryHref="/#prompt-guide"
            secondaryLabel="Prompt Guide"
          />
        </SeoCard>
        {GROUPS.map((g) => (
          <SeoCard key={g.title} title={g.title}>
            <ul className="list-disc space-y-2 pl-5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="font-semibold text-purple hover:underline">
                    {i.label}
                  </Link>{" "}
                  — {i.blurb}
                </li>
              ))}
            </ul>
          </SeoCard>
        ))}
        <SeoCard title="Create">
          <CtaRow primaryHref="/ads" primaryLabel="Start a storyboard" secondaryHref="/" secondaryLabel="Generate video" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
