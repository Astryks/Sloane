import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is Lucy a replacement for ElevenLabs?",
    a: "No. ElevenLabs specializes in voice AI. Lucy Labs is a creative AI toolkit that includes text-to-speech and voice cloning alongside AI video, stills, /ads storyboards, and a free stitch editor. Lucy does not claim feature parity with ElevenLabs’ full voice platform.",
  },
  {
    q: "When does Lucy make sense vs a voice-only tool?",
    a: "When you want voice in the same workflow as pay-as-you-go video, stills, and browser stitch. Stick with a voice-first product when you only need advanced voice tooling.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function ElevenLabsAlternativePage() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Voice + AI video toolkit"
          subtitle="Beyond voice-only tools — Lucy pairs voice with video, stills, and free stitch."
        />

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Short compare</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              People comparing <strong className="text-foreground">ElevenLabs</strong> often want
              best-in-class voice. Lucy Labs is different: a creative AI toolkit where voice sits
              next to AI video generation, prepaid stills,{" "}
              <Link href="/ads" className="font-semibold text-purple hover:underline">
                /ads
              </Link>{" "}
              storyboards, and a free{" "}
              <Link href="/stitch" className="font-semibold text-purple hover:underline">
                /stitch
              </Link>{" "}
              editor. Lucy is <strong className="text-foreground">not identical</strong> to
              ElevenLabs.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">ElevenLabs (typical)</strong> — deep voice AI
                platform.
              </li>
              <li>
                <strong className="text-foreground">Lucy Labs</strong> — text-to-speech and voice
                cloning (cloning needs account + paid plan) plus multi-model video, stills, and
                stitch.
              </li>
            </ul>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/#voice"
              className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:opacity-95"
            >
              Try voice on Lucy
            </Link>
            <Link
              href="/ai-video"
              className="rounded-full border border-border bg-white/80 px-5 py-2.5 text-sm font-semibold text-foreground shadow-soft transition hover:bg-white"
            >
              AI video generation
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">FAQ</h2>
          <dl className="mt-4 flex flex-col gap-5">
            {FAQS.map((item) => (
              <div key={item.q}>
                <dt className="text-sm font-extrabold text-foreground">{item.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-muted">
            <Link href="/about" className="font-semibold text-purple hover:underline">
              About Lucy
            </Link>{" "}
            ·{" "}
            <Link href="/billing" className="font-semibold text-purple hover:underline">
              Pricing
            </Link>
          </p>
        </section>

        <Footer />
      </main>
    </div>
  );
}
