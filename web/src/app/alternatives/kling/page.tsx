import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does Lucy replace Kling’s own product?",
    a: "No. Kling AI (and related Kling labs) are their own products. Lucy Labs is a creative AI toolkit that offers Kling among other leading video models, plus stills, voice, /ads storyboards, and a free stitch editor. Lucy is not identical to Kling’s first-party lab.",
  },
  {
    q: "Why use Lucy if I mainly care about Kling?",
    a: "If you want Kling-quality clips inside a broader workflow — stills on Lucy, Prompt Guide, multi-scene /ads, voice, and browser stitch — Lucy packages those together with pay-as-you-go video. If you only need Kling’s first-party experience, use Kling directly.",
  },
  {
    q: "Is Kling the only model on Lucy?",
    a: "No. Lucy’s homepage pay-as-you-go video spans leading models (including Kling, Veo, Seedance, and others shown in the live UI). Model availability and notes update on the home page.",
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

export default function KlingAlternativePage() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Kling alternative — multi-model toolkit"
          subtitle="Kling among leading models on Lucy, plus stills, voice, storyboards, and free stitch."
        />

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Honest take</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              Searching for a <strong className="text-foreground">Kling alternative</strong> or a
              broader toolkit around Kling-style AI video? Lucy Labs is not a rebrand of Kling’s
              own lab. It is a creative AI toolkit where{" "}
              <strong className="text-foreground">Kling is one of several leading video models</strong>{" "}
              you can use for pay-as-you-go clips — alongside stills, voice,{" "}
              <Link href="/ads" className="font-semibold text-purple hover:underline">
                /ads
              </Link>{" "}
              storyboards, and a free{" "}
              <Link href="/stitch" className="font-semibold text-purple hover:underline">
                /stitch
              </Link>{" "}
              editor.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Lucy fits</strong> when you want multi-model
                video + stills + voice + storyboard/stitch helpers in one web app.
              </li>
              <li>
                <strong className="text-foreground">Prefer Kling directly</strong> when you want
                Kling’s first-party product only.
              </li>
              <li>
                In Lucy’s Harper comparison work, Kling and Veo looked strongest among the
                in-Lucy tests — see the{" "}
                <Link href="/#ai-models-review" className="font-semibold text-purple hover:underline">
                  AI models review
                </Link>{" "}
                on the home page.
              </li>
            </ul>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:opacity-95"
            >
              Generate on Lucy
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
            Also see{" "}
            <Link href="/alternatives/runway" className="font-semibold text-purple hover:underline">
              Runway alternative
            </Link>{" "}
            and{" "}
            <Link href="/about" className="font-semibold text-purple hover:underline">
              About
            </Link>
            .
          </p>
        </section>

        <Footer />
      </main>
    </div>
  );
}
