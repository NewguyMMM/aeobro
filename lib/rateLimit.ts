// lib/rateLimit.ts
import "server-only"; // ensure never bundled on the client

// 🧠 Lightweight, dependency-free rate limiter (in-memory with optional Upstash support)

type Key = string;
type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000; // 1 minute window
const MAX = 20;           // max 20 operations per window
const mem = new Map<Key, Bucket>();

// Optional Upstash support (if env vars set)
async function upstashIncr(key: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expireSec = Math.ceil(WINDOW_MS / 1000);

  const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  const count = Number(json?.result ?? 1);

  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${expireSec}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  }

  return { count, resetAt: (nowSec + expireSec) * 1000 };
}

export async function rateLimit(key: Key) {
  const up = await upstashIncr(key);
  if (up) {
    if (up.count > MAX) return { ok: false, remaining: 0, resetAt: up.resetAt };
    return { ok: true, remaining: MAX - up.count, resetAt: up.resetAt };
  }

  // fallback: local memory
  const now = Date.now();
  const b = mem.get(key);
  if (!b || now > b.resetAt) {
    const resetAt = now + WINDOW_MS;
    mem.set(key, { count: 1, resetAt });
    return { ok: true, remaining: MAX - 1, resetAt };
  }

  if (b.count >= MAX) return { ok: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { ok: true, remaining: MAX - b.count, resetAt: b.resetAt };
}
