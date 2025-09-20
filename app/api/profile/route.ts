// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toKebab, isSlugAllowed, RESERVED_SLUGS } from "@/lib/slug";
import { revalidatePath, revalidateTag } from "next/cache";

export const runtime = "nodejs";          // Prisma requires Node runtime
export const dynamic = "force-dynamic";   // don't cache API responses

/* ----------------------- helpers ----------------------- */

function jsonError(status: number, errorCode: string, message: string, extra?: any) {
  return NextResponse.json({ ok: false, errorCode, message, ...extra }, { status });
}

async function requireUserId() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return { err: jsonError(401, "UNAUTHORIZED", "Unauthorized") };
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) return { err: jsonError(401, "UNAUTHORIZED", "Unauthorized") };
    return { userId: user.id };
  } catch (e: any) {
    return { err: jsonError(500, "AUTH_FAILURE", e?.message || "Auth resolution failed") };
  }
}

// URL schema that allows empty, normalizes protocol, and enforces MAX length
const urlMaybeEmptyMax = (maxLen: number) =>
  z
    .string()
    .trim()
    .max(maxLen)
    .optional()
    .nullable()
    .transform((v) => (v ?? "").trim())
    .refine((v) => {
      if (!v) return true; // allow empty
      try {
        const s = /^https?:\/\//i.test(v) ? v : `https://${v}`;
        new URL(s);
        return true;
      } catch {
        return false;
      }
    }, "Must be a valid URL")
    .transform((v) => {
      if (!v) return "";
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    });

const urlMaybeEmpty200 = urlMaybeEmptyMax(200);
const urlMaybeEmpty300 = urlMaybeEmptyMax(300);

const csvOrArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return [] as string[];
    if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
    return String(v).split(",").map((s) => s.trim()).filter(Boolean);
  });

const intNullable = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  });

/* ---------- slug helpers ---------- */

const REGION_MAP: Record<string, string> = {
  // US states
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca", colorado: "co",
  connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga", hawaii: "hi", idaho: "id",
  illinois: "il", indiana: "in", iowa: "ia", kansas: "ks", kentucky: "ky", louisiana: "la",
  maine: "me", maryland: "md", massachusetts: "ma", michigan: "mi", minnesota: "mn",
  mississippi: "ms", missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv",
  "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
  "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok", oregon: "or",
  pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc", "south dakota": "sd",
  tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt", virginia: "va", washington: "wa",
  "west virginia": "wv", wisconsin: "wi", wyoming: "wy",
  // Canadian provinces (subset)
  ontario: "on", quebec: "qc", "british columbia": "bc", alberta: "ab",
};

function geoSuffixFromLocation(location?: string | null): string | null {
  if (!location) return null;
  const raw = String(location).toLowerCase();
  const abbrev = raw.match(/\b([a-z]{2,3})\b/gi)?.at(-1);
  if (abbrev && /^[a-z]{2,3}$/i.test(abbrev)) return toKebab(abbrev);
  for (const key of Object.keys(REGION_MAP)) {
    if (raw.includes(key)) return REGION_MAP[key];
  }
  const tokens = toKebab(raw).split("-").filter(Boolean);
  if (tokens.length) {
    const last = tokens.at(-1)!;
    if (last.length <= 6) return last;
  }
  return null;
}

async function ensureUniqueSlug(
  baseRaw: string,
  opts: { current?: string | null; location?: string | null } = {}
): Promise<string> {
  let base = toKebab(baseRaw || "");
  if (!base) base = "user";
  if (RESERVED_SLUGS.has(base) || !isSlugAllowed(base)) base = "user";

  const root = base;
  if (opts.current && opts.current === root) return root;

  const existingRoot = await prisma.profile.findUnique({
    where: { slug: root },
    select: { slug: true },
  });
  if (!existingRoot) return root;

  const geo = geoSuffixFromLocation(opts.location);
  if (geo) {
    const candidateGeo = `${root}-${geo}`;
    if (candidateGeo.length <= 80 && !RESERVED_SLUGS.has(candidateGeo)) {
      const hitGeo = await prisma.profile.findUnique({
        where: { slug: candidateGeo },
        select: { slug: true },
      });
      if (!hitGeo) return candidateGeo;
    }
  }

  for (let i = 2; i <= 500; i++) {
    const candidate = `${root}-${i}`;
    if (candidate.length > 80) break;
    const hit = await prisma.profile.findUnique({
      where: { slug: candidate },
      select: { slug: true },
    });
    if (!hit) return candidate;
  }

  return `${root}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ----------------------- schemas ----------------------- */

const LinkItem = z.object({
  label: z.string().trim().max(60).optional().default(""),
  url: urlMaybeEmpty300.default(""),
});

const PressItem = z.object({
  title: z.string().trim().max(120).optional().default(""),
  url: urlMaybeEmpty300.default(""),
});

const PlatformHandles = z
  .object({
    youtube: urlMaybeEmpty300.optional(),
    tiktok: urlMaybeEmpty300.optional(),
    instagram: urlMaybeEmpty300.optional(),
    substack: urlMaybeEmpty300.optional(),
    etsy: urlMaybeEmpty300.optional(),
    x: urlMaybeEmpty300.optional(),
    linkedin: urlMaybeEmpty300.optional(),
    facebook: urlMaybeEmpty300.optional(),
    github: urlMaybeEmpty300.optional(),
  })
  .partial()
  .optional();

const ProfileSchema = z.object({
  displayName: z.string().trim().max(120).optional().nullable(),
  tagline: z.string().trim().max(160).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  website: urlMaybeEmpty200.optional().nullable().or(z.literal("")).default(""),
  bio: z.string().trim().max(2000).optional().nullable(),

  links: z.array(LinkItem).max(20).optional().nullable().transform((v) => v ?? []),

  legalName: z.string().trim().max(160).optional().nullable(),
  entityType: z
    .enum(["Business", "Local Service", "Organization", "Creator / Person"])
    .optional()
    .nullable(),

  serviceArea: csvOrArray,
  foundedYear: intNullable,
  teamSize: intNullable,
  languages: csvOrArray,
  pricingModel: z.enum(["Free", "Subscription", "One-time", "Custom"]).optional().nullable(),
  hours: z.string().trim().max(160).optional().nullable(),

  certifications: z.string().trim().max(2000).optional().nullable(),
  press: z.array(PressItem).optional().nullable().transform((v) => v ?? []),

  logoUrl: urlMaybeEmpty300.optional().nullable(),
  imageUrls: z.array(urlMaybeEmpty300).optional().default([]),

  handles: PlatformHandles,

  // allow client to propose a slug
  slug: z.string().trim().max(80).optional().nullable(),
});

/* ----------------------- GET ----------------------- */

export async function GET() {
  const auth = await requireUserId();
  if ("err" in auth) return auth.err;

  try {
    const profile = await prisma.profile.findUnique({ where: { userId: auth.userId } });

    const payload =
      profile ?? {
        userId: auth.userId,
        links: [],
        press: [],
        imageUrls: [],
        serviceArea: [],
        languages: [],
        handles: {},
      };

    return NextResponse.json({ ok: true, profile: payload, ...payload });
  } catch (e: any) {
    console.error("GET /api/profile failed:", e);
    return jsonError(500, "DB_READ_FAILED", e?.message || "Failed to load profile");
  }
}

/* ----------------------- PUT/POST ----------------------- */

export async function PUT(req: Request) {
  const auth = await requireUserId();
  if ("err" in auth) return auth.err;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Invalid JSON");
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION", "Validation failed", { details: parsed.error.format() });
  }

  try {
    const d = parsed.data;

    // read existing (so we can detect slug changes)
    const existing = await prisma.profile.findUnique({
      where: { userId: auth.userId },
      select: { id: true, slug: true },
    });

    // Prefer displayName, then legalName, then client-proposed slug
    const proposedBase = (d.displayName ?? d.legalName ?? d.slug ?? "").toString();
    const finalSlug = await ensureUniqueSlug(proposedBase, {
      current: existing?.slug ?? null,
      location: d.location ?? null,
    });

    // Normalize empties to null; arrays to [] so UI and public page are stable
    const payload = {
      displayName: emptyToNull(d.displayName),
      legalName: emptyToNull(d.legalName),
      entityType: emptyToNull(d.entityType),
      tagline: emptyToNull(d.tagline),
      bio: emptyToNull(d.bio),

      website: emptyToNull(d.website),
      location: emptyToNull(d.location),

      serviceArea: d.serviceArea ?? [],
      foundedYear: d.foundedYear,
      teamSize: d.teamSize,
      languages: d.languages ?? [],
      pricingModel: emptyToNull(d.pricingModel),
      hours: emptyToNull(d.hours),

      certifications: emptyToNull(d.certifications),
      press: d.press ?? [],

      logoUrl: emptyToNull(d.logoUrl),
      imageUrls: (d.imageUrls ?? []).filter(Boolean),

      handles: d.handles ?? {},
      links: d.links ?? [],

      slug: finalSlug,
    };

    const saved = await prisma.profile.upsert({
      where: { userId: auth.userId },
      update: payload,
      create: { userId: auth.userId, ...payload },
      select: { id: true, slug: true }, // lean return
    });

    /* ---------- 🔥 Cache invalidation aligned to page tags ---------- */
    const oldSlug = existing?.slug;

    // If the slug changed, purge old routes/tags
    if (oldSlug && oldSlug !== saved.slug) {
      revalidatePath(`/p/${oldSlug}`);
      revalidatePath(`/api/profile/${oldSlug}/schema`);
      revalidatePath(`/og/${oldSlug}`);
      revalidateTag(`profile:${oldSlug}`);
    }

    // Always purge the new/current slug caches
    revalidatePath(`/p/${saved.slug}`);
    revalidatePath(`/api/profile/${saved.slug}/schema`);
    revalidatePath(`/og/${saved.slug}`);
    revalidateTag(`profile:${saved.slug}`);

    // Optional: if sitemap lists profiles, refresh it too
    revalidatePath(`/sitemap.xml`);

    return NextResponse.json({ ok: true, slug: saved.slug, id: saved.id });
  } catch (err: any) {
    if (
      err?.code === "P2002" &&
      (err?.meta?.target?.includes?.("slug") || err?.meta?.target?.includes?.("Profile_slug_key"))
    ) {
      return jsonError(409, "SLUG_TAKEN", "That public URL is already taken. Please choose another.");
    }

    console.error("PUT /api/profile failed:", err);
    return jsonError(500, "DB_WRITE_FAILED", err?.message || "Failed to save profile");
  }
}

// Some clients use POST—support both.
export async function POST(req: Request) {
  return PUT(req);
}

/* ----------------------- utils ----------------------- */
function emptyToNull<T extends string | null | undefined>(v: T): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}
