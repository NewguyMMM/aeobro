// lib/slug.ts
export function toKebab(input: string) {
  return (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

// Add/adjust as needed
export const RESERVED_SLUGS = new Set([
  "admin","api","auth","login","logout","signup","register","dashboard",
  "settings","profile","profiles","user","users","docs","doc","help","support",
  "terms","privacy","pricing","about","contact","home","root","vercel","next",
  "p","_next","static","public","favicon","sitemap","robots","schema"
]);

const ILLEGAL_PATTERN = /^(?:\.{1,2}|-|_+|[0-9]+)$/; // disallow dot-only, dash-only, all digits, etc.

export function isSlugAllowed(slug: string) {
  if (!slug) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  if (ILLEGAL_PATTERN.test(slug)) return false;
  if (slug.length < 2) return false;
  return true;
}
