// app/api/verify/platform/check/route.ts
// 📅 Updated: 2025-10-27 09:54 PM ET

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function fetchWithTimeout(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (AEOBRO Verify Bot)" },
      cache: "no-store",
    });
    const text = await res.text();
    return { ok: res.ok, text };
  } catch {
    return { ok: false, text: "" };
  } finally {
    clearTimeout(id);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || null;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve the user by email (avoid relying on session.user.id typing)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Optional body: platform filter and/or explicit URLs
    let platformFilter: string | undefined;
    let explicitUrls: string[] | undefined;
    try {
      const body = await req.json();
      if (body?.platform && typeof body.platform === "string") platformFilter = body.platform;
      if (Array.isArray(body?.profileUrls)) {
        explicitUrls = body.profileUrls
          .filter((u: any) => typeof u === "string" && u.trim())
          .map((u: string) => u.trim());
      }
    } catch {
      // empty/invalid JSON is fine
    }

    // Load profile (to read the current verify marker, if any)
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        verificationStatus: true,
        verifyMarker: true,
        verifiedPlatforms: true,
      },
    });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    // Candidate URLs to crawl:
    // 1) Explicit URLs passed in the request body
    let urls: string[] = explicitUrls || [];

    // 2) Any pending BioCode rows (optionally filtered by platform)
    const pending = await prisma.bioCode.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
        ...(platformFilter ? { platform: platformFilter } : {}),
      },
      orderBy: { id: "desc" }, // no createdAt required; id DESC is OK
      select: { id: true, platform: true, profileUrl: true, code: true },
    });
    const pendingUrls = pending.map(p => p.profileUrl).filter(Boolean);
    urls = Array.from(new Set([...(urls || []), ...pendingUrls]));

    if (urls.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No platform URLs to check. Provide profileUrls or create a pending code first." },
        { status: 200 }
      );
    }

    // Marker to search for:
    // Prefer the profile's verifyMarker (new flow). If absent, fall back to newest pending bioCode.code.
    let marker = profile.verifyMarker || (pending[0]?.code ?? "");
    if (!marker) {
      return NextResponse.json(
        { ok: false, message: "No verification marker initialized. Start platform verification first." },
        { status: 200 }
      );
    }

    // Crawl pages
    const results = await Promise.all(urls.map(u => fetchWithTimeout(u)));
    const hitIndex = results.findIndex(r => r.ok && r.text && r.text.includes(marker));
    if (hitIndex === -1) {
      return NextResponse.json(
        { ok: false, message: "Marker not detected yet. Make sure it’s public in the bio/description, then retry." },
        { status: 200 }
      );
    }

    const matchedUrl = urls[hitIndex];
    const matchingPending = pending.find(p => p.profileUrl === matchedUrl && p.code === marker);

    // Update DB: mark matching BioCode VERIFIED (if exists) and flip Profile to PLATFORM_VERIFIED unless already DOMAIN_VERIFIED
    await prisma.$transaction(async (tx) => {
      if (matchingPending) {
        await tx.bioCode.update({
          where: { id: matchingPending.id },
          data: { status: "VERIFIED", verifiedAt: new Date() },
        });
      }

      // Merge verifiedPlatforms JSON map
      const current = await tx.profile.findUnique({ where: { userId: user.id } });
      const vp = ((current?.verifiedPlatforms as any) || {}) as Record<string, any>;
      const platKey = matchingPending?.platform || new URL(matchedUrl).hostname.replace(/^www\./, "");

      vp[platKey] = {
        url: matchedUrl,
        code: marker,
        verifiedAt: new Date().toISOString(),
      };

      await tx.profile.update({
        where: { userId: user.id },
        data: {
          verifiedPlatforms: vp,
          platformVerifiedAt: new Date(),
          verificationStatus:
            current?.verificationStatus === "DOMAIN_VERIFIED" ? "DOMAIN_VERIFIED" : "PLATFORM_VERIFIED",
          verifyCheckedAt: new Date(),
        },
      });
    });

    const final = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { verificationStatus: true },
    });

    return NextResponse.json({ ok: true, profile: final, matchedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
