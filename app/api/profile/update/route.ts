// app/api/profile/update/route.ts
// ✅ Parse (zod) → Sanitize (lib/sanitize) → Detect (heuristic) → Persist (Prisma)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  logoUrl: z.string().url().optional().nullable(),

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

/** Map sanitized payload to the fields your Prisma model expects. */
function toPrismaData(input: z.infer<typeof ProfileInput>) {
  return {
    name: input.name ?? null,
    handle: input.handle ?? null,
    tagline: input.tagline ?? null,
    bio: input.bio ?? null,
    logoUrl: input.logoUrl ?? null,

    // If your schema stores these as JSON columns:
    links: input.links ?? [],
    services: input.services ?? [],
    faqs: input.faqs ?? [],
    social: input.social ?? {},
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

    // Extra hardening on URLs/strings (defensive duplication is fine)
    if (sanitized.logoUrl) sanitized.logoUrl = sanitizeUrl(sanitized.logoUrl) ?? null;
    if (sanitized.name) sanitized.name = sanitizePlain(sanitized.name, 200);
    if (sanitized.handle) sanitized.handle = sanitizePlain(sanitized.handle, 120);

    // 3) Detect prompt-injection heuristics (soft-fail: scrub & log)
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
    const profile = await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...data },
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
