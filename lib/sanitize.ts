// lib/sanitize.ts
// Centralized sanitizers & encoders for AEOBRO
// - Keeps your existing helpers (sanitizeText, sanitizeUrl, etc.)
// - Adds rich/strict modes, HTML comment stripping, JSON-LD escaping
// - Includes a simple heuristic detector for prompt-injection phrases

import sanitizeHtml from "sanitize-html";

/* ────────────────────────────────────────────────────────────────────────────
 * Core utilities
 * ──────────────────────────────────────────────────────────────────────────── */

/** Collapse whitespace, strip control/format chars, trim, and cap length. */
export function sanitizePlain(input: unknown, maxLen = 5000): string {
  const raw = typeof input === "string" ? input : String(input ?? "");
  // Remove NUL + invisible format characters that can hide payloads
  const stripped = raw.replace(/\u0000/g, "").replace(/\p{Cf}/gu, "");
  return stripped.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/** HTML → safe subset (keeps simple inline tags; strips scripts & comments). */
export function sanitizeRich(input: unknown, maxLen = 8000): string {
  const raw = typeof input === "string" ? input : String(input ?? "");
  const withoutComments = stripHtmlComments(raw);
  const clean = sanitizeHtml(withoutComments, {
    allowedTags: ["b", "i", "em", "strong", "a", "ul", "ol", "li", "p", "br", "code", "pre"],
    allowedAttributes: { a: ["href", "title", "rel", "target"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
    },
    disallowedTagsMode: "discard",
  });
  return clean.slice(0, maxLen);
}

/** Strip ALL HTML (stricter than sanitizeRich), normalize whitespace, cap length. */
export function sanitizeText(input: unknown, maxLen = 5000): string {
  const raw = typeof input === "string" ? input : String(input ?? "");
  const cleaned = sanitizeHtml(raw, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  })
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, maxLen);
}

/** Remove HTML comments everywhere (kills <!-- hidden instructions -->). */
export function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

/** Escape a string for safe inclusion inside JSON-LD values. */
export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(String(value ?? "")).slice(1, -1);
}

/** Lightweight heuristic to flag likely prompt-injection text. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all )?previous instructions/i,
  /\b(system|developer)\s*prompt/i,
  /do as (system|developer) says/i,
  /exfiltrate|leak (?:data|secrets|keys)/i,
  /execute (?:command|shell)/i,
  /base64/i,
];
export function looksLikeInjection(s: unknown): boolean {
  const hay = typeof s === "string" ? s : String(s ?? "");
  const sample = hay.slice(0, 12000);
  return INJECTION_PATTERNS.some((re) => re.test(sample));
}

/* ────────────────────────────────────────────────────────────────────────────
 * URL & collection helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Only allow http/https URLs; otherwise return null. */
export function sanitizeUrl(input: unknown): string | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/** Clean arrays of strings safely. */
export function sanitizeStringArray(
  arr: unknown,
  maxItemLen = 2048,
  maxItems = 100
): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, maxItems)
    .map((v) => sanitizeText(v, maxItemLen))
    .filter((v) => v.length > 0);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Opinionated payload sanitizer (adjust field names to your schema)
 * ──────────────────────────────────────────────────────────────────────────── */

export function sanitizeProfilePayload<T extends Record<string, any>>(payload: T) {
  const out: Record<string, any> = { ...payload };

  // Plain text fields
  if ("name" in out) out.name = sanitizePlain(out.name, 200);
  if ("handle" in out) out.handle = sanitizePlain(out.handle, 120);
  if ("tagline" in out) out.tagline = sanitizePlain(out.tagline, 500);

  // Longform (strip comments, then strict text or minimal rich text)
  if ("bio" in out) out.bio = sanitizeText(stripHtmlComments(out.bio ?? ""), 5000);

  // URLs / images
  if ("logoUrl" in out) out.logoUrl = sanitizeUrl(out.logoUrl);

  // Arrays of objects
  if ("links" in out && Array.isArray(out.links)) {
    out.links = out.links
      .slice(0, 100)
      .map((l: any) => ({
        label: sanitizeText(l?.label ?? "", 200),
        url: sanitizeUrl(l?.url) ?? "",
      }))
      .filter((l: any) => l.label && l.url);
  }

  if ("services" in out && Array.isArray(out.services)) {
    out.services = out.services
      .slice(0, 100)
      .map((s: any) => ({
        name: sanitizeText(s?.name ?? "", 200),
        description: sanitizeText(s?.description ?? "", 2000),
      }))
      .filter((s: any) => s.name);
  }

  if ("faqs" in out && Array.isArray(out.faqs)) {
    out.faqs = out.faqs
      .slice(0, 100)
      .map((f: any) => ({
        q: sanitizeText(f?.q ?? "", 500),
        a: sanitizeText(f?.a ?? "", 4000),
      }))
      .filter((f: any) => f.q && f.a);
  }

  // Flat social map
  if ("social" in out && typeof out.social === "object" && out.social) {
    const s = out.social as Record<string, any>;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(s)) {
      const val = typeof v === "string" ? sanitizePlain(v, 200) : "";
      if (val) clean[k] = val;
    }
    out.social = clean;
  }

  // Optional: flag any fields that look like injection payloads
  for (const key of ["name", "handle", "tagline", "bio"]) {
    if (key in out && looksLikeInjection(out[key])) {
      // You can choose to throw, strip, or log here. For now, we just trim aggressively.
      out[key] = sanitizePlain(out[key], 500);
    }
  }

  return out as T;
}

/* ────────────────────────────────────────────────────────────────────────────
 * JSON-LD helper (use in lib/schema.ts)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Safely map user strings to JSON-LD string values. */
export function jsonLdSafe<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = escapeJsonLd(v);
    else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "string" ? escapeJsonLd(x) : x));
    else out[k] = v;
  }
  return out as T;
}
