// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toKebab, isSlugAllowed } from "@/lib/slug";

/* ----------------------- helpers ----------------------- */

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
    if (Array.isArray(v)) {
      return v.map(String).map((s) => s.trim()).filter(Boolean);
    }
    return String(v)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });

const intNullable = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  });

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
  links: z
    .array(LinkItem)
    .max(20)
    .optional()
    .nullable()
    .transform((v) => v ?? []),

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
  press: z
    .array(PressItem)
    .optional()
    .nullable()
    .transform((v) => v ?? []),

  logoUrl: urlMaybeEmpty300.optional().nullable(),
  imageUrls: z.array(urlMaybeEmpty300).optional().default([]),

  handles: PlatformHandles,

  // NEW: optional client-provided slug base (server will finalize)
  slug: z.string().trim().max(80).optional().nullable(),
});

/* ----------------------- slug helpers ----------------------- */

async function ensureUniqueSlug(base: string, excludeId?: string | null) {
  const start = toKebab(base || "profile");
  for (let i = 0; i < 200; i++) {
    const candidate = i === 0 ? start : `${start}-${i + 1}`;
    if (!isSlugAllowed(candidate)) continue;
    const exists = await prisma.profile.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw new Error("No available slug variants");
}

/* ----------------------- handlers ----------------------- */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  return NextResponse.json(
    profile ?? {
      userId: user.id,
      links: [],
      press: [],
      imageUrls: [],
      serviceArea: [],
      languages: [],
      handles: {},
    }
  );
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  // Compute a legal, unique slug
  const existing = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  const requestedBase = toKebab(d.slug || d.displayName || d.legalName || "profile");
  const legalBase = isSlugAllowed(requestedBase)
    ? requestedBase
    : toKebab(d.displayName || d.legalName || "profile");

  const finalSlug = await ensureUniqueSlug(legalBase, existing?.id);

  const payload = {
    slug: finalSlug, // ✅ REQUIRED on create; also set on update to keep in sync

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

    userId: user.id,
  };

  const saved = await prisma.profile.upsert({
    where: { userId: user.id },
    update: payload,
    create: payload, // includes slug, satisfying Prisma types & DB NOT NULL
  });

  // Return the profile object (your client handles both wrapped and unwrapped)
  return NextResponse.json(saved);
}

/* ----------------------- utils ----------------------- */
function emptyToNull<T extends string | null | undefined>(v: T): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}
