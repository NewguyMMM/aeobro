// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toKebab } from "@/lib/slug";

/* ----------------------- helpers ----------------------- */

// Reserve obvious system paths
const RESERVED = new Set([
  "admin","api","app","auth","dashboard","login","logout","sign-in","sign-up",
  "pricing","privacy","terms","faq","aup","cancel","success","audit","disputes",
  "p","profile","profiles","user","users","me","settings","static","_next"
]);

async function ensureUniqueSlug(baseRaw: string) {
  const base0 = toKebab(baseRaw || "");
  let root = base0 && !RESERVED.has(base0) ? base0 : "user";
  if (RESERVED.has(root)) root = `${root}-1`;

  let candidate = root;
  let i = 1;
  // Try up to 200 suffixes; extremely unlikely to loop that far
  while (true) {
    const hit = await prisma.profile.findUnique({ where: { slug: candidate } });
    if (!hit) return candidate;
    i += 1;
    candidate = `${root}-${i}`;
  }
}

// URL schema that allows empty, normalizes protocol, and enforces MAX length
const urlMaybeEmptyMax = (maxLen: number) =>
  z.string().trim().max(maxLen).optional().nullable()
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

const csvOrArray = z.union([z.string(), z.array(z.string())]).optional().nullable()
  .transform((v) => {
    if (!v) return [] as string[];
    if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
    return String(v).split(",").map((s) => s.trim()).filter(Boolean);
  });

const intNullable = z.union([z.string(), z.number(), z.null(), z.undefined()])
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

const PlatformHandles = z.object({
  youtube: urlMaybeEmpty300.optional(),
  tiktok: urlMaybeEmpty300.optional(),
  instagram: urlMaybeEmpty300.optional(),
  substack: urlMaybeEmpty300.optional(),
  etsy: urlMaybeEmpty300.optional(),
  x: urlMaybeEmpty300.optional(),
  linkedin: urlMaybeEmpty300.optional(),
  facebook: urlMaybeEmpty300.optional(),
  github: urlMaybeEmpty300.optional(),
}).partial().optional();

const ProfileSchema = z.object({
  // original fields
  displayName: z.string().trim().max(120).optional().nullable(),
  tagline: z.string().trim().max(160).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  website: urlMaybeEmpty200.optional().nullable().or(z.literal("")).default(""),
  bio: z.string().trim().max(2000).optional().nullable(),

  // arrays default
  links: z.array(LinkItem).max(20).optional().nullable().transform((v) => v ?? []),

  // new fields
  legalName: z.string().trim().max(160).optional().nullable(),
  entityType: z.enum(["Business","Local Service","Organization","Creator / Person"]).optional().nullable(),

  serviceArea: csvOrArray,
  foundedYear: intNullable,
  teamSize: intNullable,
  languages: csvOrArray,
  pricingModel: z.enum(["Free","Subscription","One-time","Custom"]).optional().nullable(),
  hours: z.string().trim().max(160).optional().nullable(),

  certifications: z.string().trim().max(2000).optional().nullable(),

  // arrays default
  press: z.array(PressItem).optional().nullable().transform((v) => v ?? []),

  logoUrl: urlMaybeEmpty300.optional().nullable(),
  imageUrls: z.array(urlMaybeEmpty300).optional().default([]),

  handles: PlatformHandles,

  // incoming slug (optional) — server still validates/normalizes
  slug: z.string().trim().max(80).optional().nullable(),
});

/* ----------------------- GET: fetch or auto-create ----------------------- */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  let profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  // ✅ Auto-create a minimal profile with a guaranteed-unique slug
  if (!profile) {
    const base = session.user.name
      || user.name
      || (session.user.email ?? user.email ?? "").split("@")[0]
      || "user";

    const slug = await ensureUniqueSlug(base);

    profile = await prisma.profile.create({
      data: { userId: user.id, slug },
    });
  }

  return NextResponse.json(profile);
}

/* ----------------------- PUT: upsert with validation ----------------------- */

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
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

  // Normalize/validate slug (server-side)
  let incoming = toKebab(d.slug || "");
  if (!incoming) {
    // pick a base from displayName/legal/email, then ensure uniqueness
    const base =
      d.displayName ||
      d.legalName ||
      session.user.name ||
      (session.user.email ?? "").split("@")[0] ||
      "user";
    incoming = await ensureUniqueSlug(base);
  } else {
    if (RESERVED.has(incoming)) {
      return NextResponse.json({ error: "Slug is reserved" }, { status: 400 });
    }
    // If the same user already owns this slug, allow; otherwise enforce uniqueness
    const clash = await prisma.profile.findUnique({ where: { slug: incoming } });
    const mine = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (clash && clash.id !== mine?.id) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }
  }

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

    // ✅ always persist a non-null slug
    slug: incoming,
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
