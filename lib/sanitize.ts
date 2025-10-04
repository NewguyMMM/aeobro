import sanitizeHtml from "sanitize-html";

/** Strip all HTML, normalize whitespace, cap length */
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

/** Only allow http/https URLs; otherwise return null */
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

/** Clean arrays of strings safely */
export function sanitizeStringArray(arr: unknown, maxItemLen = 2048, maxItems = 100): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, maxItems)
    .map(v => sanitizeText(v, maxItemLen))
    .filter(v => v.length > 0);
}

/** Opinionated profile payload sanitizer — tweak field names to match your schema */
export function sanitizeProfilePayload<T extends Record<string, any>>(payload: T) {
  const out: Record<string, any> = { ...payload };

  if ("name" in out) out.name = sanitizeText(out.name, 200);
  if ("handle" in out) out.handle = sanitizeText(out.handle, 120);
  if ("tagline" in out) out.tagline = sanitizeText(out.tagline, 500);
  if ("bio" in out) out.bio = sanitizeText(out.bio, 5000);

  if ("logoUrl" in out) out.logoUrl = sanitizeUrl(out.logoUrl);

  if ("links" in out && Array.isArray(out.links)) {
    out.links = out.links.slice(0, 100).map((l: any) => ({
      label: sanitizeText(l?.label ?? "", 200),
      url: sanitizeUrl(l?.url) ?? "",
    })).filter((l: any) => l.label && l.url);
  }

  if ("services" in out && Array.isArray(out.services)) {
    out.services = out.services.slice(0, 100).map((s: any) => ({
      name: sanitizeText(s?.name ?? "", 200),
      description: sanitizeText(s?.description ?? "", 2000),
    })).filter((s: any) => s.name);
  }

  if ("faqs" in out && Array.isArray(out.faqs)) {
    out.faqs = out.faqs.slice(0, 100).map((f: any) => ({
      q: sanitizeText(f?.q ?? "", 500),
      a: sanitizeText(f?.a ?? "", 4000),
    })).filter((f: any) => f.q && f.a);
  }

  if ("social" in out && typeof out.social === "object" && out.social) {
    const s = out.social as Record<string, any>;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(s)) {
      const val = typeof v === "string" ? sanitizeText(v, 200) : "";
      if (val) clean[k] = val;
    }
    out.social = clean;
  }

  return out as T;
}
