"use client";

import { useEffect, useRef, type ReactNode } from "react";

function GuideCard({
  wash,
  iconColor,
  icon,
  title,
  subtitle,
  headerRight,
  children,
  id,
}: {
  wash: string;
  iconColor: string;
  icon: string;
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`shadow-soft-lg rounded-[28px] border border-white/60 p-7 backdrop-blur-xl transition hover:shadow-soft-lg ${wash}`}
    >
      <div className="flex items-start justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-lg ${iconColor}`}
          >
            {icon}
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
        </div>
        {headerRight}
      </div>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function PasteBox({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-cream p-3 text-[11px] leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-purple/20 bg-white/80 p-4">
      <p className="text-sm font-extrabold text-foreground">
        <span className="text-purple">{n}.</span> {title}
      </p>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

// Real character-description formula + shot-list examples, written in our
// own words and entirely original prompts - not reproduced from any
// third-party tutorial (see STATUS.md 2026-09-15 for the two real YouTube
// prompt-engineering videos this technique was generalized from: their
// exact wording/videos are deliberately NOT reproduced here, same
// copyright discipline as the JoJo storyboard - only the general
// structural approach (reference block, character lock, timecoded shots)
// is reused, which is technique, not their copyrightable expression).
const PROMPT_STYLE_EXAMPLES: { category: string; title: string; prompt: string }[] = [
  {
    category: "Cinematic action",
    title: "Pursuit through an abandoned parking garage",
    prompt:
      "[CHARACTER]\nA synthetic pursuer built for one purpose: relentless, unblinking pursuit. Broad-shouldered chrome endoskeleton visible through tears in scorched synthetic skin along one forearm, glowing red optical sensors, torn leather jacket, combat boots. Moves with mechanical, unnervingly steady precision - no hesitation, no fatigue.\n\n" +
      "[SCENE]\nA derelict multi-story parking garage at night. Flickering fluorescent tubes, concrete pillars streaked with rust, oil pooling under abandoned cars, a single exit ramp spiraling down into darkness.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:02): Low-angle tracking shot, camera mounted street-level beside the motorcycle. The pursuer guns the engine, front wheel lifting slightly, sparks skittering off a support pillar as the handlebar clips it.\n" +
      "SHOT 2 (0:02-0:05): Handheld chase cam, whip-panning between the bike and a support column - a fuel-drum rupture kicks an orange fireball skyward, trailing black smoke, debris scattering across the oil-stained floor.\n" +
      "SHOT 3 (0:05-0:07): Close-up, static camera. The pursuer's face lit red by the fireball's glow - no fear, no flinch, optical sensors narrowing with mechanical focus.\n" +
      "SHOT 4 (0:07-0:08): Wide shot, camera holds as the bike bursts through the exit-ramp shutter in a shower of sparks and torn metal, disappearing into the night.\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos/watermarks. Cinematic, high-contrast, 4K, desaturated blue-grey palette except the fire's orange glow.",
  },
  {
    category: "UGC product ad",
    title: "Bathroom mirror - lipstick",
    prompt:
      "[REFERENCE]\n@Image1 - your character reference (from Cast & Locations). Use for face, hair, skin tone, and build only - not background or lighting. @Image2 - the lipstick.\n\n" +
      "[CHARACTER]\nMid-20s, warm brown skin, natural curls pulled into a loose bun, silky blush-pink slip dress, relaxed and confident.\n\n" +
      "[SCENE]\nA bright, clean bathroom. Morning light through a frosted window, softly catching the fabric of her dress and the edge of the mirror.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:02): Medium shot, static camera, mirror reflection. She twists open @Image2, inspecting the shade with a small approving nod.\n" +
      "SHOT 2 (0:02-0:05): Close-up, slight handheld sway (selfie-style). She applies it in one smooth stroke, presses her lips together, breaks into a genuine, pleased smile. {\"Okay, this shade is unreal.\"}\n" +
      "SHOT 3 (0:05-0:08): Medium close-up, camera holds. She turns toward the window light, holding the product beside her face so the label reads clearly, natural light catching both skin and packaging.\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos beyond the product's own label. Warm, soft-focus, natural light, iPhone-shot UGC aesthetic - not overly polished.",
  },
  {
    category: "UGC product ad",
    title: "Desk setup - tech gadget",
    prompt:
      "[REFERENCE]\n@Image1 - your character reference. @Image2 - the product.\n\n" +
      "[CHARACTER]\nLate 20s, short textured hair, glasses, oversized knit sweater, easygoing and a little wry.\n\n" +
      "[SCENE]\nA cozy bedroom desk setup, string lights soft in the background, laptop open, afternoon light through a nearby window.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:03): Medium shot, static camera, desk-level. He picks up @Image2, turning it over in his hands, one eyebrow raised, genuinely impressed. {\"Okay, I was not expecting this to actually be good.\"}\n" +
      "SHOT 2 (0:03-0:06): Close-up, slow handheld push-in. He demonstrates the product's main feature to camera, focused and matter-of-fact.\n" +
      "SHOT 3 (0:06-0:08): Medium shot, camera holds. He sets it down, leans back, shrugs with a small grin. {\"Yeah. It's going on the desk permanently.\"}\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos beyond the product's own branding. Casual, natural light, handheld UGC energy - not a polished commercial.",
  },
];

// The director's actual storyboard for the JoJo case study below, shared
// with us directly for this purpose (2026-09-15, per direct request -
// "embed the word doc too, that's the storyboard they need to see").
// Transcribed scene-by-scene from her original document rather than
// linking/embedding the raw .docx file itself, so it reads natively on
// the page and works on mobile - real audio/video columns, not paraphrased.
// Per-scene reference images (2026-09-15): the storyboard's real reference
// images are almost all downloaded stock/editorial photography used as
// internal mood-board references (one has a visible Getty Images
// watermark, confirmed by looking at the actual embedded images before
// adding anything) - not ours to republish. Scenes 1/17/18 use JoJo's own
// brand assets instead (their logo, app-store badges, end card - no
// third-party photography in any of them). Every other scene (2-16) uses
// an original illustration generated from that scene's own shot
// description, in a consistent flat-illustration storyboard style - not a
// recreation of her actual reference photos, a new image made from the
// same brief, so visitors can see what a real storyboard image + video
// pairing looks like without reproducing anyone else's copyrighted photos.
const JOJO_STORYBOARD: { audio: string; video: string; image?: string }[] = [
  {
    audio: "Are you ready to take a ride on #PASABAYDELIVERY?\n\nWith Jojo, where I'm going I'll bring it there\nSa Jojo, sabay kita!",
    video: "Opening credit shows the two talents going across the screen with one pushing the other's chair, having fun. The #pasabaydelivery hashtag appears behind them as they leave the screen.\n\nLogo Jojo with blinking eye",
    image: "/product-showcase/jojo/jojo-logo-sabaykita.png",
  },
  {
    audio: "Meet Bea.",
    video: "Show an online seller surrounded by packages to be sent. Incidental props show her very millennial office space - plants, inspirational quotes.",
    image: "/product-showcase/jojo/scene-2.png",
  },
  {
    audio: "She is in Pasig and she needs to send a package to Makati.\n\nNasa Pasig siya at kailangan niyang magpadala ng package to Makati.",
    video: "Image of a map or something similar, then there's an arrow going from point A to B",
    image: "/product-showcase/jojo/scene-3.png",
  },
  {
    audio: "Meet Mario.",
    video: "Show Mario, smiling",
    image: "/product-showcase/jojo/scene-4.png",
  },
  {
    audio: "He is also from Pasig but he commutes to Makati every day.\n\nTaga-Pasig rin siya pero nagko-commute siya papuntang Makati every day.",
    video: "Show Mario in a crowded MRT.\nClose up of hand hanging on a hand grip\nFull shot Mario sideways, getting through the train motion and handling the hand grip",
    image: "/product-showcase/jojo/scene-5.png",
  },
  {
    audio: "What if there's a way for them to help one another?",
    video: "Split screen - show Bea looking right frame, Mario looking back at Bea.",
    image: "/product-showcase/jojo/scene-6.png",
  },
  {
    audio: "It's possible with #PASABAYDELIVERY or Crowdshipping",
    video: "“#PasabayDelivery” term appears on screen and when it is mentioned, the characters can smile as if in agreement",
    image: "/product-showcase/jojo/scene-7.png",
  },
  {
    audio: "Through Jojo app,",
    video: "Show the hand of Bea holding a phone",
    image: "/product-showcase/jojo/scene-8.png",
  },
  {
    audio: "pwedeng ipasabay ni Bea ang package niya kay Mario",
    video: "Frontal shot of Bea holding the phone with Jojo app.\n\nWe show a graphic with 'We found a match'\nWe split the screen again with the mid shot of Mario, with his phone and smiling.",
    image: "/product-showcase/jojo/scene-9.png",
  },
  {
    audio: "at pwedeng kumita si Mario ng extra money on his way to Makati.",
    video: "Show Mario getting the box from Bea and heading to Makati with it.\nClose up & mid shot of package delivery, full shot of Mario commuting with package",
    image: "/product-showcase/jojo/scene-10.png",
  },
  {
    audio: "The sender gets fast, secure and convenient shipping",
    video: "Show a smiling Bea looking at her phone. Split screen with the app animation showing the confirmed booking",
    image: "/product-showcase/jojo/scene-11.png",
  },
  {
    audio: "while helping a fellow Filipino turn his commute into cash.",
    video: "The receiver is typing on a computer, Mario enters the frame in a funny way and delivers the item.\nNext frame, a blue piggy bank and Mario inserting a bill inside.",
    image: "/product-showcase/jojo/scene-12.png",
  },
  {
    audio: "Ang mga Jojo transporters ay verified at rated by the community.\n\nPwede pang i-track ang delivery live via the app para siguradong in good hands ang package mo.",
    video: "Jojo Transporter profile tagged as 4.9 stars rating plus the number of trips\n\nReal-time app tracking screenshot - show movement",
    image: "/product-showcase/jojo/scene-13.png",
  },
  {
    audio: "Hindi diyan nagtatapos ang pagtutulungan sa Jojo!",
    video: "Show Bea and Mario talking with the package. The two are being replicated to represent other senders and transporters.",
    image: "/product-showcase/jojo/scene-14.png",
  },
  {
    audio: "Ang bawat #PasabayDelivery ay nakakatulong rin sa pagbawas ng traffic at polusyon sa Pilipinas.",
    video: "We see Mario blowing a dark cloud out of the frame",
    image: "/product-showcase/jojo/scene-15.png",
  },
  {
    audio: "After all, no extra cars or trucks will be added on the road, wala rin extra wrapping bags ang kailangan kapag nagpasabay ka kay Jojo!",
    video: "We see Bea, air in the wind, breathing clean air while the many moving vehicles are slowly reduced",
    image: "/product-showcase/jojo/scene-16.png",
  },
  {
    audio: "Send through Jojo or be a Jojo.\n\nDownload the Jojo app at makisabay na!",
    video: "Show Jojo logo. Show Google Play Store and App Store logos.",
    image: "/product-showcase/jojo/jojo-app-badges.png",
  },
  {
    audio: "If you want to know more about us, visit myJojo.com or follow us on social media at @Jojodelivers.",
    video: "MyJojo.com\n\nFB, TW, IG, YT\n@Jojodelivers",
    image: "/product-showcase/jojo/jojo-endcard.png",
  },
];

export function PromptGuideSection() {
  const jojoDetailsRef = useRef<HTMLDetailsElement | null>(null);

  // Auto-opens the JoJo storyboard disclosure when arriving via a direct
  // link to it (e.g. the "See a real example" link on /ads).
  useEffect(() => {
    if (window.location.hash === "#jojo-case-study" && jojoDetailsRef.current) {
      jojoDetailsRef.current.open = true;
    }
  }, []);

  return (
    <GuideCard
      id="prompt-guide"
      wash="bg-surface/90"
      iconColor="text-purple"
      icon="📝"
      title="Our prompt guide"
      subtitle="Character → place → video — pasteable prompts at every step."
    >
      <p className="text-sm leading-relaxed text-muted">
        Six easy steps. At each one you get a short explanation, then a cream box you can copy-paste.
        Stack: make stills in ChatGPT / GPT Image (or any strong image model) → animate with Seedance,
        Veo, Kling, or another engine on this page → stitch longer cuts in{" "}
        <a href="/stitch" className="font-semibold text-purple underline">
          /stitch
        </a>
        .
      </p>

      <Step n={1} title="Create your character image">
        <p>
          Use ChatGPT / GPT Image (or any strong image model). Aim for 2K, and match the aspect you
          want later (16:9, 9:16, etc.).
        </p>
        <p>
          Ask for a <strong className="text-foreground">split-screen sheet</strong>: left = full-body
          standing head-to-toe, right = tight chest-up. Same person both sides. Pure white / empty
          seamless background. Flat, soft, even light — boring on purpose (no rim light, no colour
          cast).
        </p>
        <p>
          Push hyper-real skin: visible pores, fine lines, uneven tone, peach fuzz or stubble, faint
          freckling. No beauty filter, no plastic skin, no glossy magazine look.
        </p>
        <p>
          Once this sheet exists, <strong className="text-foreground">never describe the face in text
          again</strong> — only attach the image.
        </p>
        <p className="text-xs">
          <strong className="text-foreground">Good:</strong> pores, faint freckles, slightly uneven
          tone under the eyes.{" "}
          <strong className="text-foreground">Plastic:</strong> porcelain skin, beauty-filter glow,
          perfect symmetry.
        </p>
        <PasteBox>{`Split-screen character reference sheet, 2K, [16:9 or 9:16].

LEFT half: full-body standing, head-to-toe, facing camera, relaxed neutral stance.
RIGHT half: tight chest-up portrait of the SAME person, same wardrobe, same lighting.

Subject: [age], [features — build, hair, skin, 2–3 distinguishing details], wearing [wardrobe].

Background: pure white seamless void, empty, no props, no floor line distraction.
Lighting: flat soft even studio light, frontal, no rim, no colour cast, no dramatic shadows.
Skin: hyper-real — visible pores, fine lines, uneven tone, peach fuzz or light stubble, faint freckling. No beauty filter, no plastic skin, no glossy retouching.

Photorealistic. Identity must match exactly across both panels.`}</PasteBox>
      </Step>

      <Step n={2} title="Create your location image">
        <p>
          Generate this separately — <strong className="text-foreground">no character in frame</strong>.
          Match the same aspect ratio you used for the character (9:16 or 16:9).
        </p>
        <p>
          Pick a real place with clear light direction and depth. Empty enough that a person can
          stand in it later without fighting clutter.
        </p>
        <PasteBox>{`Empty boxing gym interior, 2K, 9:16 vertical.

Worn wooden floor with scuffs, heavy bags in the mid-ground, ropes of a ring visible on the right, chalk dust in the air.
Late-afternoon light from high windows on the left — warm shafts cutting through cooler shadow in the corners.
No people, no text, no logos. Photorealistic, natural colour, slight film grain.`}</PasteBox>
      </Step>

      <Step n={3} title="Put the character IN the location (don’t look fake)">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            Make a <strong className="text-foreground">combined still first</strong>, or in video use
            @Image1 for the person and @Image2 for the place.
          </li>
          <li>
            <strong className="text-foreground">Relight</strong> the person to match the place —
            discard the sheet&apos;s flat studio light.
          </li>
          <li>Feet planted on the ground, shadow direction matching the room, correct scale.</li>
          <li>Avoid opposite colour temperatures fighting (warm subject / cold background).</li>
          <li>
            Add living micro-motion later (breathing, weight shift) — not a mannequin freeze.
          </li>
        </ul>
        <p className="text-xs font-semibold text-foreground">Pasteable still (composite):</p>
        <PasteBox>{`Photoreal still. @Image1 is the person (face, hair, body, wardrobe — identity lock). @Image2 is the location (environment + lighting only).

Place @Image1 naturally inside @Image2. Relight the person to match the location’s light direction and colour temperature — do not keep the white-studio light from the character sheet.
Feet grounded on the floor, contact shadow matching the room’s light. Correct scale for the space.
Same camera height as a documentary still. No beauty filter. No text, logos, or watermarks.`}</PasteBox>
        <p className="text-xs font-semibold text-foreground">Pasteable short video:</p>
        <PasteBox>{`@Image1 person standing in @Image2 location. Relight subject to match the room. Soft natural breathing and a tiny weight shift. Static medium shot, one hold. No subtitles, no logos.`}</PasteBox>
      </Step>

      <Step n={4} title="Write the video prompt (one scene)">
        <p>
          Formula: <strong className="text-foreground">who (@Image) + where + what happens + ONE
          camera move + light + no subtitles</strong>.
        </p>
        <p className="text-xs font-semibold text-foreground">UGC product:</p>
        <PasteBox>{`@Image1 (your character) in a bright bathroom, morning window light. Medium selfie-style handheld sway. She twists open @Image2 (product), applies it, presses lips together, genuine small smile. {"Okay, this shade is unreal."} Warm natural light, iPhone UGC look. No subtitles beyond the product label.`}</PasteBox>
        <p className="text-xs font-semibold text-foreground">Cinematic close-up:</p>
        <PasteBox>{`@Image1 close-up, static camera. Soft side light from a window. She exhales, shoulders drop, eyes soften — a private almost-smile. Shallow depth of field. No dialogue, no subtitles, no logos.`}</PasteBox>
        <p className="text-xs font-semibold text-foreground">Extreme wide:</p>
        <PasteBox>{`Extreme wide shot of @Image1 small in @Image2 landscape. Slow gentle pull-back. Natural wind in clothing/hair. Golden-hour light. No subtitles, no logos.`}</PasteBox>
        <p>
          <strong className="text-foreground">Pick one camera</strong> (one-liners): static hold ·
          slow push-in · gentle pull-back · slight handheld sway · low tracking beside subject ·
          slow pan following motion.
        </p>
        <p>
          <strong className="text-foreground">Trap:</strong> don&apos;t name gear as an object
          (&quot;FPV drone&quot;) — describe the move (&quot;fast forward rush hugging the ground,
          whip-tilting up at the end&quot;).
        </p>
        <p>
          <strong className="text-foreground">Sound:</strong> write per-shot dialogue/SFX, or say
          &quot;no music&quot; and add score later in /stitch.
        </p>
        <p>
          Draft cheap first, then upscale the keeper — one clean take beats ten muddy ones.
        </p>
      </Step>

      <Step n={5} title="Longer than ~15 seconds">
        <p>
          Break the story into beats. Generate each beat as its own short clip, then combine in{" "}
          <a href="/stitch" className="font-semibold text-purple underline">
            /stitch
          </a>
          .
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="border-b border-border pb-1 pr-2 font-semibold">Beat</th>
                <th className="border-b border-border pb-1 pr-2 font-semibold">Camera</th>
                <th className="border-b border-border pb-1 pr-2 font-semibold">Action</th>
                <th className="border-b border-border pb-1 font-semibold">Audio</th>
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                <td className="border-b border-border py-1.5 pr-2 text-foreground">1. Hook</td>
                <td className="border-b border-border py-1.5 pr-2">Medium, slight handheld</td>
                <td className="border-b border-border py-1.5 pr-2">She looks to camera, lifts product</td>
                <td className="border-b border-border py-1.5">{"\"Wait — try this.\""}</td>
              </tr>
              <tr className="align-top">
                <td className="border-b border-border py-1.5 pr-2 text-foreground">2. Demo</td>
                <td className="border-b border-border py-1.5 pr-2">Close-up, slow push-in</td>
                <td className="border-b border-border py-1.5 pr-2">Applies product in one stroke</td>
                <td className="border-b border-border py-1.5">Soft room tone only</td>
              </tr>
              <tr className="align-top">
                <td className="border-b border-border py-1.5 pr-2 text-foreground">3. Payoff</td>
                <td className="border-b border-border py-1.5 pr-2">Medium, static hold</td>
                <td className="border-b border-border py-1.5 pr-2">Smile, holds product to label</td>
                <td className="border-b border-border py-1.5">{"\"Yeah. Keeping this.\""}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong className="text-foreground">Seedance:</strong> 2.0 accepts up to ~9 reference
          images; 2.5 up to ~30. Use 4–8 that matter. On Lucy, More options = 1 photo per generation;
          for saved character/location libraries use{" "}
          <a href="/ads" className="font-semibold text-purple underline">
            /ads → Cast &amp; Locations
          </a>
          . Prefer generating directly in Seedance (or Veo / Kling) on this page — no extra middleware
          required.
        </p>
        <p>
          Lock start + end keyframes (first and last frame) for anything that must not change —
          face, product label, wardrobe.
        </p>
      </Step>

      <Step n={6} title="Results — see it working">
        <p>Real clips we generated with this approach:</p>
        <video
          className="mx-auto w-full max-w-xl rounded-xl"
          src="/trailers/kirsty-moon-veo-audio.mp4"
          controls
          loop
          muted
          playsInline
        />
        <p className="text-xs">
          More product-ad examples:{" "}
          <a href="#harper" className="font-semibold text-purple underline">
            jump to Harper
          </a>
          .
        </p>
      </Step>

      <details className="rounded-2xl border border-border bg-white/70 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-purple">
          Camera angles + moves (paste snippets)
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
          <li>
            <strong className="text-foreground">Extreme close-up:</strong> eyes and mouth fill the
            frame; shallow focus; pores readable.
          </li>
          <li>
            <strong className="text-foreground">Close-up:</strong> face and shoulders; hold or tiny
            push-in.
          </li>
          <li>
            <strong className="text-foreground">Medium:</strong> waist-up; good for product demos and
            dialogue.
          </li>
          <li>
            <strong className="text-foreground">Wide / establishing:</strong> full body + room; sets
            geography before closer coverage.
          </li>
          <li>
            <strong className="text-foreground">Low angle:</strong> camera near the floor looking up —
            subject feels powerful.
          </li>
          <li>
            <strong className="text-foreground">High angle:</strong> looking down — vulnerability or
            overview.
          </li>
          <li>
            <strong className="text-foreground">Tracking:</strong> camera slides beside the subject at
            matching pace — one direction only.
          </li>
          <li>
            <strong className="text-foreground">Push / pull:</strong> slow dolly in for intimacy, slow
            pull-back to reveal scale.
          </li>
          <li>
            <strong className="text-foreground">Handheld sway:</strong> slight organic drift —
            selfie / UGC energy, not shake-cam.
          </li>
          <li>
            <strong className="text-foreground">Whip pan:</strong> fast horizontal blur between two
            clear end-frames — use sparingly.
          </li>
        </ul>
        <PasteBox>{`Camera: medium shot, slow push-in, eye-level. One move only. Hold the final frame clean.`}</PasteBox>
      </details>

      <details className="rounded-2xl border border-border bg-white/70 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-purple">
          Expression library (physical detail, not labels)
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
          <li>Shoulders drop; a long exhale; jaw unclenches.</li>
          <li>One eyebrow lifts; corner of the mouth tugs, then settles.</li>
          <li>Eyes glass slightly; blink is slow; gaze holds past the lens.</li>
          <li>Lips press together, then break into a small real smile.</li>
          <li>Weight shifts to the back foot; fingers fidget once on the product.</li>
          <li>Chin tips up; nostrils flare; a sharp inhale before speaking.</li>
          <li>Private almost-smile — mouth soft, eyes warmer, no teeth yet.</li>
        </ul>
        <p className="mt-2 text-xs text-muted">
          Write the body, not the mood word. &quot;She&apos;s happy&quot; drifts; the physical beat
          locks.
        </p>
      </details>

      <details className="rounded-2xl border border-border bg-white/70 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-purple">
          More worked prompts (by style)
        </summary>
        <div className="mt-3 space-y-4">
          {PROMPT_STYLE_EXAMPLES.map((ex, i) => (
            <div key={i} className="rounded-xl bg-cream p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-purple">{ex.category}</p>
              <p className="text-sm font-semibold text-foreground">{ex.title}</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted">{ex.prompt}</pre>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] italic text-muted">
          The UGC examples show how to bring in your own{" "}
          <strong>Cast &amp; Locations</strong> references (your character photo, your product photo)
          and change everything else — setting, wardrobe, dialogue — freely around them.
        </p>
      </details>

      <details className="rounded-2xl border border-border bg-white/70 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-purple">
          Full template block structure
        </summary>
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted">
          <div>
            <p className="font-semibold text-foreground">Describing a character (when you still need text)</p>
            <p className="mt-1">
              Formula:{" "}
              <strong>
                age + build + 2–3 distinguishing features + hair + wardrobe (2–3 specific items) +
                demeanor
              </strong>
              . Prefer attaching the character sheet instead once it exists.
            </p>
            <p className="mt-1 rounded-lg bg-cream p-2 italic">
              &quot;Late 20s, lean athletic build, faint scar above the left eyebrow, cropped dark
              hair, wearing a weathered leather jacket over a grease-stained white tank top, moves
              with coiled, watchful tension.&quot;
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">The full block structure</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-cream p-2 text-[11px] leading-relaxed text-foreground">{`[REFERENCE]
@Image1 - who/what. Use for face/body/wardrobe/identity only, not background or lighting.

[CHARACTER]
age + build + distinguishing features + hair + wardrobe + demeanor

[SCENE]
where, when, atmosphere, lighting/color tone - 2-3 sentences

[SHOT SEQUENCE]
SHOT 1 (0:00-0:03): camera framing + ONE movement - subject action. {dialogue}
SHOT 2 (0:03-0:06): camera framing + movement - subject action. (music note)
SHOT 3 (0:06-0:08): camera framing + movement - subject action. <sfx note>

[CONSTRAINTS]
no subtitles/logos/watermarks unless wanted + a style anchor`}</pre>
          </div>
          <div>
            <p className="font-semibold text-foreground">What a director thinks about that most prompts skip</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <strong>Shot size, chosen on purpose</strong> — extreme close-up, close-up, medium,
                wide/establishing. Don&apos;t default to medium every time.
              </li>
              <li>
                <strong>Coverage</strong> — a wide shot that establishes the space, then close-ups on
                top of it, reads as directed.
              </li>
              <li>
                <strong>The 180-degree rule</strong> — keep people on the same screen-left/right side
                across cuts in a conversation.
              </li>
              <li>
                <strong>Sound as 4 separate layers</strong> — dialogue, ambience, sound effects,
                score. Silence is also a deliberate choice.
              </li>
              <li>
                <strong>Cut rhythm matches the emotional beat</strong> — fast cuts for energy, long
                holds for intimacy or dread.
              </li>
              <li>
                <strong>Color and mood</strong> — warm vs. cool, high-key vs. low-key.
              </li>
              <li>
                <strong>Name the physical detail, not the label</strong> — not &quot;an
                explosion&quot;, but the fuel-tank rupture and the orange fireball.
              </li>
            </ul>
          </div>
        </div>
      </details>

      <div id="jojo-case-study" className="rounded-2xl border border-purple/20 bg-white/80 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-purple">Real case study</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We spoke with a film director about how she actually plans an ad, using a real one she
          directed as the example: a launch spot for JoJo, a Philippines crowdshipping startup —
          regular people request local deliveries, and other regular people who are already headed
          that way opt in to fulfill them for extra cash. Her ad went on to get{" "}
          <strong>1.7M views on Facebook</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Her storyboard broke the ad into clear beats, the same shape a lot of strong short ads
          follow: a fun cold open, introduce two ordinary people who each have half of a problem,
          show the problem, introduce the app as the thing that connects them, show the transaction
          actually happening, back it up with trust signals (ratings, live tracking), then close on a
          bigger mission (less traffic and pollution) plus a clear call to download. Every scene has
          its own shot description and its own line of narration — a storyboard, not just a script.
        </p>
        <details ref={jojoDetailsRef} className="mt-3 rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">
            View the full storyboard (her actual document, scene by scene)
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="w-10 border-b border-border pb-1 pr-2 font-semibold">#</th>
                  <th className="w-28 border-b border-border pb-1 pr-2 font-semibold">Image</th>
                  <th className="border-b border-border pb-1 pr-3 font-semibold">Audio</th>
                  <th className="border-b border-border pb-1 font-semibold">Video</th>
                </tr>
              </thead>
              <tbody>
                {JOJO_STORYBOARD.map((scene, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-b border-border py-2 pr-2 text-muted">{i + 1}</td>
                    <td className="border-b border-border py-2 pr-2">
                      {scene.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={scene.image}
                          alt={`Scene ${i + 1} storyboard image`}
                          className="h-24 w-24 rounded-lg border border-border object-cover bg-white"
                        />
                      )}
                    </td>
                    <td className="whitespace-pre-line border-b border-border py-2 pr-3 text-foreground">
                      {scene.audio}
                    </td>
                    <td className="whitespace-pre-line border-b border-border py-2 text-muted">
                      {scene.video}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] italic text-muted">
            Shared with us directly by the director — her real storyboard, transcribed here scene by
            scene. On scenes 1, 17, and 18 the image is JoJo&apos;s own brand asset (logo, app
            badges, end card). Everywhere else, her original reference was licensed stock
            photography, so instead of reproducing that, we generated a new illustration from the
            same shot description — a real example of a storyboard image for each scene, just not her
            actual photo.
          </p>
        </details>

        <div className="mx-auto mt-3 max-w-md overflow-hidden rounded-2xl border border-border">
          <iframe
            // Real fix (live QA find, 2026-09-17): the descriptive slug
            // ("jojo-pasabay-delivery") in the href's video permalink isn't
            // something the video.php plugin resolves - it silently failed
            // to embed and fell through to a broken/blank iframe instead.
            // Facebook's own embed-code generator for this exact video
            // (confirmed by opening its Embed panel directly) omits the
            // slug entirely, so match that canonical form.
            src="https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fwww.facebook.com%2FmyJoJo.live%2Fvideos%2F2521431254554554%2F&show_text=false&width=560&t=0"
            width="100%"
            height="314"
            style={{ border: "none", overflow: "hidden" }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            title="JoJo Pasabay Delivery ad on Facebook"
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          That&apos;s the real, finished ad, embedded directly from JoJo&apos;s own Facebook page —
          not made by us, shown here purely as a real example of a storyboard becoming a finished ad.
        </p>
      </div>
    </GuideCard>
  );
}
