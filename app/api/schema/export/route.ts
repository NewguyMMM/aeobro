// app/api/schema/export/route.ts
// 📅 Updated: 2026-02-16 02:31 ET
// Purpose: Enforce verification gating for external JSON-LD export
// Adds: 2-tier gating (planStatus != active => LITE). PLUS+ may include gated fields in future.
// NOTE: This endpoint remains a placeholder builder; do NOT add PRO API logic yet.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireVerifiedForExport } from "@/lib/verification";
// import { buildJsonLdForProfile } from "@/lib/schema"; // swap in when ready

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function plusPublishingAllowed(planRaw: any, planStatusRaw: any): boolean {
  const status = String(planStatusRaw ?? "").toLowerCase();

  // Fail-closed: missing/anything other than "active" => treat as LITE
  if (status !== "active") return false;

  const plan = String(planRaw ?? "LITE").toUpperCase();
  const normalized = plan === "FREE" ? "LITE" : plan;

  // PRO behaves like PLUS for now (hidden), forward compatible
  return (
    normalized === "PLUS" ||
    normalized === "PRO" ||
    normalized === "BUSINESS" ||
    normalized === "ENTERPRISE"
  );
}

// Future-ready placeholder (no behavior change yet)
function apiIntegrationEnabledForPlan(_planRaw: any) {
  // When PRO is reintroduced with API integration, flip this to:
  // return normalizedPlan === "PRO" || normalizedPlan === "BUSINESS" || normalizedPlan === "ENTERPRISE";
  return false;
}

export async function GET() {
  // 1) Require active session
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve user.id + plan fields from email (use `as any` to avoid Prisma typing drift)
  const user = await (prisma.user as any).findUnique({
    where: { email },
    select: { id: true, plan: true, planStatus: true },
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

  // ✅ 4) 2-tier gating boundary (future-proof)
  const canIncludePlusFields = plusPublishingAllowed(user.plan, user.planStatus);

  // ✅ Future placeholder (no-op)
  const _apiIntegrationEnabled = apiIntegrationEnabledForPlan(user.plan);

  // 5) Build JSON-LD (placeholder — replace with your real builder later)
  const isPerson =
    profile.entityType?.toLowerCase().includes("person") ||
    profile.entityType?.toLowerCase().includes("creator");

  const sameAs =
    (Object.values((profile.handles as any) || {}).filter(Boolean) as string[]) || [];

  const jsonld: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": isPerson ? "Person" : "Organization",
    name: profile.displayName || profile.legalName || "AEOBRO User",
    url: profile.website || `https://aeobro.com/${profile.slug}`,
    description: profile.bio || undefined,
    image: profile.logoUrl || undefined,
    ...(sameAs.length ? { sameAs } : {}),
  };

  /**
   * IMPORTANT:
   * Even if we expand this builder later, LITE/inactive must never export:
   * - faqJson / servicesJson / productsJson / updateMessage
   */
  if (canIncludePlusFields) {
    // Placeholder: add PLUS-only export fields here in the future if desired.
    // Example (NOT enabled now):
    // jsonld.additionalProperty = [
    //   { "@type": "PropertyValue", name: "latestUpdate", value: profile.updateMessage }
    // ];
  }

  // Return as application/ld+json
  return NextResponse.json(jsonld, {
    headers: {
      "Content-Type": "application/ld+json",
      "Cache-Control": "no-store",
    },
  });
}
