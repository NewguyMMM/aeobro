// app/api/schema/export/route.ts
// Updated: 2025-10-27 13:08 ET
// Purpose: Enforce verification gating for external JSON-LD export

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireVerifiedForExport } from "@/lib/verification";
// import { buildJsonLdForProfile } from "@/lib/schema"; // swap in when ready

export async function GET() {
  // 1) Require active session
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve user.id from email (avoids TS mismatch on Session.user)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Enforce verification gating (DOMAIN_VERIFIED or PLATFORM_VERIFIED)
  try {
    await requireVerifiedForExport(user.id);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Verification required for external syndication" },
      { status: e?.status || 403 }
    );
  }

  // 3) Load profile
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // 4) Build JSON-LD (placeholder — replace with your real builder)
  const isPerson =
    profile.entityType?.toLowerCase().includes("person") ||
    profile.entityType?.toLowerCase().includes("creator");

  const sameAs = (Object.values((profile.handles as any) || {}).filter(Boolean) as string[]) || [];
  const jsonld: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": isPerson ? "Person" : "Organization",
    name: profile.displayName || profile.legalName || "AEOBRO User",
    url: profile.website || `https://aeobro.com/${profile.slug}`,
    description: profile.bio || undefined,
    image: profile.logoUrl || undefined,
    ...(sameAs.length ? { sameAs } : {}),
  };

  // Return as application/ld+json
  return NextResponse.json(jsonld, {
    headers: {
      "Content-Type": "application/ld+json",
      "Cache-Control": "no-store",
    },
  });
}
