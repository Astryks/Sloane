// Magic-link confirm page helpers (2026-10-17 audit) - see app/api/auth/verify/route.ts.

export const TOKEN_RE = /^[a-f0-9]{64}$/;

export const NO_STORE = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
};

export function confirmPageHtml(token: string): string {
  // token is validated hex (TOKEN_RE) before it reaches here - safe in an attribute.
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Sign in - Lucy Labs</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf7ff;color:#1d1630;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
main{max-width:360px;width:100%;background:#fff;border-radius:20px;padding:28px;box-shadow:0 8px 30px rgba(60,30,120,.08);text-align:center}
h1{font-size:20px;margin:0 0 8px}p{font-size:14px;color:#5c5470;margin:0 0 20px}
button{width:100%;border:0;border-radius:999px;background:#6d3df5;color:#fff;font-size:16px;font-weight:700;padding:14px;cursor:pointer}
</style></head>
<body><main><h1>Sign in to Lucy Labs</h1><p>Tap the button to finish signing in on this device.</p>
<form method="post" action="/api/auth/verify"><input type="hidden" name="token" value="${token}"><button type="submit">Sign in</button></form>
</main></body></html>`;
}

/** Only our own confirm page may post here (stops another site signing a visitor into the wrong account). */
export function sameOriginPost(req: { headers: Pick<Headers, "get"> }, origin: string): boolean {
  const from = req.headers.get("origin");
  if (from) return from === origin;
  const site = req.headers.get("sec-fetch-site");
  return site === "same-origin";
}

