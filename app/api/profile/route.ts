// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toKebab } from "@/lib/slug";

export const runtime = "nodejs";          // ensure Node (Prisma not supported on Edge)
export const dynamic = "force-dynamic";   // don’t cache API responses

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

const RESERVED = new Set([
  "admin","api","app","auth","dashboard","login","logout","sign-in","sign-up",
  "pricing","privacy","terms","faq","cancel","success","audit","disputes",
  "p","profile","profiles","user","users","me","settings","static","_next"
]);

async function ensureUniqueSlug(baseRaw: string, current?: string): Promise<string> {
  let base = toKebab(baseRaw || "");
  if (!base) base = "user";
  const root = RESERVED.has(base) ? "user" : base;

  // unchanged -> keep
  if (current && current === root) return root;

  // try root
  const existingRoot = await prisma.profile.findUnique({
    where: { slug: root },
    select: { slug: true },
  });
  if (!existingRoot) return root;

  // try -1, -2, ...
  for (let i = 1; i <= 500; i++) {
    const candidate = `${root}-${i}`;
    if (candidate.length > 80) break;
    const hit = await prisma.profile.findUnique({
      where: { slug: candidate },
      select: { slug: true },
    });
    if (!hit) return candidate;
  }

  // last-resort suffix
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
  // original fields
  displayName: z.string().trim().max(120).optional().nullable(),
  tagline: z.string().trim().max(160).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  website: urlMaybeEmpty200.optional().nullable().or(z.literal("")).default(""),
  bio: z.string().trim().max(2000).optional().nullable(),

  // ✅ accept null, coerce to []
  links: z.array(LinkItem).max(20).optional().nullable().transform((v) => v ?? []),

  // new fields
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

  // ✅ accept null, coerce to []
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

    // Return both shapes for compatibility
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

    // read existing (for slug keep/compare)
    const existing = await prisma.profile.findUnique({
      where: { userId: auth.userId },
      select: { slug: true },
    });

    const proposedSlug = (d.slug ?? d.displayName ?? d.legalName ?? "").toString();
    const finalSlug = await ensureUniqueSlug(proposedSlug, existing?.slug);

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

      // always include slug for Prisma create/update
      slug: finalSlug,
    };

    const saved = await prisma.profile.upsert({
      where: { userId: auth.userId },
      update: payload,
      create: { userId: auth.userId, ...payload },
    });

    return NextResponse.json({ ok: true, profile: saved, ...saved });
  } catch (err: any) {
    // Friendly duplicate-slug handling
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
