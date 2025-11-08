// app/api/profile/update/route.ts
// ✅ Parse (zod) → Sanitize (lib/sanitize) → Detect (heuristic) → Persist (Prisma)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  sanitizeProfilePayload,
  looksLikeInjection,
  sanitizePlain,
  sanitizeUrl,
} from "@/lib/sanitize";

/** Shape we accept from the client (adjust to your Prisma schema if needed). */
const ProfileInput = z.object({
  name: z.string().max(200).optional().nullable(),
  handle: z.string().max(120).optional().nullable(),
  tagline: z.string().max(500).optional().nullable(),
  bio: z.string().max(10_000).optional().nullable(),

  logoUrl: z.string().max(2048).optional().nullable(),

  links: z
    .array(
      z.object({
        label: z.string().max(200),
        url: z.string().max(2048),
      })
    )
    .max(100)
    .optional()
    .nullable(),

  services: z
    .array(
      z.object({
        name: z.string().max(200),
        description: z.string().max(2000).optional().nullable(),
      })
    )
    .max(100)
    .optional()
    .nullable(),

  faqs: z
    .array(
      z.object({
        q: z.string().max(500),
        a: z.string().max(4000),
      })
    )
    .max(100)
    .optional()
    .nullable(),

  social: z.record(z.string().max(200)).optional().nullable(),
});

/** Slug helpers */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureUniqueSlug(base: string) {
  let candidate = base || "user";
  let i = 0;
  // try a few suffixes if needed
  while (true) {
    const exists = await prisma.profile.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    i += 1;
    candidate = `${base}-${i}`;
    if (i > 50) {
      // fallback randomized
      candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
  }
}

/** Map sanitized payload to the fields your Prisma model expects. */
function toPrismaData(input: z.infer<typeof ProfileInput>) {
  return {
    name: input.name ?? null,
    handle: input.handle ?? null,
    tagline: input.tagline ?? null,
    bio: input.bio ?? null,
    logoUrl: input.logoUrl ?? null,

    // JSON fields as InputJsonValue
    links: (input.links ?? []) as Prisma.InputJsonValue,
    services: (input.services ?? []) as Prisma.InputJsonValue,
    faqs: (input.faqs ?? []) as Prisma.InputJsonValue,
    social: (input.social ?? {}) as Prisma.InputJsonValue,
  };
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1) Parse
    const json = await req.json();
    const parsed = ProfileInput.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 2) Sanitize (field-by-field)
    const sanitized = sanitizeProfilePayload(parsed.data);

    // Extra hardening on URLs/strings
    if (sanitized.logoUrl) sanitized.logoUrl = sanitizeUrl(sanitized.logoUrl) ?? null;
    if (sanitized.name) sanitized.name = sanitizePlain(sanitized.name, 200);
    if (sanitized.handle) sanitized.handle = sanitizePlain(sanitized.handle, 120);

    // 3) Detect prompt-injection heuristics (soft-fail: scrub & flag)
    let flagged = false;
    for (const key of ["name", "handle", "tagline", "bio"] as const) {
      const val = (sanitized as any)[key];
      if (val && looksLikeInjection(val)) {
        flagged = true;
        (sanitized as any)[key] = sanitizePlain(val, 500);
      }
    }

    // 4) Persist (upsert by userId)
    const data = toPrismaData(sanitized);

    // If the profile doesn't exist, Prisma will try to create and
    // your model requires a `slug`. Build a unique slug.
    const baseSlug =
      slugify(
        sanitized.handle ||
          sanitized.name ||
          session.user.name ||
          session.user.email?.split("@")[0] ||
          session.user.id
      ) || `user-${session.user.id.slice(0, 6)}`;
    const slug = await ensureUniqueSlug(baseSlug);

    const profile = await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, slug, ...data },
      update: data,
    });

    return NextResponse.json(
      { ok: true, profile, ...(flagged ? { warning: "Potential injection text was scrubbed." } : {}) },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("profile.update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH alias (same behavior as POST)
export const PATCH = POST;
