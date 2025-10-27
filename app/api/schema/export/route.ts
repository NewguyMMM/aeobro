// app/api/schema/export/route.ts
// Created: 2025-10-27 13:02 ET
// Purpose: Enforce verification gating for external JSON-LD export

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireVerifiedForExport } from "@/lib/verification";
// import { buildJsonLdForProfile } from "@/lib/schema"; // optional, once schema builder is ready

export async function GET() {
  // Require active user session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Require verified profile (DOMAIN_VERIFIED or PLATFORM_VERIFIED)
  try {
    await requireVerifiedForExport(session.user.id);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Verification required" }, { status: e.status || 403 });
  }

  // Load profile
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // --- Placeholder JSON-LD builder (replace with your real schema function) ---
  const jsonld = {
    "@context": "https://schema.org",
    "@type":
      profile.entityType?.toLowerCase().includes("person") ||
      profile.entityType?.toLowerCase().includes("creator")
        ? "Person"
        : "Organization",
    name: profile.displayName || profile.legalName || "AEOBRO User",
    url: profile.website || `https://aeobro.com/${profile.slug}`,
    description: profile.bio || undefined,
    image: profile.logoUrl || undefined,
    sameAs: Object.values((profile.handles as any) || {}).filter(Boolean),
  };

  return NextResponse.json(jsonld, {
    headers: {
      "Content-Type": "application/ld+json",
      "Cache-Control": "no-store",
    },
  });
}
