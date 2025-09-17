// lib/slug.ts

export function toKebab(input: string) {
  return (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

// Centralized reserved list (shared by API & UI)
export const RESERVED_SLUGS = new Set([
  "admin","api","app","auth","login","logout","sign-in","sign-up","register",
  "dashboard","settings","profile","profiles","user","users","me",
  "docs","doc","help","support","faq","terms","privacy","pricing","about","contact",
  "home","root","vercel","next","p","_next","static","public","favicon",
  "sitemap","robots","schema","cancel","success","audit","disputes"
]);

// Disallow dot-only, dash-only, all digits, single-char, etc.
const ILLEGAL_PATTERN = /^(?:\.{1,2}|-+|_+|[0-9]+)$/;

export function isSlugAllowed(slug: string) {
  if (!slug) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  if (ILLEGAL_PATTERN.test(slug)) return false;
  if (slug.length < 2) return false;
  return true;
}
