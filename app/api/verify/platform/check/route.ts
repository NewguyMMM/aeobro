// app/api/verify/platform/check/route.ts
// 📅 Updated: 2025-10-27 02:15 PM ET

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { platformProfileUrls } from "@/lib/verification";

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
    const userIdFromSession = session?.user?.id || null;
    const emailFromSession = session?.user?.email || null;

    if (!userIdFromSession && !emailFromSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve user (prefer userId)
    let user = null as null | { id: string };
    if (userIdFromSession) {
      user = await prisma.user.findUnique({ where: { id: userIdFromSession }, select: { id: true } });
    } else if (emailFromSession) {
      user = await prisma.user.findUnique({ where: { email: emailFromSession }, select: { id: true } });
    }
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional filters from body
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
      // ignore empty/invalid JSON
    }

    // Load profile
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        verificationStatus: true,
        verifyMethod: true,
        verifyMarker: true,
        // platform handles (adjust to your schema field names)
        youtube: true,
        tiktok: true,
        instagram: true,
        substack: true,
        etsy: true,
        x: true,
        linkedin: true,
        facebook: true,
        github: true,
      },
    });

    if (!profile?.id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Gather candidate URLs:
    // 1) If the request passed explicit profileUrls, use those.
    // 2) Else, build from profile handles.
    let urls: string[] = explicitUrls || platformProfileUrls({
      youtube: (profile as any).youtube || undefined,
      tiktok: (profile as any).tiktok || undefined,
      instagram: (profile as any).instagram || undefined,
      substack: (profile as any).substack || undefined,
      etsy: (profile as any).etsy || undefined,
      x: (profile as any).x || undefined,
      linkedin: (profile as any).linkedin || undefined,
      facebook: (profile as any).facebook || undefined,
      github: (profile as any).github || undefined,
    });

    // 3) Also include any pending bioCode.profileUrl entries for this user (optionally filtered by platform)
    const pendingWhere = {
      userId: user.id,
      status: "PENDING" as const,
      ...(platformFilter ? { platform: platformFilter } : {}),
    };
    const pending = await prisma.bioCode.findMany({
      where: pendingWhere,
      orderBy: { id: "desc" }, // no createdAt column; id DESC as recency proxy
      select: { id: true, platform: true, profileUrl: true, code: true },
    });
    const pendingUrls = pending.map(p => p.profileUrl).filter(Boolean);
    urls = Array.from(new Set([...(urls || []), ...pendingUrls]));

    if (!urls || urls.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No platform URLs to check. Connect a platform or provide profileUrls." },
        { status: 200 }
      );
    }

    // Determine which marker to look for:
    // Prefer the profile's verifyMarker (new flow). If absent, fall back to the newest pending bioCode code.
    let marker = profile.verifyMarker || undefined;
    if (!marker && pending.length > 0) {
      marker = pending[0].code; // latest pending code
    }

    if (!marker) {
      return NextResponse.json(
        { ok: false, message: "No verification marker initialized. Start platform verification first." },
        { status: 200 }
      );
    }

    // Fetch pages and search for the marker
    const results = await Promise.all(urls.map((u) => fetchWithTimeout(u)));
    const foundIndex = results.findIndex(r => r.ok && r.text && r.text.includes(marker));

    if (foundIndex === -1) {
      return NextResponse.json(
        { ok: false, message: "Marker not detected yet. Make sure it’s publicly visible in your bio/description, then retry." },
        { status: 200 }
      );
    }

    const matchedUrl = urls[foundIndex];

    // If a matching pending bioCode exists for this URL+marker, mark it VERIFIED
    const matchingPending = pending.find(p => p.profileUrl === matchedUrl && p.code === marker);

    await prisma.$transaction(async (tx) => {
      if (matchingPending) {
        await tx.bioCode.update({
          where: { id: matchingPending.id },
          data: { status: "VERIFIED", verifiedAt: new Date() },
        });
      }

      const current = await tx.profile.findUnique({ where: { userId: user.id } });
      const nextStatus =
        current?.verificationStatus === "DOMAIN_VERIFIED" ? "DOMAIN_VERIFIED" : "PLATFORM_VERIFIED";

      // merge verifiedPlatforms (JSON) map
      const vp = (current?.verifiedPlatforms as any) || {};
      // Identify platform key best-effort from pending or from URL host
      const platKey =
        matchingPending?.platform ||
        new URL(matchedUrl).hostname.replace(/^www\./, "");

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
          verificationStatus: nextStatus,
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
