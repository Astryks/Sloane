import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";
import { PLANS, type PlanId } from "./plans";

// POSTGRES_URL is what Vercel's Postgres (Neon-backed) integration injects
// automatically once the database is linked to this project.
const sql = neon(process.env.POSTGRES_URL!);

export type Subscriber = {
  id: string;
  email: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: PlanId;
  status: "active" | "canceled" | "past_due";
  access_token: string;
  period_start: string;
  period_end: string;
  characters_used: number;
  video_seconds_used: number;
};

// Real gap found by a read-only audit (2026-09-15, GitHub Codespaces):
// every DB-touching route calls initSchema() first (34 of them), but
// nothing validated POSTGRES_URL was actually set before the Neon driver's
// first real query - a missing/misconfigured env var would surface as
// whatever generic error the driver happens to throw, not a clear,
// actionable message, unlike the existing setupError() pattern
// product-ad/generate/route.ts (and others) already use for their own
// provider keys (FAL_KEY, MODAL_SUBMIT_URL, etc). Fixed centrally, here,
// rather than patching every route individually - same DRY reasoning the
// rest of this file already follows. Every caller already wraps
// initSchema() in its own try/catch and returns a proper JSON error
// response (never an unhandled crash) - this only makes THAT message
// useful instead of a raw driver error a customer would never understand.
export async function initSchema() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("Server misconfiguration: POSTGRES_URL is not set.");
  }
  await sql`
    CREATE TABLE IF NOT EXISTS subscribers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      stripe_customer_id TEXT UNIQUE NOT NULL,
      stripe_subscription_id TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      access_token TEXT UNIQUE NOT NULL,
      period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
      period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
      characters_used INTEGER NOT NULL DEFAULT 0,
      video_seconds_used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS page_visits (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS page_visits_created_at_idx ON page_visits (created_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Stripe webhook idempotency - Stripe explicitly documents that the same
  // event can be delivered more than once (retries after a slow/failed
  // 200, manual redelivery from the dashboard, etc.). Real bug this closes:
  // the webhook handler's video-credit-pack branch calls addVideoCredits
  // (a pure increment) with no dedupe, so a redelivered
  // checkout.session.completed for the same payment doubled the credits
  // granted - pay for 5, receive 10. The subscription branch happened to be
  // safe already (upsertSubscriberForCheckout sets absolute values, not an
  // increment) but this guard is applied to every event type for
  // consistency, not just the one bug that was found.
  await sql`
    CREATE TABLE IF NOT EXISTS processed_stripe_events (
      event_id TEXT PRIMARY KEY,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Real cross-tenant leak partially fixed here (security audit,
  // 2026-09-16): /api/job-status has no auth/ownership check at all (by
  // design - it serves both anonymous free-tier and logged-in requests with
  // only the jobId as a credential), so anyone who obtained a jobId - via a
  // log, a proxy, a referrer header, shoulder-surfing a shared screen -
  // could fetch that generation's full audio anytime afterward, indefinitely.
  // A full fix needs a coordinated API-contract change across both the web
  // and mobile clients; this is the real, additive mitigation that needs
  // none: audio delivery becomes single-use at OUR OWN layer regardless of
  // how long the underlying provider (RunPod/Modal) keeps the result
  // fetchable, shrinking "leaked jobId works forever" down to "only
  // exploitable in the narrow race against the legitimate client's own
  // first poll" - see claimJobAudioDelivery below.
  await sql`
    CREATE TABLE IF NOT EXISTS delivered_job_audio (
      job_id TEXT PRIMARY KEY,
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS free_tier_usage (
      id TEXT PRIMARY KEY,
      characters_used INTEGER NOT NULL DEFAULT 0,
      period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
      period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      google_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS login_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS generations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      voice_label TEXT,
      text_preview TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS pending_generations (
      job_id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      voice_label TEXT,
      text_preview TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Pay-as-you-go video credits (2026-09-11) - a prepaid balance, not a
  // subscription: each credit buys one 8s/720p generation on any of Kling/
  // Veo/Seedance, same flat price regardless of engine (see plans.ts for
  // the real-cost math behind that). Deliberately separate from the
  // subscribers/PLANS system above - this is a one-time purchase, not a
  // recurring plan, and the two shouldn't be conflated.
  await sql`
    CREATE TABLE IF NOT EXISTS video_credits (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS video_paygo_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      engine TEXT NOT NULL,
      prompt TEXT NOT NULL,
      fal_request_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      video_url TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS product_ad_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      brief TEXT NOT NULL,
      youtube_references TEXT,
      product_image_url TEXT NOT NULL,
      character_image_url TEXT NOT NULL,
      storyboard_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      fal_endpoint TEXT NOT NULL,
      fal_request_id TEXT,
      modal_job_id TEXT,
      audio_url TEXT,
      silent_video_url TEXT,
      lipsync_request_id TEXT,
      final_video_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Consent/audit trail (2026-09-14) - real legal-risk mitigation, per
  // direct request ("build safety guardrails like elevenlabs so we cant
  // get into legal issues if users copy audio without licences or
  // generate videos with images they dont have approval of"). Matches
  // ElevenLabs' own real approach (researched earlier this project, see
  // STATUS.md "voice-cloning consent" section): NOT ID-document upload -
  // a required consent attestation + an audit log, so there's a real,
  // timestamped record if a dispute ever arises. Deliberately generic
  // across content types (voice reference clips AND uploaded character/
  // product photos) rather than one-off per feature, so the same table
  // covers clone-voice today and any future Ad Studio "upload your own
  // photo" path without a schema change.
  await sql`
    CREATE TABLE IF NOT EXISTS consent_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      content_type TEXT NOT NULL,
      feature TEXT NOT NULL,
      consent_text TEXT NOT NULL,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Ad Studio (2026-09-14) - a storyboard-first, scene-by-scene ad
  // production flow: one project holds an ordered list of scenes, each
  // scene has its own reference image (regenerable by typing an edit,
  // not just re-describing from scratch - see fal.ts's editImageWithPrompt)
  // and its own generated video clip, approved one at a time before the
  // next scene starts. `mode` distinguishes the three entry points from
  // the same underlying pipeline: "direct" (fal-style - pick a model,
  // type a prompt, no storyboard at all), "auto" (the full pipeline with
  // every approval step skipped), "guided" (the real per-scene review
  // flow). Deliberately a separate table from product_ad_jobs - that
  // flow is a fixed 5-shot single-job structure and is PARKED pending
  // product-identity-drift fixes; this is a variable-length, scene-level
  // structure built around approving each piece as it's made, not one
  // big submit-and-wait job.
  await sql`
    CREATE TABLE IF NOT EXISTS ad_studio_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      brief TEXT NOT NULL,
      video_model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      final_video_url TEXT,
      silent_video_url TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ad_studio_scenes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES ad_studio_projects(id) ON DELETE CASCADE,
      order_index INT NOT NULL,
      shot_type TEXT NOT NULL,
      camera TEXT NOT NULL,
      action TEXT NOT NULL,
      dialogue TEXT,
      image_prompt TEXT NOT NULL,
      video_model TEXT NOT NULL DEFAULT 'veo',
      image_edit_count INT NOT NULL DEFAULT 0,
      image_url TEXT,
      image_fal_request_id TEXT,
      video_url TEXT,
      video_fal_request_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending_image',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Grid storyboard (2026-09-14) - the leanest of Ad Studio's three entry
  // points, per direct instruction: NO auto-generated brief/storyboard,
  // no auto-picked model, no auto-written camera prompt. The user builds
  // the grid slot by slot (upload their own image, or generate one here),
  // writes their own prompt (optional real camera-language example chips
  // offered client-side, never inserted without them choosing to), picks
  // their own model, and pays one video credit per slot generated - real,
  // already-proven billing (spendVideoCredit/refundVideoCredit, the same
  // mechanism video_paygo_jobs already uses), not new payment
  // infrastructure. Stitching is deliberately NOT wired in here - the
  // existing free /stitch tool already does this and works on any video
  // regardless of where it came from, so there's no reason to duplicate it.
  await sql`
    CREATE TABLE IF NOT EXISTS grid_storyboard_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS grid_storyboard_slots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES grid_storyboard_projects(id) ON DELETE CASCADE,
      order_index INT NOT NULL,
      image_url TEXT,
      prompt TEXT,
      video_model TEXT,
      video_url TEXT,
      video_fal_request_id TEXT,
      status TEXT NOT NULL DEFAULT 'empty',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // "Cast & Locations" reference library (2026-09-14) - real engineering
  // for character/product/location fidelity across scenes, per direct
  // request. A named, reusable reference (a character's face, a specific
  // location/set, a product, or a "vibe" mood board) lives once per
  // project; a scene picks which of these apply to it, and the SAME
  // uploaded/generated image bytes get passed into the image-edit call for
  // every scene that uses it (see generateImageVariants in fal.ts) -
  // consistency comes from reusing one real reference image, not from
  // re-describing the same thing in words each time and hoping the model
  // renders it the same way twice. 'vibe' is deliberately a separate kind
  // from the others: a mood/style/atmosphere reference (e.g. "cloudy grey
  // medieval light") is meant to influence tone, not be copied literally
  // into the frame the way a character's face or a product should be -
  // the prompt-builder (see reference/add and slot/generate-image routes)
  // treats the two differently for exactly this reason.
  await sql`
    CREATE TABLE IF NOT EXISTS storyboard_references (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES grid_storyboard_projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, -- 'character' | 'location' | 'product' | 'vibe'
      name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Which references (if any) a scene should stay consistent with - a
  // simple text[] rather than a join table since a slot's reference list
  // is always read/written as one unit (never queried from the reference
  // side), and Neon's driver passes JS string arrays through to a text[]
  // column natively.
  await sql`ALTER TABLE grid_storyboard_slots ADD COLUMN IF NOT EXISTS reference_ids TEXT[] NOT NULL DEFAULT '{}'`;
  // Real cost-exposure fix (security audit, 2026-09-16): the scene's own
  // INITIAL image generation had no cap at all (unlike its edit flow, which
  // was already capped by image_edit_count) - a signed-in user could call
  // generate-image for the same scene indefinitely, each call a real billed
  // fal.ai request. See MAX_SCENE_IMAGE_GENERATIONS/recordAdStudioSceneImageGeneration below.
  await sql`ALTER TABLE ad_studio_scenes ADD COLUMN IF NOT EXISTS image_generate_count INT NOT NULL DEFAULT 0`;
  // Character-video generation (2026-09-11) - pick one of the pre-made
  // AI actors, choose a voice (a Lucy preset -> Kling Avatar lip-sync, or
  // "veo" -> Veo generates its own dialogue+voice), type text. Billed
  // through the access_token/subscribers video-credit quota above, NOT the
  // user_id/prepaid video_credits table video_paygo_jobs uses - this is a
  // Video-plan subscription perk, not a separate purchase.
  await sql`
    CREATE TABLE IF NOT EXISTS character_video_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      access_token TEXT NOT NULL,
      character_id TEXT NOT NULL,
      voice_choice TEXT NOT NULL,
      script TEXT NOT NULL,
      credits_cost INTEGER NOT NULL,
      fal_endpoint TEXT NOT NULL,
      modal_job_id TEXT,
      fal_request_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      video_url TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Two new video modes (2026-09-11), both billed against a Video-plan
  // subscriber's existing video-credit quota (access_token +
  // checkVideoCreditQuota/incrementUsage - same mechanism as
  // character_video_jobs above), kept in ONE table since they share the
  // same billing path and a very similar multi-phase pipeline, rather than
  // adding two more near-duplicate tables:
  // - 'custom': user's OWN photo/video-frame, animated via Kling Avatar to
  //   speak their typed script in either a cloned version of their own
  //   voice or a picked Lucy preset - the "hyper-realistic, exactly your
  //   likeness" mode.
  // - 'cinematic': user's own photo/video-frame drives a Veo-generated
  //   scene from a text prompt, with audio being either Veo's own
  //   generated voice, the user's own uploaded audio, or a Lucy voice
  //   (the latter two muxed on afterward via fal's ffmpeg merge-audio-video
  //   utility, since neither is a lip-sync step the way Kling Avatar is -
  //   disclosed as such in the UI).
  await sql`
    CREATE TABLE IF NOT EXISTS subscription_video_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      access_token TEXT NOT NULL,
      mode TEXT NOT NULL, -- 'custom' | 'cinematic'
      reference_image_url TEXT NOT NULL,
      prompt TEXT NOT NULL, -- script (custom) or scene description (cinematic)
      audio_source TEXT NOT NULL, -- 'lucy_preset' | 'lucy_cloned' | 'own_upload' | 'engine_native'
      preset_voice_id TEXT,
      credits_cost INTEGER NOT NULL,
      fal_endpoint TEXT NOT NULL,
      modal_job_id TEXT, -- set only when audio_source is lucy_preset/lucy_cloned (TTS phase)
      resolved_audio_url TEXT, -- the audio actually used: TTS result upload, or the user's own upload
      fal_request_id TEXT, -- main video-generation request (Kling Avatar or Veo)
      needs_merge BOOLEAN NOT NULL DEFAULT false,
      merge_request_id TEXT, -- fal ffmpeg merge-audio-video request, only when needs_merge
      status TEXT NOT NULL DEFAULT 'pending',
      video_url TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Pay-as-you-go (mode 4) gains optional image/video-frame and audio
  // references alongside the existing text-only prompt - added via ALTER
  // since video_paygo_jobs already exists in production.
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS input_image_url TEXT`;
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS input_audio_url TEXT`;
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS needs_merge BOOLEAN NOT NULL DEFAULT false`;
  // Column name predates 2026-09-12's switch to real lip-sync (see
  // submitLipsyncJob in fal.ts) - this now holds a Kling lipsync request id,
  // not an ffmpeg merge request id like subscription_video_jobs' column of
  // the same name still does. Not renamed - same shape, not worth a migration.
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS merge_request_id TEXT`;
  // The actual fal endpoint used for this specific job - varies per job now
  // (plain text-to-video vs. image-to-video vs. Kling Avatar) depending on
  // which uploads were given, so it can no longer be re-derived from just
  // the engine name at poll time the way it could when every job used the
  // same fixed endpoint per engine.
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS fal_endpoint TEXT`;
  // "A Lucy voice" audio option (2026-09-12) - same phased pattern
  // subscription_video_jobs already uses for cinematic's lucy_preset: a
  // Modal TTS pass has to finish before the real video job can even be
  // submitted (Kling needs the real audio_url for Avatar; every other
  // engine renders silent first regardless, but still needs to know the
  // job "isn't ready to submit yet" while TTS is in flight). input_audio_url
  // (already added above for uploaded audio) doubles as the resolved TTS
  // output once it's ready - only one of "uploaded" or "TTS" is ever set
  // per job, never both.
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS modal_job_id TEXT`;
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS preset_voice_id TEXT`;
  // The raw, silent engine output from just before the lip-sync pass
  // (2026-09-12) - previously fetched and used as submitLipsyncJob's input,
  // then thrown away once the lip-synced result was ready. Kept now so a
  // customer can download both: the model's actual unmodified footage, and
  // our lip-synced attempt on top of it. Only ever set on the
  // needs_merge=true path (Veo/Seedance/Grok/MiniMax + audio) - Kling's own
  // Avatar path generates audio+video together in one step, so there's no
  // separate silent version to keep for it.
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS silent_video_url TEXT`;
  // Same idea, same day, for cinematic mode's own needs_merge path - Veo's
  // raw silent clip (generate_audio: false) gets fetched, then muxed with
  // the resolved audio via fal's ffmpeg-api/merge-audio-video, and was
  // previously thrown away right after. 'custom' mode never sets this - it
  // only ever uses Kling Avatar directly (audio drives the whole
  // generation from the start), so there's no silent version to keep.
  await sql`ALTER TABLE subscription_video_jobs ADD COLUMN IF NOT EXISTS silent_video_url TEXT`;
  // Honest lip-sync choice (2026-09-14) - previously pay-as-you-go always
  // attempted real lip-sync the moment audio was added, with no way to opt
  // out even though non-Kling engines' two-step lip-sync pass doesn't
  // always land well (per direct feedback: "rather than force lip-sync and
  // hope it lands, give the user the choice, honestly labeled"). 'lipsync'
  // preserves the exact prior behavior (Kling Avatar in one step, or a
  // silent render + real Kling lipsync pass for every other engine).
  // 'voiceover' is new: renders silent/ambient exactly the same way, but
  // muxes the audio track on afterward via fal's plain ffmpeg
  // merge-audio-video utility (see FFMPEG_MERGE_ENDPOINT in fal.ts) instead
  // of attempting to reshape the mouth at all - the most reliable option
  // precisely because it never tries to sync anything. Applies to Kling too
  // in 'voiceover' mode (skips Avatar, uses the normal image/text-to-video
  // endpoint like every other engine).
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS lip_sync_mode TEXT NOT NULL DEFAULT 'lipsync'`;
  // 2026-09-15: user-chosen duration/aspect ratio, per direct request to
  // expose these like ElevenLabs does rather than one fixed value per
  // engine. Persisted on the job (not just passed straight to buildFalInput
  // in generate/route.ts) so a Lucy-voice generation - deferred to
  // status/route.ts's phase 0 until the TTS pass resolves - still honors
  // the original choice instead of silently falling back to the engine
  // default. Both nullable: null means "use the engine's own default",
  // same behavior as before this column existed.
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS duration_seconds INTEGER`;
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS aspect_ratio TEXT`;
  // Real fix (follow-up audit, 2026-09-17): the 'CLAIMING' sentinel used by
  // claim*ForFalSubmit/claim*ForMergeSubmit below could stall a job forever
  // if the process died between writing the sentinel and writing the real
  // id (a crash/redeploy mid-request, not the already-handled "submission
  // itself throws" case) - the job would sit un-reclaimable, with its
  // credits never released, since a truthy sentinel always looked like "a
  // submission is already in flight". These timestamps let each claim
  // function tell "genuinely in flight" apart from "abandoned minutes ago"
  // and reclaim the latter - see STALE_CLAIM_INTERVAL below.
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS fal_claimed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE video_paygo_jobs ADD COLUMN IF NOT EXISTS merge_claimed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE character_video_jobs ADD COLUMN IF NOT EXISTS fal_claimed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE subscription_video_jobs ADD COLUMN IF NOT EXISTS fal_claimed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE subscription_video_jobs ADD COLUMN IF NOT EXISTS merge_claimed_at TIMESTAMPTZ`;
}

// Every claim*ForFalSubmit/claim*ForMergeSubmit function below uses this
// same "10 minutes" window, hardcoded directly in each query rather than
// interpolated from a shared constant - a Neon `sql` tagged template binds
// ANY `${}` as a query parameter regardless of surrounding quote characters,
// so interpolating a value INSIDE `interval '...'` silently produces
// malformed SQL (`interval '$1'`) instead of splicing in the literal text.
// Same real bug already caught once this session (see createLoginToken's
// own comment) - not repeating it here. If this window ever needs to
// change, update all 5 occurrences of `interval '10 minutes'` below.

// Generic runtime settings, switchable from the admin dashboard without a
// redeploy - see @/lib/inferenceBackend for why this exists (env vars
// require a fresh Vercel deploy to take effect, which turned out to be
// unreliable via the CLI's `redeploy` and is real friction either way for
// something that should be a one-click operational toggle).
export async function getSetting(key: string): Promise<string | null> {
  const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return (rows[0]?.value as string) ?? null;
}

export async function setSetting(key: string, value: string) {
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

// "Real time" here means a heartbeat, not a persistent connection - the
// client pings this every ~20s while the tab is open/visible (see
// VisitTracker.tsx), so "active in the last 60s" is a reasonable proxy for
// concurrent visitors without needing websockets/SSE infrastructure.
const ACTIVE_WINDOW_SECONDS = 60;

export async function recordVisit(sessionId: string, path: string) {
  await sql`INSERT INTO page_visits (session_id, path) VALUES (${sessionId}, ${path})`;
}

export async function getVisitStats() {
  // Multiplying a bound parameter by a fixed interval literal (rather than
  // interpolating the number inside `interval '... seconds'`) - the latter
  // puts the query parameter placeholder inside a string literal, which
  // postgres does not substitute into, and errors.
  const [{ active_now }] = await sql`
    SELECT COUNT(DISTINCT session_id) AS active_now FROM page_visits
    WHERE created_at > now() - (${ACTIVE_WINDOW_SECONDS} * interval '1 second')
  `;
  const [{ visits_today }] = await sql`
    SELECT COUNT(DISTINCT session_id) AS visits_today FROM page_visits
    WHERE created_at > date_trunc('day', now())
  `;
  const recentPaths = await sql`
    SELECT path, COUNT(DISTINCT session_id) AS visitors FROM page_visits
    WHERE created_at > now() - (${ACTIVE_WINDOW_SECONDS} * interval '1 second')
    GROUP BY path ORDER BY visitors DESC
  `;
  return {
    activeNow: Number(active_now),
    visitsToday: Number(visits_today),
    activePaths: recentPaths.map((r) => ({ path: r.path as string, visitors: Number(r.visitors) })),
  };
}

// Excludes visually-ambiguous characters (0/O, 1/I/L) - this gets typed
// back in by hand from an email or a screen, so a customer misreading one
// character for another is a real support-ticket risk, not just a
// cosmetic concern. 32 symbols divides evenly into 256 (a random byte's
// range), so `byte % 32` below has zero modulo bias - every symbol is
// exactly as likely as every other.
const ACCESS_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateAccessToken(): string {
  // Branded and short - e.g. "Lucy_7F3KQW2M", per direct request for the
  // code to look like "Lucy_xxxx" - shorter and simpler than the
  // dash-grouped 16-symbol version this replaced. 8 random symbols from
  // the 32-char alphabet above is 40 bits of entropy - short enough to
  // read and type comfortably, still far more than a 4-character code
  // would give (thin enough to be a real online-guessing concern with no
  // rate limit on the lookup endpoints) while staying visually close to
  // the requested "xxxx"-length example.
  const bytes = randomBytes(8);
  let out = "Lucy_";
  for (let i = 0; i < 8; i++) {
    out += ACCESS_TOKEN_ALPHABET[bytes[i] % ACCESS_TOKEN_ALPHABET.length];
  }
  return out;
}

// Call once at the top of the Stripe webhook handler, before acting on the
// event. Returns true only the first time a given event id is seen -
// INSERT ... ON CONFLICT DO NOTHING is atomic, so two concurrent deliveries
// of the same event can't both pass this check. If it returns false, the
// event has already been processed (or is being processed right now) and
// the handler should skip straight to returning 200 without repeating any
// side effects (granting credits, sending emails, etc.).
export async function claimStripeEvent(eventId: string): Promise<boolean> {
  const rows = await sql`
    INSERT INTO processed_stripe_events (event_id) VALUES (${eventId})
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
  `;
  return rows.length > 0;
}

// Real fix (follow-up audit, 2026-09-17): claimStripeEvent runs BEFORE the
// webhook's actual side effect (granting credits, upserting a subscriber,
// etc.) - if that side effect then throws, the claim had already committed,
// so Stripe's automatic retry of the same event (triggered by the 500 the
// throw produces) would find the event already "processed" and skip
// straight to a no-op duplicate response, never actually retrying the
// effect that failed. Call this from the webhook route's catch block to
// undo the claim before returning an error, so the next redelivery can
// genuinely reprocess instead of being silently swallowed.
export async function unclaimStripeEvent(eventId: string): Promise<void> {
  await sql`DELETE FROM processed_stripe_events WHERE event_id = ${eventId}`;
}

// Atomic claim with a short grace window, not strict one-shot - see
// delivered_job_audio's own comment for why this exists. A legitimate
// client can retry a few times right after completion (a dropped
// connection, a re-render, the normal poll loop's last couple of ticks
// overlapping delivery) without getting locked out; call this on EVERY
// COMPLETED response, and only actually return the audio when it's true.
// The `ON CONFLICT ... WHERE` clause is what makes this conditional: a
// retry inside the window re-satisfies the WHERE and returns a row (still
// "delivered"), a call after the window doesn't match it and returns no
// row (blocked) - the same "no row back = not allowed" shape as every
// other atomic claim in this file, just with a time bound instead of a
// status check.
export async function claimJobAudioDelivery(jobId: string): Promise<boolean> {
  const rows = await sql`
    INSERT INTO delivered_job_audio (job_id) VALUES (${jobId})
    ON CONFLICT (job_id) DO UPDATE SET job_id = delivered_job_audio.job_id
    WHERE delivered_job_audio.delivered_at > now() - interval '2 minutes'
    RETURNING job_id
  `;
  return rows.length > 0;
}

export async function upsertSubscriberForCheckout(params: {
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: PlanId;
  periodStart: Date;
  periodEnd: Date;
}): Promise<string> {
  const existing = await sql`
    SELECT access_token FROM subscribers WHERE stripe_customer_id = ${params.stripeCustomerId}
  `;
  const accessToken = existing[0]?.access_token ?? generateAccessToken();

  await sql`
    INSERT INTO subscribers (email, stripe_customer_id, stripe_subscription_id, plan, status, access_token, period_start, period_end, characters_used, video_seconds_used)
    VALUES (${params.email}, ${params.stripeCustomerId}, ${params.stripeSubscriptionId}, ${params.plan}, 'active', ${accessToken}, ${params.periodStart.toISOString()}, ${params.periodEnd.toISOString()}, 0, 0)
    ON CONFLICT (stripe_customer_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = 'active',
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      period_start = EXCLUDED.period_start,
      period_end = EXCLUDED.period_end,
      characters_used = 0,
      video_seconds_used = 0
  `;
  return accessToken;
}

export async function setSubscriberStatus(stripeCustomerId: string, status: Subscriber["status"]) {
  await sql`UPDATE subscribers SET status = ${status} WHERE stripe_customer_id = ${stripeCustomerId}`;
}

export async function getSubscriberByToken(token: string): Promise<Subscriber | null> {
  const rows = await sql`SELECT * FROM subscribers WHERE access_token = ${token}`;
  return (rows[0] as Subscriber) ?? null;
}

export async function getSubscriberByCustomerId(stripeCustomerId: string): Promise<Subscriber | null> {
  const rows = await sql`SELECT * FROM subscribers WHERE stripe_customer_id = ${stripeCustomerId}`;
  return (rows[0] as Subscriber) ?? null;
}

export async function incrementUsage(token: string, characters: number, videoSeconds: number) {
  await sql`
    UPDATE subscribers
    SET characters_used = characters_used + ${characters},
        video_seconds_used = video_seconds_used + ${videoSeconds}
    WHERE access_token = ${token}
  `;
}

export function checkQuota(sub: Subscriber, additionalCharacters: number): string | null {
  const plan = PLANS[sub.plan];
  if (sub.status !== "active") {
    return "Your subscription isn't active - check your billing status.";
  }
  if (sub.characters_used + additionalCharacters > plan.charactersPerMonth) {
    return `This would put you over your ${plan.name} plan's ${plan.charactersPerMonth.toLocaleString()} character/month limit. Upgrade or wait for your next billing period.`;
  }
  return null;
}

// Atomic reservation, same pattern as spendVideoCredit's `WHERE balance > 0`
// guard - checkQuota alone is a plain read-then-compare against a value
// fetched earlier in the request, so two concurrent requests can both read
// the same pre-generation characters_used and both pass, together landing
// over the real limit. This actually claims the quota in one statement:
// the WHERE clause is re-evaluated against the current committed row when
// the update lock is acquired, so a second concurrent call sees the first
// call's already-applied increment and correctly fails if it would now
// exceed the limit. Call this INSTEAD of (not in addition to) incrementUsage
// for the characters argument - it already performs that increment.
export async function reserveCharacterUsage(token: string, characters: number, limit: number): Promise<boolean> {
  const rows = await sql`
    UPDATE subscribers
    SET characters_used = characters_used + ${characters}
    WHERE access_token = ${token} AND status = 'active' AND characters_used + ${characters} <= ${limit}
    RETURNING characters_used
  `;
  return rows.length > 0;
}

// Character-video generation (2026-09-11) is the first real feature to
// actually draw from the Video plan's video_seconds_used/videoCreditsPerMonth
// tracking - previously "reserved/aspirational" (see plans.ts). Reuses the
// exact same column/limit, just checked here instead of only characters.
export function checkVideoCreditQuota(sub: Subscriber, additionalCredits: number): string | null {
  const plan = PLANS[sub.plan];
  if (sub.status !== "active") {
    return "Your subscription isn't active - check your billing status.";
  }
  if (plan.videoCreditsPerMonth <= 0) {
    return "Character videos need the Video plan - upgrade to get 40 video credits/month.";
  }
  if (sub.video_seconds_used + additionalCredits > plan.videoCreditsPerMonth) {
    return `This would put you over your ${plan.name} plan's ${plan.videoCreditsPerMonth} video credits/month. Wait for your next billing period.`;
  }
  return null;
}

// Atomic reservation for video credits - same reasoning/pattern as
// reserveCharacterUsage above. checkVideoCreditQuota is still useful as a
// fast, friendly pre-check (wrong plan / inactive subscription messages),
// but this is the actual enforcement: several concurrent video-generation
// requests submitted before any of them completes can no longer all pass
// against the same stale video_seconds_used snapshot. Real bug this
// replaces: usage was previously only incremented when a job *completed*
// (30-90s later), leaving a wide window where concurrent submissions could
// push a subscriber arbitrarily over quota with zero enforcement, each one
// still costing real fal.ai/Kling/Veo money regardless of the cap.
export async function reserveVideoCredits(token: string, credits: number, limit: number): Promise<boolean> {
  const rows = await sql`
    UPDATE subscribers
    SET video_seconds_used = video_seconds_used + ${credits}
    WHERE access_token = ${token} AND status = 'active' AND video_seconds_used + ${credits} <= ${limit}
    RETURNING video_seconds_used
  `;
  return rows.length > 0;
}

// Used when a video job fails outright after credits were already reserved
// at submission time (see reserveVideoCredits) - the user shouldn't lose
// quota for a video they never got. Same reasoning as refundVideoCredit for
// the separate prepaid pay-as-you-go balance below. GREATEST(0, ...) guards
// against ever going negative if this is ever (mis)called twice for the
// same job.
export async function releaseVideoCredits(token: string, credits: number) {
  await sql`
    UPDATE subscribers
    SET video_seconds_used = GREATEST(0, video_seconds_used - ${credits})
    WHERE access_token = ${token}
  `;
}

// Free-tier tracking for anonymous (no access token) users. There's no
// login, so this is tied to a random id the browser generates and stores in
// localStorage (see useFreeTierId.ts) - honest limitation: clearing site
// data or switching browsers resets it. Deliberately not IP-based (this
// site's privacy policy already commits to not collecting IP addresses,
// and IP-based tracking is at least as easy to evade via a different
// network anyway) - this is a soft nudge toward upgrading, not airtight
// metering.
export type FreeTierUsage = { charactersUsed: number; charactersLimit: number; periodEnd: string };

// Real bug fixed here (security audit, 2026-09-16): `checkFreeQuota` used to
// call straight through to `getFreeTierUsage`, which treats ANY id it's
// never seen - including a missing/empty one - as a brand-new, always-
// under-quota bucket. That meant a caller could get unlimited free
// generations for free by simply omitting `free_tier_id` (or sending a
// fresh empty string) on every request - no browser, no localStorage-
// clearing effort required, unlike the accepted "clear site data to reset"
// tradeoff this feature is actually designed around (see the comment
// above). Requiring the id to actually be the well-formed UUID the client
// is supposed to generate (useFreeTierId.ts) closes the trivial bypass
// while leaving the documented, accepted limitation exactly as it was -
// this is deliberately NOT a move to IP-based tracking (see above).
const FREE_TIER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidFreeTierId(id: string): boolean {
  return FREE_TIER_ID_PATTERN.test(id);
}

export async function getFreeTierUsage(id: string): Promise<FreeTierUsage> {
  const limit = PLANS.free.charactersPerMonth;
  if (!id) return { charactersUsed: 0, charactersLimit: limit, periodEnd: new Date().toISOString() };
  const rows = await sql`SELECT characters_used, period_end FROM free_tier_usage WHERE id = ${id}`;
  const row = rows[0];
  if (!row || new Date(row.period_end as string) < new Date()) {
    // Never seen, or their period already rolled over - report a fresh
    // allowance; recordFreeUsage performs the actual reset on next use.
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);
    return { charactersUsed: 0, charactersLimit: limit, periodEnd: periodEnd.toISOString() };
  }
  return { charactersUsed: row.characters_used as number, charactersLimit: limit, periodEnd: row.period_end as string };
}

export async function checkFreeQuota(id: string, additionalCharacters: number): Promise<string | null> {
  // Gate BEFORE reading usage, not after - see the comment above. A missing/
  // malformed id can never pass, regardless of how little it asks for.
  if (!isValidFreeTierId(id)) {
    return "Could not verify your free usage - please refresh the page and try again.";
  }
  const usage = await getFreeTierUsage(id);
  if (usage.charactersUsed + additionalCharacters > usage.charactersLimit) {
    const resetDate = new Date(usage.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    return `You've used your free ${usage.charactersLimit.toLocaleString()} characters this month. Resets ${resetDate}, or upgrade for more right away.`;
  }
  return null;
}

export async function recordFreeUsage(id: string, characters: number) {
  if (!isValidFreeTierId(id)) return;
  await sql`
    INSERT INTO free_tier_usage (id, characters_used, period_start, period_end)
    VALUES (${id}, ${characters}, now(), now() + interval '30 days')
    ON CONFLICT (id) DO UPDATE SET
      characters_used = CASE
        WHEN free_tier_usage.period_end < now() THEN ${characters}
        ELSE free_tier_usage.characters_used + ${characters}
      END,
      period_start = CASE WHEN free_tier_usage.period_end < now() THEN now() ELSE free_tier_usage.period_start END,
      period_end = CASE WHEN free_tier_usage.period_end < now() THEN now() + interval '30 days' ELSE free_tier_usage.period_end END
  `;
}

// --- Real sign-in (magic link + Google), sessions, and generation history ---
//
// Deliberately hand-rolled the same way as `access_token` above and the
// admin password gate, rather than pulling in an auth library: opaque
// random tokens, looked up by exact match in Postgres. `login_tokens` are
// single-use email verification codes (consumed by DELETE ... RETURNING);
// `sessions` are long-lived opaque ids stored in an httpOnly cookie (see
// @/lib/auth). This intentionally does NOT replace the access_token/quota
// system above - logging in just syncs a subscriber's existing access_token
// into the browser (see /api/account), so generate-preset/clone-voice need
// no changes at all.

export type User = {
  id: string;
  email: string;
  google_id: string | null;
  created_at: string;
};

export type Generation = {
  id: string;
  user_id: string;
  kind: "preset" | "clone";
  voice_label: string | null;
  text_preview: string;
  audio_url: string;
  created_at: string;
  expires_at: string;
};

function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

// Real fix (security audit, 2026-09-16): no rate limit existed anywhere in
// the magic-link chain - anyone could POST request-link in a tight loop,
// email-bombing an arbitrary inbox and creating unbounded token rows. A
// simple per-email cap over a real window closes it without needing a
// separate rate-limiting service; the check lives here (not just at the
// route) so it applies regardless of caller.
const LOGIN_TOKEN_RATE_LIMIT = 3;

export async function createLoginToken(email: string): Promise<string> {
  // The window is a static literal, not interpolated - a `${...}` placed
  // inside the quotes of `interval '...'` would be bound as a query
  // parameter at that exact (quoted) position, not spliced into the SQL
  // text, producing `interval '$1'` (a literal string Postgres can't parse
  // as an interval) rather than the intended 15-minute window.
  const recent = await sql`
    SELECT count(*)::int AS count FROM login_tokens
    WHERE email = ${email} AND created_at > now() - interval '15 minutes'
  `;
  if ((recent[0]?.count as number) >= LOGIN_TOKEN_RATE_LIMIT) {
    throw new Error("Too many sign-in links requested for this email - please wait a few minutes and try again.");
  }
  const token = generateOpaqueToken();
  await sql`
    INSERT INTO login_tokens (token, email, expires_at)
    VALUES (${token}, ${email}, now() + interval '15 minutes')
  `;
  return token;
}

// Single-use: the DELETE...RETURNING both validates and consumes the token
// in one round trip, so a token can never be replayed even under a race.
export async function consumeLoginToken(token: string): Promise<string | null> {
  const rows = await sql`
    DELETE FROM login_tokens WHERE token = ${token} AND expires_at > now()
    RETURNING email
  `;
  return (rows[0]?.email as string) ?? null;
}

export async function upsertUserByEmail(email: string): Promise<User> {
  const rows = await sql`
    INSERT INTO users (email) VALUES (${email})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING *
  `;
  return rows[0] as User;
}

// Real account-takeover fix (security audit, 2026-09-16): this used to
// unconditionally overwrite an existing email row's google_id on every
// call (`SET google_id = EXCLUDED.google_id`), regardless of whether that
// row already had a DIFFERENT google_id linked. Combined with the callback
// route not checking `email_verified`, that meant a second Google account
// claiming the same email (e.g. an unverified/edge-case Google identity)
// could silently rebind - and log in as - an existing user's account,
// inheriting whatever subscriber/history was already attached to it.
// `COALESCE` now only fills in google_id when the row doesn't have one yet
// (first-time linking, still fully supported); an already-linked row that
// doesn't match the incoming googleId is left untouched and rejected below.
export async function upsertUserByGoogle(email: string, googleId: string): Promise<User> {
  const existingByGoogle = await sql`SELECT * FROM users WHERE google_id = ${googleId}`;
  if (existingByGoogle[0]) return existingByGoogle[0] as User;
  const rows = await sql`
    INSERT INTO users (email, google_id) VALUES (${email}, ${googleId})
    ON CONFLICT (email) DO UPDATE SET google_id = COALESCE(users.google_id, EXCLUDED.google_id)
    RETURNING *
  `;
  const user = rows[0] as User;
  if (user.google_id !== googleId) {
    throw new Error("This email is already linked to a different Google account. Try signing in with email instead.");
  }
  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return (rows[0] as User) ?? null;
}

export async function createSessionRow(userId: string): Promise<string> {
  const id = generateOpaqueToken();
  await sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${id}, ${userId}, now() + interval '30 days')`;
  return id;
}

export async function getSessionUserRow(sessionId: string): Promise<User | null> {
  const rows = await sql`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sessionId} AND s.expires_at > now()
  `;
  return (rows[0] as User) ?? null;
}

export async function deleteSessionRow(sessionId: string) {
  await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

// Lazily attaches any pre-existing subscriber (from a checkout made before
// this person had a real account) to their new user id, matched by email.
// Only claims rows nobody has claimed yet, so this is safe to call on every
// login with no risk of stealing another account's subscription.
export async function linkSubscriberToUser(email: string, userId: string) {
  await sql`UPDATE subscribers SET user_id = ${userId} WHERE email = ${email} AND user_id IS NULL`;
}

export async function getSubscriberByUserId(userId: string): Promise<Subscriber | null> {
  const rows = await sql`SELECT * FROM subscribers WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`;
  return (rows[0] as Subscriber) ?? null;
}

// Tunable from /admin without a redeploy, same pattern as the inference
// backend toggle - lets retention (and therefore Blob storage cost) be
// adjusted after seeing real traffic instead of guessing once and shipping.
export async function getGenerationRetentionDays(): Promise<number> {
  const stored = await getSetting("generation_retention_days");
  const n = stored ? parseInt(stored, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 14;
}

export async function recordGeneration(params: {
  userId: string;
  kind: "preset" | "clone";
  voiceLabel: string | null;
  textPreview: string;
  audioUrl: string;
}) {
  const retentionDays = await getGenerationRetentionDays();
  await sql`
    INSERT INTO generations (user_id, kind, voice_label, text_preview, audio_url, expires_at)
    VALUES (${params.userId}, ${params.kind}, ${params.voiceLabel}, ${params.textPreview}, ${params.audioUrl}, now() + (${retentionDays} * interval '1 day'))
  `;
}

export async function listGenerationsForUser(userId: string): Promise<Generation[]> {
  const rows = await sql`
    SELECT * FROM generations WHERE user_id = ${userId} AND expires_at > now() ORDER BY created_at DESC
  `;
  return rows as Generation[];
}

export async function getExpiredGenerations(): Promise<Generation[]> {
  const rows = await sql`SELECT * FROM generations WHERE expires_at <= now()`;
  return rows as Generation[];
}

export async function deleteGenerationsByIds(ids: string[]) {
  if (ids.length === 0) return;
  await sql`DELETE FROM generations WHERE id = ANY(${ids}::uuid[])`;
}

// Serverless generation is async (submit job -> poll job-status), so at
// submission time we only know who asked for it, not the finished audio -
// this bridges the two requests. Pod mode never needs this since audio
// comes back synchronously in the same request that knows the user.
export type PendingGeneration = {
  job_id: string;
  user_id: string;
  kind: "preset" | "clone";
  voice_label: string | null;
  text_preview: string;
};

export async function createPendingGeneration(params: {
  jobId: string;
  userId: string;
  kind: "preset" | "clone";
  voiceLabel: string | null;
  text: string;
}) {
  await sql`
    INSERT INTO pending_generations (job_id, user_id, kind, voice_label, text_preview)
    VALUES (${params.jobId}, ${params.userId}, ${params.kind}, ${params.voiceLabel}, ${params.text.slice(0, 200)})
  `;
}

// Single-use, same DELETE...RETURNING pattern as consumeLoginToken - a
// completed job could in principle be polled more than once before the
// client stops, and this ensures it's only ever recorded once.
export async function consumePendingGeneration(jobId: string): Promise<PendingGeneration | null> {
  const rows = await sql`DELETE FROM pending_generations WHERE job_id = ${jobId} RETURNING *`;
  return (rows[0] as PendingGeneration) ?? null;
}

// --- Pay-as-you-go video credits ---

export async function getVideoCreditBalance(userId: string): Promise<number> {
  const rows = await sql`SELECT balance FROM video_credits WHERE user_id = ${userId}`;
  return rows[0] ? Number(rows[0].balance) : 0;
}

export async function addVideoCredits(userId: string, amount: number) {
  await sql`
    INSERT INTO video_credits (user_id, balance)
    VALUES (${userId}, ${amount})
    ON CONFLICT (user_id) DO UPDATE SET balance = video_credits.balance + ${amount}, updated_at = now()
  `;
}

// Atomic decrement guarded by the balance check in the same statement -
// two concurrent requests can't both succeed against a balance of 1 credit
// (the second one's WHERE clause simply matches zero rows). Returns false
// (not an error) when there's nothing to spend, same "expected outcome, not
// exceptional" shape as checkQuota() above.
export async function spendVideoCredit(userId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE video_credits SET balance = balance - 1, updated_at = now()
    WHERE user_id = ${userId} AND balance > 0
    RETURNING balance
  `;
  return rows.length > 0;
}

// Used when a generation fails outright (content-policy block, vendor
// error) - the user shouldn't lose a credit for a video they never got.
export async function refundVideoCredit(userId: string) {
  await addVideoCredits(userId, 1);
}

export type VideoPaygoJob = {
  id: string;
  user_id: string;
  engine: string;
  prompt: string;
  fal_request_id: string | null;
  fal_endpoint: string | null;
  input_image_url: string | null;
  input_audio_url: string | null;
  needs_merge: boolean;
  merge_request_id: string | null;
  modal_job_id: string | null;
  preset_voice_id: string | null;
  lip_sync_mode: "lipsync" | "voiceover";
  duration_seconds: number | null;
  aspect_ratio: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  video_url: string | null;
  silent_video_url: string | null;
  error: string | null;
  created_at: string;
};

export async function createVideoPaygoJob(params: {
  userId: string;
  engine: string;
  prompt: string;
  falEndpoint: string;
  inputImageUrl?: string | null;
  inputAudioUrl?: string | null;
  needsMerge?: boolean;
  presetVoiceId?: string | null;
  lipSyncMode?: "lipsync" | "voiceover";
  durationSeconds?: number | null;
  aspectRatio?: string | null;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO video_paygo_jobs (user_id, engine, prompt, fal_endpoint, input_image_url, input_audio_url, needs_merge, preset_voice_id, lip_sync_mode, duration_seconds, aspect_ratio)
    VALUES (
      ${params.userId}, ${params.engine}, ${params.prompt}, ${params.falEndpoint},
      ${params.inputImageUrl ?? null}, ${params.inputAudioUrl ?? null}, ${params.needsMerge ?? false}, ${params.presetVoiceId ?? null},
      ${params.lipSyncMode ?? "lipsync"}, ${params.durationSeconds ?? null}, ${params.aspectRatio ?? null}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function setVideoPaygoJobRequestId(jobId: string, falRequestId: string) {
  await sql`UPDATE video_paygo_jobs SET fal_request_id = ${falRequestId}, status = 'in_progress' WHERE id = ${jobId}`;
}

// Atomic claim (security audit, 2026-09-16): the phase-0 transition in
// status/route.ts used to be a plain "read fal_request_id, see it's null,
// submit a fal job" - a real double-submit race, since two overlapping
// polls for the same job (two tabs, a client retry) could both read null
// and both call submitFalJob, paying twice for the one credit already
// spent. Callers must call this FIRST and only proceed to submitFalJob if
// it returns true; the sentinel value is immediately overwritten by the
// real id via setVideoPaygoJobRequestId once submission succeeds, and if
// submission fails the whole job is failed (see failVideoPaygoJob) rather
// than left reclaimable, so there's no need to reset this back to null.
export async function claimVideoPaygoJobForFalSubmit(jobId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE video_paygo_jobs SET fal_request_id = 'CLAIMING', fal_claimed_at = now()
    WHERE id = ${jobId} AND (fal_request_id IS NULL OR (fal_request_id = 'CLAIMING' AND fal_claimed_at < now() - interval '10 minutes'))
    RETURNING id
  `;
  return rows.length > 0;
}

export async function setVideoPaygoJobModalId(jobId: string, modalJobId: string) {
  await sql`UPDATE video_paygo_jobs SET modal_job_id = ${modalJobId} WHERE id = ${jobId}`;
}

// Fills in the audio actually used once Lucy TTS resolves - reuses
// input_audio_url (the same column an uploaded audio file would occupy)
// since a given job only ever has one or the other, never both.
export async function setVideoPaygoJobResolvedAudio(jobId: string, audioUrl: string) {
  await sql`UPDATE video_paygo_jobs SET input_audio_url = ${audioUrl} WHERE id = ${jobId}`;
}

// Saves the raw silent engine output right before the lip-sync pass runs on
// top of it - see the silent_video_url column comment above for why.
export async function setVideoPaygoJobSilentVideo(jobId: string, silentVideoUrl: string) {
  await sql`UPDATE video_paygo_jobs SET silent_video_url = ${silentVideoUrl} WHERE id = ${jobId}`;
}

export async function completeVideoPaygoJob(jobId: string, videoUrl: string) {
  await sql`UPDATE video_paygo_jobs SET status = 'completed', video_url = ${videoUrl} WHERE id = ${jobId}`;
}

// Atomic claim: only the caller that actually transitions the row out of
// 'pending'/'in_progress' gets `true` back. Real bug this closes: two
// overlapping status-poll requests for the same job (two tabs, or a client
// retry racing the first response) could both observe a FAILED vendor
// status and both call this then refundVideoCredit, crediting back 2
// credits for the 1 originally spent. Callers must only refund when this
// returns true.
export async function failVideoPaygoJob(jobId: string, error: string): Promise<boolean> {
  const rows = await sql`
    UPDATE video_paygo_jobs SET status = 'failed', error = ${error}
    WHERE id = ${jobId} AND status NOT IN ('failed', 'completed')
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getVideoPaygoJob(jobId: string): Promise<VideoPaygoJob | null> {
  const rows = await sql`SELECT * FROM video_paygo_jobs WHERE id = ${jobId}`;
  return (rows[0] as VideoPaygoJob) ?? null;
}

export async function getVideoPaygoJobOwner(jobId: string): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM video_paygo_jobs WHERE id = ${jobId}`;
  return rows[0] ? (rows[0].user_id as string) : null;
}

export async function listVideoPaygoJobsForUser(userId: string): Promise<VideoPaygoJob[]> {
  const rows = await sql`
    SELECT * FROM video_paygo_jobs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20
  `;
  return rows as VideoPaygoJob[];
}

export type ProductAdJob = {
  id: string;
  user_id: string;
  model: string;
  brief: string;
  youtube_references: string | null;
  product_image_url: string;
  character_image_url: string;
  storyboard_metadata: Record<string, unknown>;
  fal_endpoint: string;
  fal_request_id: string | null;
  modal_job_id: string | null;
  audio_url: string | null;
  silent_video_url: string | null;
  lipsync_request_id: string | null;
  final_video_url: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  error: string | null;
  created_at: string;
};

export async function createProductAdJob(params: {
  userId: string;
  model: string;
  brief: string;
  youtubeReferences: string | null;
  productImageUrl: string;
  characterImageUrl: string;
  storyboardMetadata: Record<string, unknown>;
  falEndpoint: string;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO product_ad_jobs (
      user_id, model, brief, youtube_references, product_image_url,
      character_image_url, storyboard_metadata, fal_endpoint
    ) VALUES (
      ${params.userId}, ${params.model}, ${params.brief}, ${params.youtubeReferences},
      ${params.productImageUrl}, ${params.characterImageUrl}, ${JSON.stringify(params.storyboardMetadata)}::jsonb,
      ${params.falEndpoint}
    ) RETURNING id
  `;
  return rows[0].id as string;
}

export async function getProductAdJob(jobId: string): Promise<ProductAdJob | null> {
  const rows = await sql`SELECT * FROM product_ad_jobs WHERE id = ${jobId}`;
  return (rows[0] as ProductAdJob) ?? null;
}

export async function setProductAdModalId(jobId: string, modalJobId: string) {
  await sql`UPDATE product_ad_jobs SET modal_job_id = ${modalJobId}, status = 'in_progress' WHERE id = ${jobId}`;
}

export async function setProductAdFalRequestId(jobId: string, requestId: string) {
  await sql`UPDATE product_ad_jobs SET fal_request_id = ${requestId}, status = 'in_progress' WHERE id = ${jobId}`;
}

export async function setProductAdAudioUrl(jobId: string, audioUrl: string) {
  await sql`UPDATE product_ad_jobs SET audio_url = ${audioUrl} WHERE id = ${jobId}`;
}

export async function setProductAdSilentVideo(jobId: string, videoUrl: string) {
  await sql`UPDATE product_ad_jobs SET silent_video_url = ${videoUrl} WHERE id = ${jobId}`;
}

export async function setProductAdLipsyncRequestId(jobId: string, requestId: string) {
  await sql`UPDATE product_ad_jobs SET lipsync_request_id = ${requestId} WHERE id = ${jobId}`;
}

export async function completeProductAdJob(jobId: string, finalVideoUrl: string) {
  await sql`UPDATE product_ad_jobs SET status = 'completed', final_video_url = ${finalVideoUrl} WHERE id = ${jobId}`;
}

export async function failProductAdJob(jobId: string, error: string): Promise<boolean> {
  const rows = await sql`
    UPDATE product_ad_jobs SET status = 'failed', error = ${error}
    WHERE id = ${jobId} AND status NOT IN ('failed', 'completed')
    RETURNING id
  `;
  return rows.length > 0;
}

// --- Consent / audit trail ---

export type ConsentContentType = "voice_reference" | "character_image" | "product_image";
export type ConsentFeature = "clone-voice" | "product-ad" | "ad-studio";

// Best-effort by design: a DB hiccup here should never block a real,
// paying generation the way a failed quota/payment check should - this is
// an audit trail for a real dispute later, not a live gate that needs to
// be perfectly durable to do its job. Callers still REQUIRE the consent
// flag to be true before calling this (the actual gate), this only
// records that it was given.
export async function recordConsent(params: {
  userId: string | null;
  contentType: ConsentContentType;
  feature: ConsentFeature;
  consentText: string;
  ipAddress: string | null;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO consent_records (user_id, content_type, feature, consent_text, ip_address)
      VALUES (${params.userId}, ${params.contentType}, ${params.feature}, ${params.consentText}, ${params.ipAddress})
    `;
  } catch (err) {
    console.error("[consent] failed to record consent (generation proceeds anyway)", err);
  }
}

// --- Ad Studio (storyboard-first, scene-by-scene ad production) ---

export type AdStudioMode = "direct" | "auto" | "guided";

export type AdStudioProject = {
  id: string;
  user_id: string;
  mode: AdStudioMode;
  brief: string;
  video_model: string;
  status: "draft" | "in_progress" | "completed" | "failed";
  final_video_url: string | null;
  silent_video_url: string | null;
  error: string | null;
  created_at: string;
};

// pending_image -> image_ready (regenerable via editImageWithPrompt, any
// number of times) -> pending_video -> video_ready -> approved (locked in,
// won't be touched by a later "regenerate the whole project" action).
export type AdStudioSceneStatus = "pending_image" | "image_ready" | "pending_video" | "video_ready" | "approved" | "failed";

export type AdStudioScene = {
  id: string;
  project_id: string;
  order_index: number;
  shot_type: string;
  camera: string;
  action: string;
  dialogue: string | null;
  image_prompt: string;
  video_model: string;
  image_edit_count: number;
  image_generate_count: number;
  image_url: string | null;
  image_fal_request_id: string | null;
  video_url: string | null;
  video_fal_request_id: string | null;
  status: AdStudioSceneStatus;
  error: string | null;
  created_at: string;
};

export async function createAdStudioProject(params: {
  userId: string;
  mode: AdStudioMode;
  brief: string;
  videoModel: string;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO ad_studio_projects (user_id, mode, brief, video_model)
    VALUES (${params.userId}, ${params.mode}, ${params.brief}, ${params.videoModel})
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function getAdStudioProject(projectId: string): Promise<AdStudioProject | null> {
  const rows = await sql`SELECT * FROM ad_studio_projects WHERE id = ${projectId}`;
  return (rows[0] as AdStudioProject) ?? null;
}

export async function getAdStudioProjectOwner(projectId: string): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM ad_studio_projects WHERE id = ${projectId}`;
  return rows[0] ? (rows[0].user_id as string) : null;
}

export async function setAdStudioProjectStatus(projectId: string, status: AdStudioProject["status"]) {
  await sql`UPDATE ad_studio_projects SET status = ${status} WHERE id = ${projectId}`;
}

export async function completeAdStudioProject(projectId: string, finalVideoUrl: string, silentVideoUrl: string | null) {
  await sql`
    UPDATE ad_studio_projects
    SET status = 'completed', final_video_url = ${finalVideoUrl}, silent_video_url = ${silentVideoUrl}
    WHERE id = ${projectId}
  `;
}

export async function failAdStudioProject(projectId: string, error: string): Promise<boolean> {
  const rows = await sql`
    UPDATE ad_studio_projects SET status = 'failed', error = ${error}
    WHERE id = ${projectId} AND status NOT IN ('failed', 'completed')
    RETURNING id
  `;
  return rows.length > 0;
}

export async function createAdStudioScene(params: {
  projectId: string;
  orderIndex: number;
  shotType: string;
  camera: string;
  action: string;
  dialogue: string | null;
  imagePrompt: string;
  videoModel: string;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO ad_studio_scenes (project_id, order_index, shot_type, camera, action, dialogue, image_prompt, video_model)
    VALUES (${params.projectId}, ${params.orderIndex}, ${params.shotType}, ${params.camera}, ${params.action}, ${params.dialogue}, ${params.imagePrompt}, ${params.videoModel})
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function getAdStudioScene(sceneId: string): Promise<AdStudioScene | null> {
  const rows = await sql`SELECT * FROM ad_studio_scenes WHERE id = ${sceneId}`;
  return (rows[0] as AdStudioScene) ?? null;
}

export async function getAdStudioSceneProjectOwner(sceneId: string): Promise<string | null> {
  const rows = await sql`
    SELECT p.user_id FROM ad_studio_scenes s JOIN ad_studio_projects p ON p.id = s.project_id
    WHERE s.id = ${sceneId}
  `;
  return rows[0] ? (rows[0].user_id as string) : null;
}

export async function listAdStudioScenes(projectId: string): Promise<AdStudioScene[]> {
  const rows = await sql`
    SELECT * FROM ad_studio_scenes WHERE project_id = ${projectId} ORDER BY order_index ASC
  `;
  return rows as AdStudioScene[];
}

export async function setAdStudioSceneImageRequestId(sceneId: string, requestId: string) {
  await sql`UPDATE ad_studio_scenes SET image_fal_request_id = ${requestId}, status = 'pending_image' WHERE id = ${sceneId}`;
}

// Real cost-exposure fix (security audit, 2026-09-16): unlike edits (capped
// by MAX_SCENE_IMAGE_EDITS below), a scene's initial image generation had no
// cap at all - callable indefinitely, each call a real billed fal.ai
// request. 5 gives real room to regenerate before editing/approving,
// without being unbounded.
export const MAX_SCENE_IMAGE_GENERATIONS = 5;

// Real fix (follow-up audit, 2026-09-17): the caller's pre-check + this
// function used to be check-then-spend, not atomic - two concurrent
// requests for the same scene could both read image_generate_count under
// the cap, both pay for the (real, billed) fal call below, and only THEN
// race for which one's atomic UPDATE actually recorded. That still could
// never over-COUNT past the cap, but it could still over-SPEND (both fal
// calls happen regardless of which one wins the write). Fixed the same way
// video credits are handled elsewhere in this file: reserve the slot
// atomically BEFORE spending anything, release it if the paid call then
// fails, and finalize (no cap check needed - already reserved) once it
// succeeds.
export async function claimAdStudioSceneImageSlot(sceneId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE ad_studio_scenes
    SET image_generate_count = image_generate_count + 1
    WHERE id = ${sceneId} AND image_generate_count < ${MAX_SCENE_IMAGE_GENERATIONS}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function releaseAdStudioSceneImageSlot(sceneId: string): Promise<void> {
  await sql`
    UPDATE ad_studio_scenes
    SET image_generate_count = GREATEST(0, image_generate_count - 1)
    WHERE id = ${sceneId}
  `;
}

export async function recordAdStudioSceneImageGeneration(sceneId: string, imageUrl: string): Promise<void> {
  await sql`
    UPDATE ad_studio_scenes
    SET image_url = ${imageUrl}, status = 'image_ready'
    WHERE id = ${sceneId}
  `;
}

// Real cost-exposure fix (2026-09-14): a flat-priced project had no cap on
// how many times a user could edit one scene's image before approving it -
// each edit is a real, billed fal.ai call, so unlimited free edits meant
// unbounded cost on a fixed-price product. 3 mirrors the same "reasonable
// free iteration, not unlimited" ceiling used elsewhere in this app.
export const MAX_SCENE_IMAGE_EDITS = 3;

// Atomic increment-and-check, same pattern as reserveCharacterUsage above -
// a naive "read count, check < 3, then update" has the same race-condition
// risk (two overlapping edit requests both reading count=2, both passing,
// landing at count=4) that pattern was written to close elsewhere in this
// file. Returns false without writing anything if the cap's already hit.
export async function recordAdStudioSceneEdit(sceneId: string, imageUrl: string): Promise<boolean> {
  const rows = await sql`
    UPDATE ad_studio_scenes
    SET image_url = ${imageUrl}, image_edit_count = image_edit_count + 1
    WHERE id = ${sceneId} AND image_edit_count < ${MAX_SCENE_IMAGE_EDITS}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function setAdStudioSceneVideoRequestId(sceneId: string, requestId: string) {
  await sql`UPDATE ad_studio_scenes SET video_fal_request_id = ${requestId}, status = 'pending_video' WHERE id = ${sceneId}`;
}

export async function setAdStudioSceneVideo(sceneId: string, videoUrl: string) {
  await sql`UPDATE ad_studio_scenes SET video_url = ${videoUrl}, status = 'video_ready' WHERE id = ${sceneId}`;
}

export async function approveAdStudioScene(sceneId: string) {
  await sql`UPDATE ad_studio_scenes SET status = 'approved' WHERE id = ${sceneId}`;
}

// Atomic claim, same shape and reasoning as failVideoPaygoJob above (real
// bug fixed here, security audit 2026-09-16: this used to be a plain
// unconditional UPDATE with no RETURNING - now that scene video generation
// spends a real video credit, two overlapping status-poll requests for the
// same failed scene could otherwise both pass and both refund, crediting
// back 2 for the 1 spent). Callers must only refund when this returns true.
export async function failAdStudioScene(sceneId: string, error: string): Promise<boolean> {
  const rows = await sql`
    UPDATE ad_studio_scenes SET status = 'failed', error = ${error}
    WHERE id = ${sceneId} AND status NOT IN ('failed', 'video_ready', 'approved')
    RETURNING id
  `;
  return rows.length > 0;
}

// --- Grid storyboard (manual, pay-per-slot, no auto-generated brief) ---

export type GridStoryboardProject = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
};

export type GridStoryboardSlotStatus = "empty" | "image_ready" | "pending_video" | "video_ready" | "failed";

export type GridStoryboardSlot = {
  id: string;
  project_id: string;
  order_index: number;
  image_url: string | null;
  prompt: string | null;
  video_model: string | null;
  video_url: string | null;
  video_fal_request_id: string | null;
  status: GridStoryboardSlotStatus;
  error: string | null;
  reference_ids: string[];
  created_at: string;
};

export type StoryboardReferenceKind = "character" | "location" | "product" | "vibe";

export type StoryboardReference = {
  id: string;
  project_id: string;
  kind: StoryboardReferenceKind;
  name: string;
  image_url: string;
  created_at: string;
};

export async function createGridStoryboardProject(userId: string, title: string | null): Promise<string> {
  const rows = await sql`
    INSERT INTO grid_storyboard_projects (user_id, title) VALUES (${userId}, ${title}) RETURNING id
  `;
  return rows[0].id as string;
}

export async function getGridStoryboardProjectOwner(projectId: string): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM grid_storyboard_projects WHERE id = ${projectId}`;
  return rows[0] ? (rows[0].user_id as string) : null;
}

export async function listGridStoryboardSlots(projectId: string): Promise<GridStoryboardSlot[]> {
  const rows = await sql`SELECT * FROM grid_storyboard_slots WHERE project_id = ${projectId} ORDER BY order_index ASC`;
  return rows as GridStoryboardSlot[];
}

export async function addGridStoryboardSlot(projectId: string): Promise<GridStoryboardSlot> {
  const rows = await sql`
    INSERT INTO grid_storyboard_slots (project_id, order_index)
    SELECT ${projectId}, COALESCE(MAX(order_index), -1) + 1 FROM grid_storyboard_slots WHERE project_id = ${projectId}
    RETURNING *
  `;
  return rows[0] as GridStoryboardSlot;
}

export async function getGridStoryboardSlot(slotId: string): Promise<GridStoryboardSlot | null> {
  const rows = await sql`SELECT * FROM grid_storyboard_slots WHERE id = ${slotId}`;
  return (rows[0] as GridStoryboardSlot) ?? null;
}

export async function getGridStoryboardSlotProjectOwner(slotId: string): Promise<string | null> {
  const rows = await sql`
    SELECT p.user_id FROM grid_storyboard_slots s JOIN grid_storyboard_projects p ON p.id = s.project_id
    WHERE s.id = ${slotId}
  `;
  return rows[0] ? (rows[0].user_id as string) : null;
}

export async function setGridStoryboardSlotImage(slotId: string, imageUrl: string) {
  await sql`UPDATE grid_storyboard_slots SET image_url = ${imageUrl}, status = 'image_ready' WHERE id = ${slotId}`;
}

export async function setGridStoryboardSlotReferences(slotId: string, referenceIds: string[]) {
  await sql`UPDATE grid_storyboard_slots SET reference_ids = ${referenceIds} WHERE id = ${slotId}`;
}

export async function createStoryboardReference(params: {
  projectId: string;
  kind: StoryboardReferenceKind;
  name: string;
  imageUrl: string;
}): Promise<StoryboardReference> {
  const rows = await sql`
    INSERT INTO storyboard_references (project_id, kind, name, image_url)
    VALUES (${params.projectId}, ${params.kind}, ${params.name}, ${params.imageUrl})
    RETURNING *
  `;
  return rows[0] as StoryboardReference;
}

export async function listStoryboardReferences(projectId: string): Promise<StoryboardReference[]> {
  const rows = await sql`SELECT * FROM storyboard_references WHERE project_id = ${projectId} ORDER BY created_at ASC`;
  return rows as StoryboardReference[];
}

export async function getStoryboardReferencesByIds(ids: string[]): Promise<StoryboardReference[]> {
  if (ids.length === 0) return [];
  const rows = await sql`SELECT * FROM storyboard_references WHERE id = ANY(${ids})`;
  return rows as StoryboardReference[];
}

export async function getStoryboardReferenceProjectOwner(referenceId: string): Promise<string | null> {
  const rows = await sql`
    SELECT p.user_id FROM storyboard_references r JOIN grid_storyboard_projects p ON p.id = r.project_id
    WHERE r.id = ${referenceId}
  `;
  return rows[0] ? (rows[0].user_id as string) : null;
}

export async function deleteStoryboardReference(referenceId: string) {
  await sql`DELETE FROM storyboard_references WHERE id = ${referenceId}`;
}

// "Fix it at the reference level" (2026-09-14) - real, generalized
// technique: when a character/location/product reference is missing a
// detail (a specific outfit, a held item, a helmet), regenerating the
// REFERENCE itself and updating it in place means every scene that already
// points at this reference id automatically inherits the fix on its next
// generation - no need to hunt down and redo every scene individually.
export async function updateStoryboardReferenceImage(referenceId: string, imageUrl: string) {
  await sql`UPDATE storyboard_references SET image_url = ${imageUrl} WHERE id = ${referenceId}`;
}

export async function setGridStoryboardSlotVideoRequest(slotId: string, prompt: string, videoModel: string, requestId: string) {
  await sql`
    UPDATE grid_storyboard_slots
    SET prompt = ${prompt}, video_model = ${videoModel}, video_fal_request_id = ${requestId}, status = 'pending_video'
    WHERE id = ${slotId}
  `;
}

export async function setGridStoryboardSlotVideo(slotId: string, videoUrl: string) {
  await sql`UPDATE grid_storyboard_slots SET video_url = ${videoUrl}, status = 'video_ready' WHERE id = ${slotId}`;
}

// Atomic claim, same shape and reasoning as failVideoPaygoJob/
// failAdStudioScene above (real bug fixed here, security audit 2026-09-16:
// this was the one "fail" function in this file still a plain unconditional
// UPDATE with no RETURNING - two overlapping status-poll requests for the
// same failed slot could both pass and both call refundVideoCredit,
// crediting back 2 credits for the 1 originally spent). Callers must only
// refund when this returns true.
export async function failGridStoryboardSlot(slotId: string, error: string): Promise<boolean> {
  const rows = await sql`
    UPDATE grid_storyboard_slots SET status = 'failed', error = ${error}
    WHERE id = ${slotId} AND status NOT IN ('failed', 'video_ready')
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteGridStoryboardSlot(slotId: string) {
  await sql`DELETE FROM grid_storyboard_slots WHERE id = ${slotId}`;
}

// --- Character video generation (pre-made AI actors) ---

export type CharacterVideoJob = {
  id: string;
  access_token: string;
  character_id: string;
  voice_choice: string;
  script: string;
  credits_cost: number;
  fal_endpoint: string;
  modal_job_id: string | null;
  fal_request_id: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  video_url: string | null;
  error: string | null;
  created_at: string;
};

export async function createCharacterVideoJob(params: {
  accessToken: string;
  characterId: string;
  voiceChoice: string;
  script: string;
  creditsCost: number;
  falEndpoint: string;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO character_video_jobs (access_token, character_id, voice_choice, script, credits_cost, fal_endpoint)
    VALUES (${params.accessToken}, ${params.characterId}, ${params.voiceChoice}, ${params.script}, ${params.creditsCost}, ${params.falEndpoint})
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function setCharacterVideoJobModalId(jobId: string, modalJobId: string) {
  await sql`UPDATE character_video_jobs SET modal_job_id = ${modalJobId} WHERE id = ${jobId}`;
}

export async function setCharacterVideoJobRequestId(jobId: string, falRequestId: string) {
  await sql`UPDATE character_video_jobs SET fal_request_id = ${falRequestId}, status = 'in_progress' WHERE id = ${jobId}`;
}

// Same double-submit race and atomic-claim fix as
// claimVideoPaygoJobForFalSubmit above (security audit, 2026-09-16) -
// generate-character-video/status/route.ts has the identical phase-1
// check-then-submit shape.
export async function claimCharacterVideoJobForFalSubmit(jobId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE character_video_jobs SET fal_request_id = 'CLAIMING', fal_claimed_at = now()
    WHERE id = ${jobId} AND (fal_request_id IS NULL OR (fal_request_id = 'CLAIMING' AND fal_claimed_at < now() - interval '10 minutes'))
    RETURNING id
  `;
  return rows.length > 0;
}

export async function completeCharacterVideoJob(jobId: string, videoUrl: string) {
  await sql`UPDATE character_video_jobs SET status = 'completed', video_url = ${videoUrl} WHERE id = ${jobId}`;
}

// Atomic claim, same reasoning as failVideoPaygoJob above - only the caller
// that actually transitions the row gets `true`, so a concurrent duplicate
// poll can't also release credits for this job a second time.
export async function failCharacterVideoJob(jobId: string, error: string): Promise<boolean> {
  const rows = await sql`
    UPDATE character_video_jobs SET status = 'failed', error = ${error}
    WHERE id = ${jobId} AND status NOT IN ('failed', 'completed')
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getCharacterVideoJob(jobId: string): Promise<CharacterVideoJob | null> {
  const rows = await sql`SELECT * FROM character_video_jobs WHERE id = ${jobId}`;
  return (rows[0] as CharacterVideoJob) ?? null;
}

// --- Subscription video jobs (custom hyper-realistic + cinematic modes) ---

export type SubscriptionVideoMode = "custom" | "cinematic";
export type SubscriptionVideoAudioSource = "lucy_preset" | "lucy_cloned" | "own_upload" | "engine_native";

export type SubscriptionVideoJob = {
  id: string;
  access_token: string;
  mode: SubscriptionVideoMode;
  reference_image_url: string;
  prompt: string;
  audio_source: SubscriptionVideoAudioSource;
  preset_voice_id: string | null;
  credits_cost: number;
  fal_endpoint: string;
  modal_job_id: string | null;
  resolved_audio_url: string | null;
  fal_request_id: string | null;
  needs_merge: boolean;
  merge_request_id: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  video_url: string | null;
  silent_video_url: string | null;
  error: string | null;
  created_at: string;
};

export async function createSubscriptionVideoJob(params: {
  accessToken: string;
  mode: SubscriptionVideoMode;
  referenceImageUrl: string;
  prompt: string;
  audioSource: SubscriptionVideoAudioSource;
  presetVoiceId: string | null;
  creditsCost: number;
  falEndpoint: string;
  needsMerge: boolean;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO subscription_video_jobs
      (access_token, mode, reference_image_url, prompt, audio_source, preset_voice_id, credits_cost, fal_endpoint, needs_merge)
    VALUES
      (${params.accessToken}, ${params.mode}, ${params.referenceImageUrl}, ${params.prompt}, ${params.audioSource},
       ${params.presetVoiceId}, ${params.creditsCost}, ${params.falEndpoint}, ${params.needsMerge})
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function setSubscriptionVideoJobModalId(jobId: string, modalJobId: string) {
  await sql`UPDATE subscription_video_jobs SET modal_job_id = ${modalJobId} WHERE id = ${jobId}`;
}

export async function setSubscriptionVideoJobResolvedAudio(jobId: string, resolvedAudioUrl: string) {
  await sql`UPDATE subscription_video_jobs SET resolved_audio_url = ${resolvedAudioUrl} WHERE id = ${jobId}`;
}

export async function setSubscriptionVideoJobRequestId(jobId: string, falRequestId: string) {
  await sql`UPDATE subscription_video_jobs SET fal_request_id = ${falRequestId}, status = 'in_progress' WHERE id = ${jobId}`;
}

export async function setSubscriptionVideoJobMergeRequestId(jobId: string, mergeRequestId: string) {
  await sql`UPDATE subscription_video_jobs SET merge_request_id = ${mergeRequestId} WHERE id = ${jobId}`;
}

// Same double-submit race and atomic-claim fix as
// claimVideoPaygoJobForFalSubmit/claimVideoPaygoJobForMergeSubmit above
// (security audit, 2026-09-16) - generate-cinematic-video/status/route.ts
// has both the identical phase-0 (Veo submit) and merge-submit shapes.
export async function claimSubscriptionVideoJobForFalSubmit(jobId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE subscription_video_jobs SET fal_request_id = 'CLAIMING', fal_claimed_at = now()
    WHERE id = ${jobId} AND (fal_request_id IS NULL OR (fal_request_id = 'CLAIMING' AND fal_claimed_at < now() - interval '10 minutes'))
    RETURNING id
  `;
  return rows.length > 0;
}

export async function claimSubscriptionVideoJobForMergeSubmit(jobId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE subscription_video_jobs SET merge_request_id = 'CLAIMING', merge_claimed_at = now()
    WHERE id = ${jobId} AND (merge_request_id IS NULL OR (merge_request_id = 'CLAIMING' AND merge_claimed_at < now() - interval '10 minutes'))
    RETURNING id
  `;
  return rows.length > 0;
}

// Saves cinematic mode's raw silent Veo clip right before it's muxed with
// the resolved audio - see the silent_video_url column comment above.
export async function setSubscriptionVideoJobSilentVideo(jobId: string, silentVideoUrl: string) {
  await sql`UPDATE subscription_video_jobs SET silent_video_url = ${silentVideoUrl} WHERE id = ${jobId}`;
}

export async function completeSubscriptionVideoJob(jobId: string, videoUrl: string) {
  await sql`UPDATE subscription_video_jobs SET status = 'completed', video_url = ${videoUrl} WHERE id = ${jobId}`;
}

// Atomic claim, same reasoning as failVideoPaygoJob/failCharacterVideoJob.
export async function failSubscriptionVideoJob(jobId: string, error: string): Promise<boolean> {
  const rows = await sql`
    UPDATE subscription_video_jobs SET status = 'failed', error = ${error}
    WHERE id = ${jobId} AND status NOT IN ('failed', 'completed')
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getSubscriptionVideoJob(jobId: string): Promise<SubscriptionVideoJob | null> {
  const rows = await sql`SELECT * FROM subscription_video_jobs WHERE id = ${jobId}`;
  return (rows[0] as SubscriptionVideoJob) ?? null;
}

// --- Pay-as-you-go: merge phase (own/cloned audio muxed onto the video) ---

export async function setVideoPaygoJobMergeRequestId(jobId: string, mergeRequestId: string) {
  await sql`UPDATE video_paygo_jobs SET merge_request_id = ${mergeRequestId} WHERE id = ${jobId}`;
}

// Same atomic-claim shape and reasoning as claimVideoPaygoJobForFalSubmit
// above, for the second fal job (lipsync/merge) this job submits once its
// silent render completes - the same double-submit race applies here too.
export async function claimVideoPaygoJobForMergeSubmit(jobId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE video_paygo_jobs SET merge_request_id = 'CLAIMING', merge_claimed_at = now()
    WHERE id = ${jobId} AND (merge_request_id IS NULL OR (merge_request_id = 'CLAIMING' AND merge_claimed_at < now() - interval '10 minutes'))
    RETURNING id
  `;
  return rows.length > 0;
}
