// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toKebab, isSlugAllowed, RESERVED_SLUGS } from "@/lib/slug";
import { revalidatePath, revalidateTag } from "next/cache";
import { sanitizeProfilePayload } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* --------------------------------------------------- */
/*                         HELPERS                      */
/* --------------------------------------------------- */

function jsonError(status: number, errorCode: string, message: string, extra?: any) {
  return NextResponse.json({ ok: false, errorCode, message, ...extra }, { status });
}

async function requireUserId() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return { err: jsonError(401, "UNAUTHORIZED", "Unauthorized") };

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

const urlMaybeEmptyMax = (maxLen: number) =>
  z
    .string()
    .trim()
    .max(maxLen)
    .optional()
    .nullable()
    .transform((v) => (v ?? "").trim())
    .refine((v) => {
      if (!v) return true;
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
    if (!v) return [];
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

/* --------------------------------------------------- */
/*                SLUG HELPERS (UNCHANGED)             */
/* --------------------------------------------------- */

const REGION_MAP: Record<string, string> = {
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
  ontario: "on", quebec: "qc", "british columbia": "bc", alberta: "ab",
};

function geoSuffixFromLocation(location?: string | null): string | null {
  if (!location) return null;
  const raw = String(location).toLowerCase();

  const abbrev = raw.match(/\b([a-z]{2,3})\b/gi)?.at(-1);
  if (abbrev) return toKebab(abbrev);

  for (const key of Object.keys(REGION_MAP)) {
    if (raw.includes(key)) return REGION_MAP[key];
  }

  const tokens = toKebab(raw).split("-").filter(Boolean);
  const last = tokens.at(-1);
  return last && last.length <= 6 ? last : null;
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

  const existsRoot = await prisma.profile.findUnique({ where: { slug: root } });
  if (!existsRoot) return root;

  const geo = geoSuffixFromLocation(opts.location);
  if (geo) {
    const candidate = `${root}-${geo}`;
    if (!RESERVED_SLUGS.has(candidate) && candidate.length <= 80) {
      const existsGeo = await prisma.profile.findUnique({ where: { slug: candidate } });
      if (!existsGeo) return candidate;
    }
  }

  for (let i = 2; i <= 500; i++) {
    const cand = `${root}-${i}`;
    if (cand.length > 80) break;
    const exists = await prisma.profile.findUnique({ where: { slug: cand } });
    if (!exists) return cand;
  }

  return `${root}-${Math.random().toString(36).slice(2, 6)}`;
}

/* --------------------------------------------------- */
/*          EXTENDED SCHEMA — PHASE 2 FIELDS           */
/* --------------------------------------------------- */

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

/** NEW: FAQ + SERVICE JSON schemas */
const FAQItem = z.object({
  question: z.string().trim().max(500),
  answer: z.string().trim().max(5000),
});

const ServiceItem = z.object({
  name: z.string().trim().max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  url: urlMaybeEmpty300.optional().nullable(),
  priceMin: z.union([z.string(), z.number()]).optional().nullable(),
  priceMax: z.union([z.string(), z.number()]).optional().nullable(),
  priceUnit: z.string().trim().max(40).optional().nullable(),
  currency: z.string().trim().max(10).optional().nullable(),
});

/** EXTENDED Profile Schema */
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

  slug: z.string().trim().max(80).optional().nullable(),

  /** 🔥 NEW FIELDS */
  faqJson: z.array(FAQItem).optional().nullable().default([]),
  servicesJson: z.array(ServiceItem).optional().nullable().default([]),

  /** Latest update */
  updateMessage: z.string().trim().max(500).optional().nullable(),
});

/* --------------------------------------------------- */
/*                       GET                           */
/* --------------------------------------------------- */

export async function GET() {
  const auth = await requireUserId();
  if ("err" in auth) return auth.err;

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: auth.userId },
    });

    return NextResponse.json({
      ok: true,
      profile: profile ?? {
        userId: auth.userId,
        links: [],
        press: [],
        imageUrls: [],
        serviceArea: [],
        languages: [],
        faqJson: [],
        servicesJson: [],
        handles: {},
      },
    });
  } catch (e: any) {
    console.error("GET /api/profile failed:", e);
    return jsonError(500, "DB_READ_FAILED", e?.message || "Failed to load profile");
  }
}

/* --------------------------------------------------- */
/*                       PUT                            */
/* --------------------------------------------------- */

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
    return jsonError(400, "VALIDATION", "Validation failed", {
      details: parsed.error.format(),
    });
  }

  try {
    const d = sanitizeProfilePayload(parsed.data);

    const existing = await prisma.profile.findUnique({
      where: { userId: auth.userId },
      select: { id: true, slug: true },
    });

    const proposedBase = (d.displayName ?? d.legalName ?? d.slug ?? "").toString();
    const finalSlug = await ensureUniqueSlug(proposedBase, {
      current: existing?.slug ?? null,
      location: d.location ?? null,
    });

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

      /** 🔥 NEW: store Phase 2 fields */
      faqJson: d.faqJson ?? [],
      servicesJson: d.servicesJson ?? [],

      updateMessage: emptyToNull(d.updateMessage),

      slug: finalSlug,
    };

    const saved = await prisma.profile.upsert({
      where: { userId: auth.userId },
      update: payload,
      create: { userId: auth.userId, ...payload },
      select: { id: true, slug: true },
    });

    const oldSlug = existing?.slug;
    if (oldSlug && oldSlug !== saved.slug) {
      revalidatePath(`/p/${oldSlug}`);
      revalidatePath(`/api/profile/${oldSlug}/schema`);
      revalidatePath(`/og/${oldSlug}`);
      revalidateTag(`profile:${oldSlug}`);
    }

    revalidatePath(`/p/${saved.slug}`);
    revalidatePath(`/api/profile/${saved.slug}/schema`);
    revalidatePath(`/og/${saved.slug}`);
    revalidateTag(`profile:${saved.slug}`);
    revalidatePath(`/sitemap.xml`);

    return NextResponse.json({
      ok: true,
      slug: saved.slug,
      id: saved.id,
    });
  } catch (err: any) {
    if (
      err?.code === "P2002" &&
      (err?.meta?.target?.includes?.("slug") ||
        err?.meta?.target?.includes?.("Profile_slug_key"))
    ) {
      return jsonError(
        409,
        "SLUG_TAKEN",
        "That public URL is already taken. Please choose another."
      );
    }

    console.error("PUT /api/profile failed:", err);
    return jsonError(500, "DB_WRITE_FAILED", err?.message || "Failed to save profile");
  }
}

export async function POST(req: Request) {
  return PUT(req);
}

/* --------------------------------------------------- */
/*                     UTIL HELPERS                     */
/* --------------------------------------------------- */

function emptyToNull<T extends string | null | undefined>(v: T): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}
