// Tests for the 2026-10-17 audit fixes. The SQL runs on a real in-memory
// Postgres (PGlite, see testing/pgliteDb.ts); every vendor, Stripe and the
// network are mocked. Run: npm test
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import type Stripe from "stripe";

process.env.MEDIA_URL_SECRET = "test-media-secret";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.CRON_SECRET = "cron-secret";
process.env.OWNER_EMAILS = "owner@example.com";

import { useTestDb } from "./testing/pgliteDb";
import {
  approveDirectorFilm,
  cancelDirectorFilm,
  claimDirectorShot,
  createDirectorFilm,
  createGuestUser,
  createVideoPaygoJob,
  finishDirectorShots,
  freeSlotsUsed,
  getDirectorFilm,
  getVideoCreditBalance,
  getVideoPaygoJob,
  pruneFreeUsageLog,
  refundVideoCredit,
  resetDirectorShotForRetake,
  setVideoPaygoJobRequestId,
  spendVideoCredit,
  addVideoCredits,
  switchDirectorShotTake,
  takeFreeSlots,
  updateDirectorFilm,
  upsertUserByEmail,
  type User,
} from "./db";
import { freeCapSlots, clientIpKey, ACCOUNT_IP_MULTIPLIER } from "./freeCaps";
import { MEDIA_SECURITY_HEADERS, looksLikeRawVendorError, safeMediaContentType, scrubForClient, toPublicMediaUrl } from "./mediaProxy";
import { advanceVideoPaygoJob, sweepIdleVideoPaygoJobs, RESULT_RETRY_SECONDS, JOB_MAX_AGE_SECONDS, type PaygoDeps } from "./videoPaygoAdvance";
import { lucyVoiceMaxChars, maxAudioSecondsFor, VIDEO_PAYGO_ENGINES } from "./videoEngines";
import { disableVendorPromptRewrite, buildFalInput } from "./videoPaygo";
import { checkoutPaymentCleared, handleStripeEvent } from "./stripeWebhook";
import { TOKEN_RE, confirmPageHtml, sameOriginPost } from "./magicLink";
import { clipPrefix, isOwnClipPathname, isOwnClipUrl } from "./clipOwnership";
import { cronAuthError } from "./adminAuth";

let pg: PGlite;
const realFetch = globalThis.fetch;

before(async () => {
  pg = await useTestDb();
  // Nothing in these tests may reach the network.
  globalThis.fetch = (async () => {
    throw new Error("network disabled in tests");
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = realFetch;
  await pg.close();
});

async function newUser(email?: string): Promise<User> {
  return email ? upsertUserByEmail(email) : createGuestUser();
}

async function newFilm(user: User, opts: { paidCents: number | null; status?: string; shots?: number }): Promise<string> {
  const id = await createDirectorFilm({
    userId: user.id,
    idea: "test",
    plan: { shots: [] },
    engine: "veo",
    refs: {} as never,
    totalCents: 1000,
    paidCents: opts.paidCents,
    shots: Array.from({ length: opts.shots ?? 2 }, () => ({ prompt: "p", keyframePrompt: "k", priceCents: 500 })),
  });
  if (opts.status) await pg.query("UPDATE director_films SET status = $1 WHERE id = $2", [opts.status, id]);
  return id;
}

async function setShots(filmId: string, status: string) {
  await pg.query("UPDATE director_shots SET status = $1, video_url = 'https://v.fal.media/x.mp4' WHERE film_id = $2", [status, filmId]);
}

async function shotIds(filmId: string): Promise<string[]> {
  return (await pg.query<{ id: string }>("SELECT id FROM director_shots WHERE film_id = $1 ORDER BY idx", [filmId])).rows.map((r) => r.id);
}

// ---------------------------------------------------------------- 1. cancelled film
describe("1. a cancelled film is never filmed", () => {
  test("a pipeline write-back after cancel can't revive the film", async () => {
    const u = await newUser();
    const id = await newFilm(u, { paidCents: null, status: "frames" });
    assert.ok(await cancelDirectorFilm(id));
    // The poll that was drawing frames finishes and tries frames -> shots (auto-approve).
    assert.equal(await updateDirectorFilm(id, { status: "shots" }, "frames"), false);
    // Even an unguarded write can't touch a cancelled film.
    assert.equal(await updateDirectorFilm(id, { status: "shots" }), false);
    assert.equal((await getDirectorFilm(id))?.status, "cancelled");
  });

  test("a write-back only applies in the status the caller read", async () => {
    const u = await newUser();
    const id = await newFilm(u, { paidCents: null, status: "completed" });
    assert.equal(await updateDirectorFilm(id, { status: "completed", final_video_url: "https://x/old.mp4" }, "stitching"), false);
    assert.equal(await updateDirectorFilm(id, { error: "x" }, "completed"), true);
  });
});

// ---------------------------------------------------------------- 2. approve vs cancel
describe("2. approve racing cancel refunds at most once", () => {
  async function race(order: "approve-first" | "cancel-first" | "together") {
    const u = await newUser();
    await addVideoCredits(u.id, 2000);
    // Free storyboard: $1 already paid, $9 due on approve.
    const id = await newFilm(u, { paidCents: 100, status: "review" });
    const due = 900;
    let refunded = 0;
    const approve = async () => {
      assert.ok(await spendVideoCredit(u.id, due));
      if (!(await approveDirectorFilm(id))) {
        await refundVideoCredit(u.id, due);
        refunded += due;
      }
    };
    const cancel = async () => {
      const row = await cancelDirectorFilm(id);
      if (row) {
        const refund = row.paid_cents !== null ? 0 : row.total_cents - 250;
        if (refund > 0) await refundVideoCredit(u.id, refund);
        refunded += refund;
      }
    };
    if (order === "approve-first") {
      await approve();
      await cancel();
    } else if (order === "cancel-first") {
      await cancel();
      await approve();
    } else await Promise.all([approve(), cancel()]);
    return { status: (await getDirectorFilm(id))?.status, balance: await getVideoCreditBalance(u.id), refunded };
  }

  test("approve wins: filmed, charged once, nothing refunded", async () => {
    const r = await race("approve-first");
    assert.equal(r.status, "shots");
    assert.equal(r.balance, 2000 - 900);
    assert.equal(r.refunded, 0);
  });

  test("cancel wins: cancelled, the approve charge comes back, no film refund on top", async () => {
    const r = await race("cancel-first");
    assert.equal(r.status, "cancelled");
    assert.equal(r.balance, 2000);
    assert.equal(r.refunded, 900);
  });

  test("interleaved: whoever wins, the customer pays exactly for what happened", async () => {
    const r = await race("together");
    assert.ok(r.status === "shots" || r.status === "cancelled");
    assert.equal(r.balance, r.status === "shots" ? 1100 : 2000);
  });

  test("a fully-paid film cancelled before filming refunds once, and approve can't run after", async () => {
    const u = await newUser();
    const id = await newFilm(u, { paidCents: null, status: "review" });
    const first = await cancelDirectorFilm(id);
    const second = await cancelDirectorFilm(id);
    assert.ok(first && first.paid_cents === null);
    assert.equal(second, null);
    assert.equal(await approveDirectorFilm(id), false);
  });
});

// ---------------------------------------------------------------- 3. free caps
describe("3. free daily caps can't be reset with new guests", () => {
  test("guests are counted per IP, not per guest id", () => {
    const g1 = { id: "g1", is_guest: true };
    const g2 = { id: "g2", is_guest: true };
    assert.deepEqual(freeCapSlots("board", 3, g1, "1.2.3.4"), freeCapSlots("board", 3, g2, "1.2.3.4"));
    assert.deepEqual(freeCapSlots("board", 3, null, "1.2.3.4"), freeCapSlots("board", 3, g2, "1.2.3.4"));
  });

  test("real accounts are counted per account and per IP (with headroom)", () => {
    const slots = freeCapSlots("plan", 20, { id: "u1", is_guest: false }, "1.2.3.4");
    assert.deepEqual(slots, [
      { key: "plan:u:u1", cap: 20 },
      { key: "plan:ip:1.2.3.4", cap: 20 * ACCOUNT_IP_MULTIPLIER },
    ]);
  });

  test("a burst of parallel requests from fresh guests gets exactly the cap", async () => {
    const ip = "9.9.9.9";
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => takeFreeSlots(freeCapSlots("board", 3, { id: `guest-${i}`, is_guest: true }, ip))));
    assert.equal(results.filter(Boolean).length, 3);
    assert.equal(await freeSlotsUsed("board:ip:9.9.9.9"), 3);
  });

  test("all-or-nothing across keys, and multi-unit takes respect the cap", async () => {
    const ip = "8.8.8.8";
    // The IP pool is nearly used up by another account.
    for (let i = 0; i < 5; i++) assert.ok(await takeFreeSlots(freeCapSlots("x", 2, { id: `a${i}`, is_guest: false }, ip).slice(1)));
    // Account "b" is under its own cap, but the IP's 6 are nearly gone (5 used): 2 units refused, 1 allowed.
    assert.equal(await takeFreeSlots(freeCapSlots("x", 2, { id: "b", is_guest: false }, ip), 2), false);
    assert.equal(await freeSlotsUsed("x:u:b"), 0, "a refused take records nothing");
    assert.equal(await takeFreeSlots(freeCapSlots("x", 2, { id: "b", is_guest: false }, ip), 1), true);
    assert.equal(await takeFreeSlots([{ key: "y", cap: 3 }], 4), false);
  });

  test("IPs: Vercel's x-real-ip first, IPv6 grouped by /64", () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    assert.equal(clientIpKey(h({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" })), "1.2.3.4");
    assert.equal(clientIpKey(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" })), "5.6.7.8");
    assert.equal(clientIpKey(h({ "x-real-ip": "2001:db8:aa:bb:1:2:3:4" })), clientIpKey(h({ "x-real-ip": "2001:db8:aa:bb:ffff::9" })));
    assert.equal(clientIpKey(h({})), "unknown");
  });

  test("the log is pruned after two days", async () => {
    await pg.query("INSERT INTO director_plan_log (visitor, created_at) VALUES ('old', now() - interval '3 days')");
    assert.ok((await pruneFreeUsageLog()) >= 1);
    assert.equal((await pg.query("SELECT 1 FROM director_plan_log WHERE visitor = 'old'")).rows.length, 0);
  });
});

// ---------------------------------------------------------------- 5. media proxy
describe("5. media links never serve HTML", () => {
  test("only media types are served; generic binary falls back to the extension", () => {
    assert.equal(safeMediaContentType("video/mp4", "mp4"), "video/mp4");
    assert.equal(safeMediaContentType("image/png; charset=binary", "png"), "image/png");
    assert.equal(safeMediaContentType("application/octet-stream", "mp4"), "video/mp4");
    assert.equal(safeMediaContentType("text/html", "mp4"), null);
    assert.equal(safeMediaContentType("image/svg+xml", "png"), null);
    assert.equal(safeMediaContentType("application/octet-stream", "html"), null);
    assert.equal(safeMediaContentType(null, null), null);
  });

  test("the route refuses an uploaded HTML file and sends nosniff on media", async () => {
    const { GET } = await import("../app/api/media/[token]/route");
    const call = async (upstreamType: string, file: string) => {
      const url = `https://storage.googleapis.com/attacker-bucket/${file}`;
      const token = toPublicMediaUrl(url).replace("/api/media/", "");
      globalThis.fetch = (async () => new Response("<script>alert(1)</script>", { status: 200, headers: { "content-type": upstreamType } })) as typeof fetch;
      try {
        const req = { headers: new Headers() } as never;
        return await GET(req, { params: Promise.resolve({ token }) });
      } finally {
        globalThis.fetch = (async () => {
          throw new Error("network disabled in tests");
        }) as typeof fetch;
      }
    };
    const html = await call("text/html", "x.mp4");
    assert.equal(html.status, 415);
    const ok = await call("application/octet-stream", "clip.mp4");
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "video/mp4");
    assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
    assert.match(ok.headers.get("content-security-policy") ?? "", /sandbox/);
    assert.equal(MEDIA_SECURITY_HEADERS["x-content-type-options"], "nosniff");
  });
});

// ---------------------------------------------------------------- 6. Director claims
describe("6. overlapping Director polls can't submit the same job twice", () => {
  test("the claim hands back the row as it is now (a stale poll sees the request id)", async () => {
    const u = await newUser();
    const id = await newFilm(u, { paidCents: null, status: "shots" });
    const [shot] = await shotIds(id);
    // Poll A claims, submits, writes the request id and releases.
    assert.ok(await claimDirectorShot(shot));
    await pg.query("UPDATE director_shots SET video_request_id = 'req-1', status = 'video', claimed_at = NULL WHERE id = $1", [shot]);
    // Poll B read the shot before that (no request id) and now wins a claim: it must see req-1.
    const fresh = await claimDirectorShot(shot);
    assert.equal(fresh?.video_request_id, "req-1");
    // And a second claim while B holds it is refused.
    assert.equal(await claimDirectorShot(shot), null);
  });
});

// ---------------------------------------------------------------- 7 + 8. homepage jobs
function job(deps: Partial<PaygoDeps>): PaygoDeps {
  const fail = async () => {
    throw new Error("unexpected vendor call");
  };
  return {
    getModalJobStatus: fail,
    getVideoInferenceStatus: fail,
    getVideoInferenceResult: fail,
    submitVideoInferenceJob: fail,
    getFalJobStatus: fail,
    getFalJobResult: fail,
    submitLipsyncJob: fail,
    submitMergeAudioVideo: fail,
    uploadBufferToFal: fail,
    now: () => Date.now(),
    ...deps,
  } as PaygoDeps;
}

async function paidJob(user: User, priceCents = 299): Promise<string> {
  await addVideoCredits(user.id, priceCents);
  assert.ok(await spendVideoCredit(user.id, priceCents));
  const id = await createVideoPaygoJob({ userId: user.id, engine: "veo", prompt: "p", falEndpoint: "vertex:veo-3.1-fast-generate-001", priceCents });
  await setVideoPaygoJobRequestId(id, "op-1");
  return id;
}

describe("7. homepage videos finish without the tab", () => {
  beforeEach(async () => {
    await pg.query("UPDATE video_paygo_jobs SET status = 'completed' WHERE status IN ('pending','in_progress')");
  });

  test("the sweep completes an idle job nobody is polling", async () => {
    const u = await newUser();
    const id = await paidJob(u);
    await pg.query("UPDATE video_paygo_jobs SET created_at = now() - interval '5 minutes' WHERE id = $1", [id]);
    const n = await sweepIdleVideoPaygoJobs(5, job({ getVideoInferenceStatus: async () => "COMPLETED", getVideoInferenceResult: async () => ({ video: { url: "https://x.public.blob.vercel-storage.com/v.mp4" } }) }));
    assert.equal(n, 1);
    assert.equal((await getVideoPaygoJob(id))?.status, "completed");
  });

  test("the sweep refunds a vendor failure exactly once, even swept twice", async () => {
    const u = await newUser();
    const id = await paidJob(u);
    await pg.query("UPDATE video_paygo_jobs SET created_at = now() - interval '5 minutes' WHERE id = $1", [id]);
    const deps = job({ getVideoInferenceStatus: async () => "FAILED" });
    await sweepIdleVideoPaygoJobs(5, deps);
    const j = (await getVideoPaygoJob(id))!;
    await advanceVideoPaygoJob({ ...j, status: "in_progress" }, deps); // a stale copy racing it
    assert.equal((await getVideoPaygoJob(id))?.status, "failed");
    assert.equal(await getVideoCreditBalance(u.id), 299);
  });

  test("a job the tab is polling isn't swept", async () => {
    const u = await newUser();
    const id = await paidJob(u);
    await pg.query("UPDATE video_paygo_jobs SET created_at = now() - interval '5 minutes', polled_at = now() WHERE id = $1", [id]);
    assert.equal(await sweepIdleVideoPaygoJobs(5, job({})), 0);
  });

  test("a job stuck past the max age is failed and refunded", async () => {
    const u = await newUser();
    const id = await paidJob(u);
    const j = (await getVideoPaygoJob(id))!;
    const r = await advanceVideoPaygoJob(j, job({ getVideoInferenceStatus: async () => "IN_PROGRESS", now: () => Date.now() + (JOB_MAX_AGE_SECONDS + 60) * 1000 }));
    assert.equal(r.status, "FAILED");
    assert.equal(await getVideoCreditBalance(u.id), 299);
  });
});

describe("8. a transient error collecting a finished Veo video is retried, not refunded", () => {
  test("retry while recent, refund only after a long outage", async () => {
    const u = await newUser();
    const id = await paidJob(u);
    const deps = job({
      getVideoInferenceStatus: async () => "COMPLETED",
      getVideoInferenceResult: async () => {
        throw new Error("503 from storage");
      },
    });
    const first = await advanceVideoPaygoJob((await getVideoPaygoJob(id))!, deps);
    assert.equal(first.status, "IN_PROGRESS");
    assert.equal(await getVideoCreditBalance(u.id), 0, "no refund for a render we paid for");
    // Recovers on the next poll.
    const ok = await advanceVideoPaygoJob((await getVideoPaygoJob(id))!, job({ getVideoInferenceStatus: async () => "COMPLETED", getVideoInferenceResult: async () => ({ video: { url: "https://x.public.blob.vercel-storage.com/v.mp4" } }) }));
    assert.equal(ok.status, "COMPLETED");

    const id2 = await paidJob(u);
    await advanceVideoPaygoJob((await getVideoPaygoJob(id2))!, deps);
    await pg.query(`UPDATE video_paygo_jobs SET result_error_since = now() - interval '${RESULT_RETRY_SECONDS + 60} seconds' WHERE id = $1`, [id2]);
    const gaveUp = await advanceVideoPaygoJob((await getVideoPaygoJob(id2))!, deps);
    assert.equal(gaveUp.status, "FAILED");
    assert.equal(await getVideoCreditBalance(u.id), 299);
  });
});

// ---------------------------------------------------------------- 9. Lucy-voice length
describe("9. Lucy-voice scripts fit the clip", () => {
  test("limit follows each model's clip length", () => {
    assert.equal(lucyVoiceMaxChars("veo"), VIDEO_PAYGO_ENGINES.veo.durationSeconds * 15);
    assert.equal(lucyVoiceMaxChars("kling"), 75);
    for (const e of Object.keys(VIDEO_PAYGO_ENGINES) as Array<keyof typeof VIDEO_PAYGO_ENGINES>) {
      assert.ok(lucyVoiceMaxChars(e) < 600, `${e} must be well under the old 600`);
      assert.ok(maxAudioSecondsFor(e) > VIDEO_PAYGO_ENGINES[e].durationSeconds);
    }
  });
});

// ---------------------------------------------------------------- 10. Stripe
function checkoutEvent(id: string, type: string, session: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return { id, type, data: { object: { id: "cs_test_1", mode: "payment", metadata: { product: "video_credits", creditsCents: "1000" }, amount_total: 1000, customer_details: null, ...session } } } as unknown as Stripe.Event;
}

describe("10. Stripe only grants credit for cleared payments", () => {
  test("payment_status gate", () => {
    assert.equal(checkoutPaymentCleared({ payment_status: "paid" }), true);
    assert.equal(checkoutPaymentCleared({ payment_status: "unpaid" }), false);
    assert.equal(checkoutPaymentCleared({ payment_status: "no_payment_required" }), false);
  });

  test("unpaid completion grants nothing; async success grants once; replays grant nothing", async () => {
    const u = await newUser();
    const session = { id: `cs_${u.id}`, client_reference_id: u.id };
    await handleStripeEvent(checkoutEvent("evt_1", "checkout.session.completed", { ...session, payment_status: "unpaid" }), { creditsCommitted: false });
    assert.equal(await getVideoCreditBalance(u.id), 0);
    await handleStripeEvent(checkoutEvent("evt_2", "checkout.session.async_payment_succeeded", { ...session, payment_status: "paid" }), { creditsCommitted: false });
    assert.equal(await getVideoCreditBalance(u.id), 1000);
    // A paid completion for the same session (different event id) can't grant again.
    await handleStripeEvent(checkoutEvent("evt_3", "checkout.session.completed", { ...session, payment_status: "paid" }), { creditsCommitted: false });
    assert.equal(await getVideoCreditBalance(u.id), 1000);
  });

  test("a failed delayed payment grants nothing", async () => {
    const u = await newUser();
    await handleStripeEvent(checkoutEvent("evt_4", "checkout.session.async_payment_failed", { id: `cs_f_${u.id}`, client_reference_id: u.id, payment_status: "unpaid" }), { creditsCommitted: false });
    assert.equal(await getVideoCreditBalance(u.id), 0);
  });
});

// ---------------------------------------------------------------- 11. magic links
describe("11. sign-in links survive email scanners", () => {
  test("GET shows a confirm page and does NOT use the token", async () => {
    const { createLoginToken } = await import("./db");
    const token = await createLoginToken(`scan-${Date.now()}@example.com`);
    assert.match(token, TOKEN_RE);
    const { GET } = await import("../app/api/auth/verify/route");
    const req = { nextUrl: new URL(`https://lucylabs.app/api/auth/verify?token=${token}`) } as never;
    const res = await GET(req);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /method="post"/);
    assert.ok(html.includes(token));
    const left = await pg.query("SELECT 1 FROM login_tokens WHERE token = $1", [token]);
    assert.equal(left.rows.length, 1, "token still unused after the GET");
  });

  test("POST only from our own page; page escapes nothing it shouldn't", () => {
    const h = (o: Record<string, string>) => ({ headers: { get: (k: string) => o[k] ?? null } });
    assert.equal(sameOriginPost(h({ origin: "https://lucylabs.app" }), "https://lucylabs.app"), true);
    assert.equal(sameOriginPost(h({ origin: "https://evil.example" }), "https://lucylabs.app"), false);
    assert.equal(sameOriginPost(h({ "sec-fetch-site": "cross-site" }), "https://lucylabs.app"), false);
    assert.equal(sameOriginPost(h({}), "https://lucylabs.app"), false);
    assert.equal(TOKEN_RE.test('"><script>'), false);
    assert.match(confirmPageHtml("a".repeat(64)), /action="\/api\/auth\/verify"/);
  });
});

// ---------------------------------------------------------------- 12. clip ownership
describe("12. Copy-a-clip only deletes the caller's own upload", () => {
  test("folder per account; foreign or arbitrary blobs refused", () => {
    const mine = `https://abc123.public.blob.vercel-storage.com/${clipPrefix("user-a")}scene-XyZ12.mp4`;
    assert.equal(isOwnClipUrl(mine, "user-a"), true);
    assert.equal(isOwnClipUrl(mine, "user-b"), false);
    assert.equal(isOwnClipUrl("https://abc123.public.blob.vercel-storage.com/videos/veo/123.mp4", "user-a"), false);
    assert.equal(isOwnClipUrl(`https://evil.example/${clipPrefix("user-a")}x.mp4`, "user-a"), false);
    assert.equal(isOwnClipPathname(`${clipPrefix("user-a")}../x.mp4`, "user-a"), false);
    assert.equal(isOwnClipPathname(`${clipPrefix("user-a")}a/b.mp4`, "user-a"), false);
    assert.notEqual(clipPrefix("user-a"), clipPrefix("user-b"));
  });
});

// ---------------------------------------------------------------- 13. smaller items
describe("13. smaller items", () => {
  test("retakes: only a finished shot, never while voicing/stitching, never twice at once", async () => {
    const u = await newUser();
    const id = await newFilm(u, { paidCents: null, status: "voicing" });
    await setShots(id, "completed");
    const [a, b] = await shotIds(id);
    assert.equal(await resetDirectorShotForRetake(id, a), false, "not while voicing");
    await pg.query("UPDATE director_films SET status = 'completed' WHERE id = $1", [id]);
    const both = await Promise.all([resetDirectorShotForRetake(id, a), resetDirectorShotForRetake(id, a)]);
    assert.equal(both.filter(Boolean).length, 1, "the same shot can't be charged twice");
    assert.equal((await getDirectorFilm(id))?.status, "shots");
    // The re-queued shot holds the film in 'shots'.
    assert.equal(await finishDirectorShots(id, "stitching"), false);
    // Picking another take of a shot still rendering is refused.
    assert.equal(await switchDirectorShotTake(id, a, "https://x/take2.mp4"), false);
    assert.equal(await switchDirectorShotTake(id, b, "https://x/take2.mp4"), true);
    await pg.query("UPDATE director_shots SET status = 'completed' WHERE film_id = $1", [id]);
    assert.equal(await finishDirectorShots(id, "stitching"), true);
  });

  test("owner refunds don't pile up", async () => {
    const owner = await newUser("owner@example.com");
    await refundVideoCredit(owner.id, 500);
    assert.equal(await getVideoCreditBalance(owner.id), 0);
    const u = await newUser();
    await refundVideoCredit(u.id, 500);
    assert.equal(await getVideoCreditBalance(u.id), 500);
  });

  test("raw vendor errors are replaced, our own messages kept", () => {
    const out = scrubForClient({
      a: { error: 'submit failed (403): {"detail":"User is locked"}' },
      b: { error: "Video engine request_id abc failed" },
      c: { error: "Not enough credit - this model costs $2.99 per video" },
      d: { error: "That's today's limit for free previews - try again tomorrow." },
    });
    assert.equal(out.a.error, "Generation failed - please try again.");
    assert.equal(out.b.error, "Generation failed - please try again.");
    assert.equal(out.c.error, "Not enough credit - this model costs $2.99 per video");
    assert.equal(out.d.error, "That's today's limit for free previews - try again tomorrow.");
    assert.equal(looksLikeRawVendorError("x".repeat(500)), true);
  });

  test("cron secret check", () => {
    const req = (v?: string) => ({ headers: new Headers(v ? { authorization: v } : {}) });
    assert.equal(cronAuthError(req("Bearer cron-secret")), null);
    assert.equal(cronAuthError(req("Bearer wrong")), 401);
    assert.equal(cronAuthError(req()), 401);
  });
});

// ---------------------------------------------------------------- MiniMax
describe("MiniMax: no second prompt rewrite after Lucy's", () => {
  test("prompt_expansion_mode is disabled only on MiniMax", () => {
    const mm = buildFalInput("minimax", "p", null, false);
    assert.equal(mm.prompt_expansion_mode, "balanced");
    assert.equal(disableVendorPromptRewrite(mm, "minimax/h3-max/text-to-video").prompt_expansion_mode, "disabled");
    const veo = disableVendorPromptRewrite({ prompt: "p" }, "fal-ai/veo3.1/fast");
    assert.equal(veo.prompt_expansion_mode, undefined);
  });
});
