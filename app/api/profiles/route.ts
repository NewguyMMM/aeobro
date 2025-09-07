// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";            // ✅ keep your existing auth import
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/* ----------------------- helpers ----------------------- */

const urlMaybeEmpty = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .transform((v) => (v ?? "").trim())
  .refine((v) => {
    if (!v) return true; // allow empty
    try {
      // normalize missing protocol to https://
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

const csvOrArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return [] as string[];
    if (Array.isArray(v)) {
      return v.map(String).map((s) => s.trim()).filter(Boolean);
    }
    return v
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
  url: urlMaybeEmpty.default(""),
});

const PressItem = z.object({
  title: z.string().trim().max(120).optional().default(""),
  url: urlMaybeEmpty.default(""),
});

const PlatformHandles = z
  .object({
    youtube: urlMaybeEmpty.optional(),
    tiktok: urlMaybeEmpty.optional(),
    instagram: urlMaybeEmpty.optional(),
    substack: urlMaybeEmpty.optional(),
    etsy: urlMaybeEmpty.optional(),
    x: urlMaybeEmpty.optional(),
    linkedin: urlMaybeEmpty.optional(),
    facebook: urlMaybeEmpty.optional(),
    github: urlMaybeEmpty.optional(),
  })
  .partial()
  .optional();

const ProfileSchema = z.object({
  // original fields (kept for backward-compat)
  displayName: z.string().trim().max(120).optional().nullable(),
  tagline: z.string().trim().max(160).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  website: urlMaybeEmpty.max(200).optional().nullable().or(z.literal("")).default(""),
  bio: z.string().trim().max(2000).optional().nullable(),
  links: z.array(LinkItem).max(20).optional().default([]),

  // new fields
  legalName: z.string().trim().max(160).optional().nullable(),
  entityType: z
    .enum(["Business", "Local Service", "Organization", "Creator / Person"])
    .optional()
    .nullable(),

  serviceArea: csvOrArray, // ["NJ","NY"]  or "NJ, NY"
  foundedYear: intNullable,
  teamSize: intNullable,
  languages: csvOrArray,   // ["English","Spanish"] or "English, Spanish"
  pricingModel: z.enum(["Free", "Subscription", "One-time", "Custom"]).optional().nullable(),
  hours: z.string().trim().max(160).optional().nullable(),

  certifications: z.string().trim().max(2000).optional().nullable(),
  press: z.array(PressItem).optional().default([]),

  logoUrl: urlMaybeEmpty.optional().nullable(),
  imageUrls: z.array(urlMaybeEmpty).optional().default([]),

  handles: PlatformHandles,
});

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

  // Return a sane default shape so the client can prefill gracefully
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

  // Build payload exactly as your Prisma model expects.
  // NOTE: This assumes your `Profile` model has the fields from our earlier proposal:
  // strings, string[] for serviceArea/languages/imageUrls, and Json for links/press/handles.
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
    press: d.press?.length ? d.press : [],

    logoUrl: emptyToNull(d.logoUrl),
    imageUrls: (d.imageUrls ?? []).filter(Boolean),

    handles: d.handles ?? {},
    links: d.links ?? [],
  };

  const saved = await prisma.profile.upsert({
    where: { userId: user.id },
    update: payload,
    create: { userId: user.id, ...payload },
  });

  return NextResponse.json(saved);
}

/* ----------------------- utils ----------------------- */
function emptyToNull<T extends string | null | undefined>(v: T): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}
