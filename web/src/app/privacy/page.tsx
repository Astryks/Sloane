import { SiteHeader } from "@/components/SiteHeader";
import { getGenerationRetentionDays, initSchema } from "@/lib/db";

// Metadata lives in privacy/layout.tsx (title/description/robots for SEO).
// Reads a live, admin-tunable setting (generation retention days) - without
// this the page would statically bake in whatever that value was at build
// time and drift out of sync after the next /admin change, same mistake
// this rewrite exists to fix.
export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  await initSchema();
  const retentionDays = await getGenerationRetentionDays();
  return (
    <div className="min-h-screen px-6 py-16">
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Privacy Policy" subtitle="Last updated 2026-09-11 (part of the Astryks Group)" />

        <div className="flex flex-col gap-6 rounded-[28px] border border-white/60 bg-surface/90 p-8 shadow-soft backdrop-blur-xl">
          <Section title="What this covers">
            <p>
              This page describes what Lucy Labs (&quot;we,&quot; &quot;us&quot;), part of the Astryks
              Group, collects and does with your data when you use lucylabs.app and the Lucy Labs
              mobile app. It&apos;s written in plain language and reflects what we actually do — not
              boilerplate we haven&apos;t checked against the real product.
            </p>
          </Section>

          <Section title="Audio — narration and voice cloning">
            <p>
              <strong>This feature is no longer offered.</strong> Lucy Labs used to offer standalone
              text-to-speech narration and voice cloning, processed on our own GPU servers (rented from
              RunPod and Modal) rather than sent to a third-party AI vendor. We retired this as a public
              feature on 2026-10-01. We never stored generated audio on our servers, and uploaded voice
              samples were used only to generate the requested audio, never retained afterward or used
              to train models — that was true while the feature was live, and no new narration/cloning
              data is collected now that it&apos;s gone.
            </p>
          </Section>

          <Section title="Video — a materially different arrangement from audio">
            <p>
              Video generation is a live, paid feature (talking-head avatars, cinematic scenes, and
              our pay-as-you-go engine picker). It works differently from audio-only narration/voice
              cloning above, and we want to be direct about that difference rather than bury it:
            </p>
            <p>
              Any photo, video, or reference audio you upload for a video generation — along with the
              text/audio we generate on your behalf to drive it — is sent to third-party AI model
              providers to actually produce the video. Depending on which engine you (or the feature)
              select, that means one or more of: <strong>Kling</strong> (Kuaishou), <strong>Veo</strong>{" "}
              (Google), and <strong>Seedance</strong> (ByteDance) — all reached through a third-party AI
              inference infrastructure provider that hosts and routes to these models on our behalf, and
              that also runs the audio/video-merge step we use when a video needs your uploaded or
              generated audio track attached to it.
            </p>
            <p>
              Practically, this means: your uploaded photo/video/audio and the resulting generated
              video are transmitted to and briefly stored by our inference provider and whichever model
              provider actually renders it, and are subject to those companies&apos; own privacy and
              retention policies (not just ours). The finished file stays on our inference
              provider&apos;s storage and is delivered to you through a Lucy Labs link. We do not
              control how long those providers retain that content on their own systems. We
              never send your data to these providers for anything other than fulfilling the specific
              video you asked for — not for their model training, and not for ours.
            </p>
          </Section>

          <Section title="Account &amp; billing">
            <p>
              We don&apos;t use passwords or traditional accounts. Instead, a subscription is tied to an
              access code generated after checkout. Payment is processed by Stripe — we do not see or
              store your card details ourselves. We store your email, subscription status, and usage
              (characters/video credits used this billing period) to enforce plan limits and manage
              your subscription. Your email address and subscription plan name are also sent to Resend,
              the service we use to actually deliver your access-code, sign-in, and payment-failed
              emails.
            </p>
          </Section>

          <Section title="Third-party service providers, at a glance">
            <p>
              Summarizing the companies above in one place, and what each one actually receives from
              us:
            </p>
            <ul className="list-disc pl-5">
              <li>
                <strong>Our AI inference infrastructure provider, Kling, Veo, Seedance</strong> — your uploaded photo/video/audio and
                generated video, only when you use a video feature (see &quot;Video&quot; above).
              </li>
              <li>
                <strong>Stripe</strong> — payment details and billing email, to process your
                subscription or credit purchase. We never see your raw card number.
              </li>
              <li>
                <strong>Resend</strong> — your email address and plan name, to deliver transactional
                emails (access codes, sign-in links, payment-failure notices).
              </li>
              <li>
                <strong>Modal</strong> — runs our own code (not a third-party AI service processing data
                on its own terms) for part of the spoken-dialogue step inside video generation (see
                &quot;Video&quot; above). We no longer offer standalone audio narration or voice cloning
                as a public feature, so Modal no longer receives audio submitted directly for that
                purpose; RunPod, previously used for that same retired feature, is no longer used at
                all.
              </li>
              <li>
                <strong>Vercel</strong> — hosts the site and, for signed-in users, your generation
                history (see &quot;Data retention &amp; deletion&quot; below).
              </li>
            </ul>
          </Section>

          <Section title="Basic visit counts">
            <p>
              We keep a lightweight, anonymous record of page visits (a randomly generated id stored
              in your browser, the page path, and a timestamp) so we can see roughly how much traffic
              the site is getting. We don&apos;t collect your IP address, device fingerprint, or any
              identifying information as part of this, and it isn&apos;t linked to your account or
              billing data.
            </p>
          </Section>

          <Section title="What we don't do">
            <ul className="list-disc pl-5">
              <li>We don&apos;t sell your data.</li>
              <li>We don&apos;t use your uploaded voice, photos, or video to train models — not for anyone else&apos;s benefit, and not for ours.</li>
              <li>We no longer offer standalone audio narration or voice cloning at all (see &quot;Audio&quot; above). Video generation still sends data to third-party model providers, disclosed plainly above, not buried here.</li>
            </ul>
          </Section>

          <Section title="Data retention &amp; deletion">
            <p>
              If you generate audio without signing in, nothing is stored on our servers — it exists
              only in your browser for that session. If you sign in, we keep a short history of your
              generations (currently {retentionDays} days) so you can play them back and re-download
              them from your account; anything older is automatically deleted. Videos are not stored on
              our own servers at any point — you get a Lucy Labs link to the file as held by our inference provider, and
              signed-in users&apos; history keeps that link, not a copy of the video itself, for the same
              retention window. If you&apos;d like anything deleted sooner — your account, uploaded
              samples, or generated clips — email us and we&apos;ll take care of it. We can&apos;t force an
              early deletion on our inference provider&apos;s or a model provider&apos;s own systems, but we can and will ask
              on your behalf.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy or your data:{" "}
              <a href="mailto:support@astryks.com" className="underline">
                support@astryks.com
              </a>
              .
            </p>
          </Section>

          <p className="rounded-2xl bg-white/60 p-3 text-xs italic leading-relaxed text-muted">
            This policy describes our actual data practices as accurately as we can, but it has not
            been reviewed by a lawyer and should not be treated as a complete legal document — in
            particular, it doesn&apos;t yet address regional requirements (e.g. GDPR, CCPA) in detail.
            Get it reviewed before relying on it for compliance purposes.
          </p>
        </div>
      </main>
    </div>
  );
}
