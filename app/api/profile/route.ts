// app/api/profile/route.ts
// 📅 Updated: 2026-02-23 13:09 ET
// Fix:
// 1) Normalize UI entityType labels (e.g., "Creator / Person") to Prisma enum EntityType values.
// 2) Keep fail-closed plan gating unchanged.
// 3) Keep AI_AGENT optional fields safe (only written if columns exist in Prisma schema).

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toKebab, isSlugAllowed, RESERVED_SLUGS } from "@/lib/slug";
import { revalidatePath, revalidateTag } from "next/cache";
import { sanitizeProfilePayload } from "@/lib/sanitize";

export const runtime = "nodejs"; // Prisma requires Node runtime
export const dynamic = "force-dynamic"; // don't cache API responses

/* --------------------------------------------------- */
/*                         HELPERS                     */
/* --------------------------------------------------- */

function jsonError(status: number, errorCode: string, message: string, extra?: any) {
  return NextResponse.json({ ok: false, errorCode, message, ...extra }, { status });
}

async function requireUserId() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { err: jsonError(401, "UNAUTHORIZED", "Unauthorized") };
    }

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

/**
 * ✅ Fail-closed plan enforcement (permission boundary)
 * Required rules:
 * - If planStatus !== "active" => treat as LITE
 * - If planStatus missing => treat as LITE
 * - PLUS (and PRO/BUSINESS/ENTERPRISE for now) behaves like PLUS
 * - If plan missing => treat as LITE
 */
async function getEffectivePlanKey(
  userId: string
): Promise<{ planKey: "LITE" | "PLUS"; isActive: boolean }> {
  try {
    const u = await (prisma.user as any).findUnique({
      where: { id: userId },
      select: { plan: true, planStatus: true },
    });

    const rawPlan = String(u?.plan ?? "LITE").toUpperCase();
    const rawStatus = String(u?.planStatus ?? "").toLowerCase();

    const isActive = rawStatus === "active"; // fail-closed: missing => false
    if (!isActive) return { planKey: "LITE", isActive: false };

    const normalizedPlan = rawPlan === "FREE" ? "LITE" : rawPlan;

    // PRO remains hidden; behaves like PLUS for now
    const isPlusLike =
      normalizedPlan === "PLUS" ||
      normalizedPlan === "PRO" ||
      normalizedPlan === "BUSINESS" ||
      normalizedPlan === "ENTERPRISE";

    return { planKey: isPlusLike ? "PLUS" : "LITE", isActive: true };
  } catch {
    return { planKey: "LITE", isActive: false };
  }
}

/**
 * ✅ Prisma-safe optional payload writer (schema-safe, not DB-safe)
 * We only include fields that exist on Prisma's Profile model
 * (prevents runtime errors from unknown fields).
 */
let __profileFieldSet: Set<string> | null = null;

function getProfileFieldSet(): Set<string> {
  if (__profileFieldSet) return __profileFieldSet;

  try {
    const dmmf = (prisma as any)?._dmmf;
    const models = dmmf?.datamodel?.models;
    const profileModel = Array.isArray(models) ? models.find((m: any) => m?.name === "Profile") : null;

    const fields = Array.isArray(profileModel?.fields)
      ? profileModel.fields.map((f: any) => String(f?.name)).filter(Boolean)
      : [];

    if (fields.length) {
      __profileFieldSet = new Set(fields);
      return __profileFieldSet;
    }
  } catch {
    // fall through
  }

  __profileFieldSet = new Set<string>();
  return __profileFieldSet;
}

function pickKnownProfileFields(data: Record<string, any>): Record<string, any> {
  const fieldSet = getProfileFieldSet();
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (fieldSet.size === 0) continue; // fail-closed for optional fields if introspection failed
    if (fieldSet.has(k)) out[k] = v;
  }
  return out;
}

/**
 * ✅ Normalize UI entityType strings to Prisma enum values at runtime.
 * This prevents "Expected EntityType" crashes when UI uses display labels.
 */
function normalizeEntityTypeForDb(input: any): string | null {
  const raw = (input ?? "").toString().trim();
  if (!raw) return null;

  const enums = (prisma as any)?.$Enums;
  const entityEnum = enums?.EntityType;

  // Prisma v5+ exposes enums as an object; values are the enum strings.
  const allowed: string[] = entityEnum ? (Object.values(entityEnum) as string[]) : [];

  // If we can't introspect, safest is to pass through (may still fail).
  if (!allowed.length) return raw;

  // If already valid enum value, keep it.
  if (allowed.includes(raw)) return raw;

  // Try exact matches ignoring case
  const lowerAllowed = allowed.map((v) => v.toLowerCase());
  const idxExact = lowerAllowed.indexOf(raw.toLowerCase());
  if (idxExact >= 0) return allowed[idxExact];

  // Common UI labels -> likely enum patterns.
  // We DO NOT assume exact enum names; we search within allowed values.
  const want =
    raw.toLowerCase() === "creator / person" || raw.toLowerCase() === "creator/person"
      ? ["creator", "person"]
      : raw.toLowerCase() === "local service"
      ? ["local", "service"]
      : raw.toLowerCase() === "business"
      ? ["business"]
      : raw.toLowerCase() === "organization"
      ? ["organization"]
      : raw.toLowerCase() === "product"
      ? ["product"]
      : raw.toLowerCase() === "ai_agent" || raw.toLowerCase() === "ai agent"
      ? ["ai", "agent"]
      : raw.toLowerCase().split(/[\s/_-]+/).filter(Boolean);

  // Best-match search: pick allowed value that contains most tokens.
  let best: { val: string; score: number } | null = null;
  for (const v of allowed) {
    const lv = v.toLowerCase();
    let score = 0;
    for (const t of want) if (lv.includes(t)) score++;
    if (!best || score > best.score) best = { val: v, score };
  }

  // Require at least 1 token match; otherwise return null to avoid crashing.
  if (best && best.score >= 1) return best.val;

  return null;
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
    .refine(
      (v) => {
        if (!v) return true; // allow empty
        try {
          const s = /^https?:\/\//i.test(v) ? v : `https://${v}`;
          new URL(s);
          return true;
        } catch {
          return false;
        }
      },
      "Must be a valid URL"
    )
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

/* --------------------------------------------------- */
/*                SLUG HELPERS (UNCHANGED)             */
/* --------------------------------------------------- */

const REGION_MAP: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
  ontario: "on",
  quebec: "qc",
  "british columbia": "bc",
  alberta: "ab",
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

/** FAQ + SERVICE JSON schemas */
const FAQItem = z.object({
  question: z.string().trim().max(500),
  answer: z.string().trim().max(5000),
  position: z.number().int().min(1).max(500).optional().nullable(),
});

const ServiceItem = z.object({
  name: z.string().trim().max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  url: urlMaybeEmpty300.optional().nullable(),
  priceMin: z.union([z.string(), z.number()]).optional().nullable(),
  priceMax: z.union([z.string(), z.number()]).optional().nullable(),
  priceUnit: z.string().trim().max(40).optional().nullable(),
  currency: z.string().trim().max(10).optional().nullable(),
  position: z.number().int().min(1).max(500).optional().nullable(),
});

/** Product schema */
const Money = z.object({
  amount: z.union([z.number(), z.string()]).optional().nullable(),
  currency: z.string().trim().max(10).optional().nullable(),
});

const ProductItem = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["PRODUCT", "SERVICE", "OFFER"]).optional().nullable(),
  url: urlMaybeEmpty300.optional().nullable(),
  image: urlMaybeEmpty300.optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  availability: z.enum(["InStock", "OutOfStock", "PreOrder", "LimitedAvailability"]).optional().nullable(),
  price: Money.optional().nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  gtin: z.string().trim().max(40).optional().nullable(),
  position: z.number().int().min(1).max(500).optional().nullable(),
});

/** AI_AGENT fields (Phase 1) — validated but optional */
const AIAgentFields = z.object({
  aiAgentProvider: z.string().trim().max(120).optional().nullable(),
  aiAgentModel: z.string().trim().max(120).optional().nullable(),
  aiAgentVersion: z.string().trim().max(60).optional().nullable(),
  aiAgentDocsUrl: urlMaybeEmpty300.optional().nullable(),
  aiAgentApiUrl: urlMaybeEmpty300.optional().nullable(),
  aiAgentCapabilities: csvOrArray,
  aiAgentInputModes: csvOrArray,
  aiAgentOutputModes: csvOrArray,
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

  // Accept UI strings; we normalize to DB enum later.
  entityType: z.string().trim().max(50).optional().nullable(),

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
  faqJson: z.array(FAQItem).optional().nullable().default([]),
  servicesJson: z.array(ServiceItem).optional().nullable().default([]),
  productsJson: z.array(ProductItem).optional().nullable().default([]),
  updateMessage: z.string().trim().max(500).optional().nullable(),
  ...AIAgentFields.shape,
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

    const payload =
      profile ?? {
        userId: auth.userId,
        links: [],
        press: [],
        imageUrls: [],
        serviceArea: [],
        languages: [],
        faqJson: [],
        servicesJson: [],
        productsJson: [],
        handles: {},
      };

    return NextResponse.json({ ok: true, profile: payload, ...payload });
  } catch (e: any) {
    console.error("GET /api/profile failed:", e);
    return jsonError(500, "DB_READ_FAILED", e?.message || "Failed to load profile");
  }
}

/* --------------------------------------------------- */
/*                       PUT/POST                      */
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
    return jsonError(400, "VALIDATION", "Validation failed", { details: parsed.error.format() });
  }

  try {
    // ✅ Sanitize AFTER validation, BEFORE DB write
    const dSan = sanitizeProfilePayload(parsed.data as any);

    // ✅ Preserve validated AI fields even if sanitize doesn't know them
    const d = {
      ...(dSan as any),
      aiAgentProvider: (parsed.data as any).aiAgentProvider ?? null,
      aiAgentModel: (parsed.data as any).aiAgentModel ?? null,
      aiAgentVersion: (parsed.data as any).aiAgentVersion ?? null,
      aiAgentDocsUrl: (parsed.data as any).aiAgentDocsUrl ?? "",
      aiAgentApiUrl: (parsed.data as any).aiAgentApiUrl ?? "",
      aiAgentCapabilities: (parsed.data as any).aiAgentCapabilities ?? [],
      aiAgentInputModes: (parsed.data as any).aiAgentInputModes ?? [],
      aiAgentOutputModes: (parsed.data as any).aiAgentOutputModes ?? [],
    };

    // ✅ Server-side permission boundary (fail-closed)
    const { planKey, isActive } = await getEffectivePlanKey(auth.userId);
    const canEditPlus = isActive && planKey === "PLUS";

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

    // ✅ Normalize entityType to Prisma enum value (prevents "Expected EntityType")
    const entityTypeDb = normalizeEntityTypeForDb(d.entityType);

    const payloadBase: Record<string, any> = {
      displayName: emptyToNull(d.displayName),
      legalName: emptyToNull(d.legalName),

      entityType: entityTypeDb, // ✅ critical fix

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

    // ✅ AI agent identity fields are NOT plan-gated (allowed for LITE).
    // ✅ Prisma-safe: only include if these columns exist on Prisma Profile model.
    const aiOptional = pickKnownProfileFields({
      aiAgentProvider: emptyToNull(d.aiAgentProvider),
      aiAgentModel: emptyToNull(d.aiAgentModel),
      aiAgentVersion: emptyToNull(d.aiAgentVersion),
      aiAgentDocsUrl: emptyToNull(d.aiAgentDocsUrl),
      aiAgentApiUrl: emptyToNull(d.aiAgentApiUrl),
      aiAgentCapabilities: d.aiAgentCapabilities ?? [],
      aiAgentInputModes: d.aiAgentInputModes ?? [],
      aiAgentOutputModes: d.aiAgentOutputModes ?? [],
    });

    // ✅ PLUS-only fields (server enforced; fail-closed)
    const plusOnly = canEditPlus
      ? {
          faqJson: d.faqJson ?? [],
          servicesJson: d.servicesJson ?? [],
          productsJson: d.productsJson ?? [],
          updateMessage: emptyToNull(d.updateMessage),
        }
      : {};

    const payload = {
      ...payloadBase,
      ...aiOptional,
      ...plusOnly,
    };

    const saved = await prisma.profile.upsert({
      where: { userId: auth.userId },
      update: payload as any,
      create: { userId: auth.userId, ...(payload as any) },
      select: { id: true, slug: true },
    });

    /* ---------- Cache invalidation ---------- */
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

/* --------------------------------------------------- */
/*                     UTIL HELPERS                    */
/* --------------------------------------------------- */

function emptyToNull<T extends string | null | undefined>(v: T): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}
