// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toKebab } from "@/lib/slug";

/* ----------------------- helpers ----------------------- */

function emptyToNull<T extends string | null | undefined>(v: T): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
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

function safeBaseSlug(input: string) {
  let base = toKebab(input || "");
  if (!base) base = "profile";
  if (RESERVED.has(base)) base = "profile";
  return base;
}

function randomSuffix(len = 4) {
  return Math.random().toString(36).slice(2, 2 + len);
}

/** Try DB-backed uniqueness, but never throw; fall back to a local unique slug. */
async function getUniqueSlugSafely(baseRaw: string, current?: string): Promise<string> {
  const root = safeBaseSlug(baseRaw);

  // Keep existing unchanged
  if (current && current === root) return root;

  try {
    const hitRoot = await prisma.profile.findUnique({
      where: { slug: root },
      select: { slug: true },
    });
    if (!hitRoot) return root;

    for (let i = 1; i <= 500; i++) {
      const candidate = `${root}-${i}`;
      if (candidate.length > 80) break;
      const hit = await prisma.profile.findUnique({
        where: { slug: candidate },
        select: { slug: true },
      });
      if (!hit) return candidate;
    }
    // fallback with random
    return `${root}-${randomSuffix()}`;
  } catch {
    // If the lookup fails for any reason (schema mismatch, etc.), still return a safe slug.
    return `${root}-${randomSuffix()}`;
  }
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
  press: z.array(PressItem).optional().nullable().transform((v) => v ?? []),

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

  logoUrl: urlMaybeEmpty300.optional().nullable(),
  imageUrls: z.array(urlMaybeEmpty300).optional().default([]),

  handles: PlatformHandles,

  slug: z.string().trim().max(80).optional().nullable(),

  // Legacy top-level socials accepted & merged into handles
  youtubeUrl: urlMaybeEmpty300.optional(),
  tiktokUrl: urlMaybeEmpty300.optional(),
  instagramUrl: urlMaybeEmpty300.optional(),
  substackUrl: urlMaybeEmpty300.optional(),
  etsyUrl: urlMaybeEmpty300.optional(),
  twitterUrl: urlMaybeEmpty300.optional(),
  linkedinUrl: urlMaybeEmpty300.optional(),
  facebookUrl: urlMaybeEmpty300.optional(),
  githubUrl: urlMaybeEmpty300.optional(),
});

/* ----------------------- auth helper ----------------------- */

async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: "Unauthorized", status: 401 as const };
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return { error: "Unauthorized", status: 401 as const };
  return { userId: user.id };
}

/* ----------------------- GET ----------------------- */

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const profile = await prisma.profile.findUnique({ where: { userId: auth.userId } });

  const payload =
    profile ??
    {
      userId: auth.userId,
      links: [],
      press: [],
      imageUrls: [],
      serviceArea: [],
      languages: [],
      handles: {},
    };

  return NextResponse.json({ profile: payload, ...payload });
}

/* ----------------------- PUT/POST ----------------------- */

function mergeHandles(d: z.infer<typeof ProfileSchema>) {
  const h = { ...(d.handles ?? {}) } as Record<string, string | undefined>;
  const legacy: Record<string, string | undefined> = {
    youtube: d.youtubeUrl,
    tiktok: d.tiktokUrl,
    instagram: d.instagramUrl,
    substack: d.substackUrl,
    etsy: d.etsyUrl,
    x: d.twitterUrl,
    linkedin: d.linkedinUrl,
    facebook: d.facebookUrl,
    github: d.githubUrl,
  };
  for (const [k, v] of Object.entries(legacy)) {
    if (v && v.trim()) h[k] = v;
  }
  for (const k of Object.keys(h)) {
    if (!h[k]) delete h[k];
  }
  return h;
}

async function upsertProfile(req: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  // read existing (for slug keep/compare)
  const existing = await prisma.profile.findUnique({
    where: { userId: auth.userId },
    select: { slug: true },
  });

  // 🔒 Never throws; falls back to profile-xxxx on DB hiccups
  const finalSlug = await getUniqueSlugSafely(
    (d.slug ?? d.displayName ?? d.legalName ?? "").toString(),
    existing?.slug
  );

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

    handles: mergeHandles(d),
    links: d.links ?? [],

    slug: finalSlug,
  };

  try {
    const saved = await prisma.profile.upsert({
      where: { userId: auth.userId },
      update: payload,
      create: { userId: auth.userId, ...payload },
    });

    return NextResponse.json({ ok: true, profile: saved, ...saved });
  } catch (err: any) {
    const code = err?.code || err?.name || "UNKNOWN";
    const message = err?.message || "Failed to save profile.";

    // Unique constraint on slug → 409
    if (
      code === "P2002" &&
      (err?.meta?.target?.includes?.("slug") || err?.meta?.target?.includes?.("Profile_slug_key"))
    ) {
      return NextResponse.json(
        { ok: false, error: "SLUG_TAKEN", errorCode: code, message: "That public URL is already taken. Please choose another." },
        { status: 409 }
      );
    }

    // Unknown arg / schema mismatch → 400 with details
    if (typeof message === "string" && (message.includes("Unknown arg") || message.includes("does not exist"))) {
      return NextResponse.json(
        { ok: false, error: "SCHEMA_MISMATCH", errorCode: code, message },
        { status: 400 }
      );
    }

    console.error("Profile save failed:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL", errorCode: code, message },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  return upsertProfile(req);
}
export async function POST(req: Request) {
  return upsertProfile(req);
}
