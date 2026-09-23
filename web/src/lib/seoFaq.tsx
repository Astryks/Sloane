import type { ReactNode } from "react";

export type SeoFaqItem = { q: string; a: string };

export function faqJsonLd(faqs: SeoFaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function FaqSection({ faqs, title = "FAQ" }: { faqs: SeoFaqItem[]; title?: string }) {
  return (
    <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">{title}</h2>
      <dl className="mt-4 flex flex-col gap-5">
        {faqs.map((item) => (
          <div key={item.q}>
            <dt className="text-sm font-extrabold text-foreground">{item.q}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function SeoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function CtaRow({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <a
        href={primaryHref}
        className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:opacity-95"
      >
        {primaryLabel}
      </a>
      {secondaryHref && secondaryLabel ? (
        <a
          href={secondaryHref}
          className="rounded-full border border-border bg-white/80 px-5 py-2.5 text-sm font-semibold text-foreground shadow-soft transition hover:bg-white"
        >
          {secondaryLabel}
        </a>
      ) : null}
    </div>
  );
}
