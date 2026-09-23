import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is Lucy Labs the same as Runway?",
    a: "No. Runway is its own creative suite and flagship models. Lucy Labs is a separate creative AI toolkit: pay-as-you-go video across leading models, prepaid stills, voice, /ads storyboards, and a free browser stitch editor. Lucy does not claim to match Runway feature-for-feature.",
  },
  {
    q: "When might someone prefer Lucy as a Runway alternative?",
    a: "Makers who want multi-model video generation plus stills, voice, ad storyboarding, and a free in-browser stitch tool in one web app — with pay-as-you-go video tryable without signup — may find Lucy a useful alternative path. Prefer Runway when you specifically need Runway’s own product and models.",
  },
  {
    q: "Where do I generate video on Lucy?",
    a: "On the home page at lucylabs.app. Open the Prompt Guide for prompting help, /ads for multi-scene storyboards, and /stitch to combine clips in your browser.",
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

const ROWS: { topic: string; runway: string; lucy: string }[] = [
  {
    topic: "Focus",
    runway: "Creative suite built around Runway’s own models and workflows",
    lucy: "Toolkit: multi-model pay-as-you-go video + stills + voice + stitch",
  },
  {
    topic: "Video",
    runway: "Generate and edit inside Runway’s product",
    lucy: "Pay-as-you-go clips across leading models; try without signup",
  },
  {
    topic: "Stills & ads",
    runway: "Depends on Runway’s current tools",
    lucy: "Prepaid stills on Lucy; /ads scene-by-scene storyboards",
  },
  {
    topic: "Longer cuts",
    runway: "In-product editing (Runway’s own)",
    lucy: "Free /stitch browser editor — processing stays on your device",
  },
];

export default function RunwayAlternativePage() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Runway alternative for AI video"
          subtitle="For makers who want multi-model video, stills, voice, and free browser stitch — not a Runway clone."
        />

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Honest take</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              Searching for a <strong className="text-foreground">Runway alternative</strong>? Lucy
              Labs helps you generate AI videos and stills, add voice, storyboard ads, and stitch
              longer cuts in a free browser editor. Lucy is a creative AI toolkit — it is{" "}
              <strong className="text-foreground">not identical</strong> to Runway.
            </p>
            <p>
              Choose Lucy when you want pay-as-you-go access across leading video models plus
              stills, voice,{" "}
              <Link href="/ads" className="font-semibold text-purple hover:underline">
                /ads
              </Link>{" "}
              storyboards, and{" "}
              <Link href="/stitch" className="font-semibold text-purple hover:underline">
                /stitch
              </Link>
              . Prefer Runway when you specifically want Runway’s suite and models.
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Quick compare</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="py-2 pr-3 font-extrabold text-foreground">Topic</th>
                  <th className="py-2 pr-3 font-extrabold text-foreground">Runway (typical)</th>
                  <th className="py-2 font-extrabold text-foreground">Lucy Labs</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.topic} className="border-b border-border/40 align-top">
                    <td className="py-3 pr-3 font-semibold text-foreground">{row.topic}</td>
                    <td className="py-3 pr-3 text-muted">{row.runway}</td>
                    <td className="py-3 text-muted">{row.lucy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:opacity-95"
            >
              Try Lucy video
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
            More context:{" "}
            <Link href="/about" className="font-semibold text-purple hover:underline">
              About
            </Link>
            ,{" "}
            <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">
              Prompt Guide
            </Link>
            .
          </p>
        </section>

        <Footer />
      </main>
    </div>
  );
}
