import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "Why diagrams instead of famous stills?",
    a: "Copyright: we avoid rehosting film frames when rights are unclear. Original SVG diagrams + outbound study links keep the lesson legal.",
  },
];

function DiagramThirds() {
  return (
    <svg viewBox="0 0 240 135" className="w-full rounded-xl border border-border bg-white/80" aria-hidden>
      <rect width="240" height="135" fill="#f8f5ff" />
      <path d="M80 0v135M160 0v135M0 45h240M0 90h240" stroke="#7c5cff" strokeOpacity="0.35" strokeWidth="1" />
      <circle cx="160" cy="45" r="14" fill="#7c5cff" fillOpacity="0.25" stroke="#7c5cff" />
      <text x="12" y="20" fontSize="10" fill="#5b5675">Rule of thirds — subject on intersection</text>
    </svg>
  );
}

function DiagramLeading() {
  return (
    <svg viewBox="0 0 240 135" className="w-full rounded-xl border border-border bg-white/80" aria-hidden>
      <rect width="240" height="135" fill="#f8f5ff" />
      <path d="M20 110 L140 50 L220 40" stroke="#e8b84a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="140" cy="50" r="12" fill="#7c5cff" fillOpacity="0.3" stroke="#7c5cff" />
      <text x="12" y="20" fontSize="10" fill="#5b5675">Leading lines — roads, edges, arms</text>
    </svg>
  );
}

function DiagramNeg() {
  return (
    <svg viewBox="0 0 240 135" className="w-full rounded-xl border border-border bg-white/80" aria-hidden>
      <rect width="240" height="135" fill="#f8f5ff" />
      <circle cx="70" cy="80" r="22" fill="#7c5cff" fillOpacity="0.25" stroke="#7c5cff" />
      <text x="120" y="70" fontSize="10" fill="#5b5675">Negative space</text>
      <text x="120" y="86" fontSize="10" fill="#5b5675">carries mood / isolation</text>
    </svg>
  );
}

const LESSONS = [
  {
    title: "Rule of thirds",
    body: "Place eyes or product near intersections, not dead center — unless you want formal/iconic center punch (Fury Road energy).",
    prompt: "medium close-up, eyes on the upper-third line, soft side light, background quiet",
    diagram: "thirds",
  },
  {
    title: "Leading lines",
    body: "Roads, corridors, counters, arms — lines that point at the subject. Great for product-on-table lifestyle.",
    prompt: "desk leading lines toward the product in the distance third, slow push-in, one move only",
    diagram: "leading",
  },
  {
    title: "Negative space",
    body: "Empty area is a character. Isolation, dread, luxury minimalism.",
    prompt: "subject small in the lower-left third, large quiet negative space, static lock-off",
    diagram: "neg",
  },
  {
    title: "Over-the-shoulder (OTS)",
    body: "Foreground shoulder frames the listener. Dialogue clarity without cutting away.",
    prompt: "over-the-shoulder medium, foreground shoulder soft, far face sharp, static",
    diagram: null,
  },
  {
    title: "Dirty single",
    body: "A single with a sliver of the other person in frame — intimacy and conflict.",
    prompt: "dirty single close-up, tiny edge of the other person in frame left, slight handheld",
    diagram: null,
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Shot composition basics" subtitle="Rule of thirds, leading lines, negative space, OTS, dirty single — original diagrams + Lucy prompts." />
        <SeoCard title="Compose then move">
          <p>
            Composition is the still problem;{" "}
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">camera moves</Link> are the time problem. For stills lock, prefer{" "}
            <strong className="text-foreground">GPT Image on Lucy</strong>.
          </p>
          <CtaRow primaryHref="/#prompt-guide" primaryLabel="Prompt Guide" secondaryHref="/" secondaryLabel="Generate" />
        </SeoCard>
        {LESSONS.map((l) => (
          <SeoCard key={l.title} title={l.title}>
            <p>{l.body}</p>
            {l.diagram === "thirds" ? <DiagramThirds /> : null}
            {l.diagram === "leading" ? <DiagramLeading /> : null}
            {l.diagram === "neg" ? <DiagramNeg /> : null}
            <div className="rounded-2xl border border-border bg-white/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Prompt phrase</p>
              <p className="mt-1 font-mono text-xs text-foreground">{l.prompt}</p>
            </div>
          </SeoCard>
        ))}
        <SeoCard title="More study hubs"><StudyHubNav current="/shot-composition" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
