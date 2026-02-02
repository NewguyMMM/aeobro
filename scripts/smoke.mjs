// scripts/smoke.mjs
// Deterministic API smoke tests (no UI, no OAuth automation).
// Exit codes:
//  - 0: pass
//  - 1: fail

function resolveBaseUrl() {
  const explicit = (process.env.SMOKE_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = (process.env.VERCEL_URL || "").trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  const siteUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || "").trim() ||
    (process.env.SITE_URL || "").trim();

  if (siteUrl) return siteUrl.replace(/\/+$/, "");

  return "http://localhost:3000";
}

async function http(url, init = {}) {
  const timeoutMs = init.timeoutMs ?? 10_000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "manual",
      headers: {
        accept: "application/json, text/plain, */*",
        ...(init.headers || {}),
      },
    });

    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  } finally {
    clearTimeout(t);
  }
}

function ok(name) {
  return { name, ok: true };
}

function fail(name, details) {
  return { name, ok: false, details };
}

function expectOneOf(name, status, allowed) {
  return allowed.includes(status)
    ? ok(name)
    : fail(name, `Expected ${allowed.join(" or ")}, got ${status}`);
}

function expectContains(name, haystack, needle) {
  return haystack.includes(needle)
    ? ok(name)
    : fail(name, `Response did not include: ${needle}`);
}

async function run() {
  const base = resolveBaseUrl();
  const results = [];

  // 1) Health endpoint should be 200 and include "ok":true
  {
    const r = await http(`${base}/api/health`, { method: "GET" });
    const s = expectOneOf("health:status", r.status, [200]);
    results.push(s);
    if (s.ok) results.push(expectContains("health:body", r.text, `"ok":true`));
  }

  // 2) NextAuth session endpoint should exist (200 even unauthenticated)
  {
    const r = await http(`${base}/api/auth/session`, { method: "GET" });
    results.push(expectOneOf("auth:session:status", r.status, [200]));
  }

  // 3) Stripe checkout session route should exist (often POST-only => 405 is OK)
  {
    const r = await http(`${base}/api/stripe/create-checkout-session`, {
      method: "GET",
    });
    results.push(
      expectOneOf("stripe:checkout:exists", r.status, [200, 401, 403, 405])
    );
  }

  // 4) Bio-code routes should exist (GET often 405/401/403; must not be 404)
  {
    const r1 = await http(`${base}/api/verify/bio-code/generate`, {
      method: "GET",
    });
    results.push(
      expectOneOf("verify:bio-generate:exists", r1.status, [401, 403, 405])
    );

    const r2 = await http(`${base}/api/verify/bio-code/check`, {
      method: "GET",
    });
    results.push(
      expectOneOf("verify:bio-check:exists", r2.status, [401, 403, 405])
    );
  }

  // 5) Rate limiting should be present on auth/verify routes:
  //    We do a short burst and assert: no 5xx. (429 is acceptable.)
  {
    const burst = 12;
    const target = `${base}/api/auth/session`;
    const statuses = [];

    for (let i = 0; i < burst; i++) {
      const r = await http(target, { method: "GET", timeoutMs: 10_000 });
      statuses.push(r.status);
    }

    const any5xx = statuses.some((s) => s >= 500);
    results.push(
      any5xx
        ? fail("ratelimit:auth:no-5xx", `Saw statuses: ${statuses.join(", ")}`)
        : ok("ratelimit:auth:no-5xx")
    );
  }

  const failed = results.filter((r) => !r.ok);

  if (failed.length === 0) {
    console.log(`SMOKE PASS (${results.length} checks)`);
    process.exit(0);
  }

  console.error(`SMOKE FAIL (${failed.length}/${results.length} failed)`);
  for (const f of failed) {
    console.error(`- ${f.name}${f.details ? `: ${f.details}` : ""}`);
  }
  process.exit(1);
}

run().catch(() => {
  console.error("SMOKE FAIL (unhandled)");
  process.exit(1);
});
