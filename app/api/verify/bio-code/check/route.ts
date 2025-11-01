// app/api/verify/bio-code/check/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SUPPORTED_PLATFORMS = new Set([
  "github",
  "x",
  "instagram",
  "tiktok",
  "youtube",
  "substack",
  "etsy",
  "linkedin",
  "facebook",
]);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform, handle, profileUrl } = await req.json().catch(() => ({}));
    if (typeof platform !== "string" || !SUPPORTED_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: "Invalid or unsupported platform" },
        { status: 400 }
      );
    }

    // Soft plan gate (same policy as generate)
    const allowed = await ensurePlanAllowsBioCode(userId);
    if (!allowed.ok) {
      return NextResponse.json(
        { error: allowed.message ?? "Not allowed on current plan" },
        { status: 403 }
      );
    }

    // Resolve a usable handle + canonical URL
    const resolved = await resolveHandleAndUrl(userId, platform, handle, profileUrl);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: 400 });
    }

    // Find active code (by expiry window)
    const latest = await findActiveBioCode(userId, platform);
    if (!latest) {
      return NextResponse.json(
        { error: "No active BioCode found. Generate one first." },
        { status: 400 }
      );
    }

    // Pull the public bio/about text (or page HTML fallback) and look for the token
    const { bioText, rawHtml } = await fetchPlatformAbout(platform, resolved.handle!, resolved.url!);
    const haystack = `${bioText ?? ""}\n${rawHtml ?? ""}`.toLowerCase();
    const needle = latest.code.toLowerCase();

    if (!haystack.includes(needle)) {
      // Touch account (optional last-checked)
      await touchPlatformAccount(userId, platform, resolved.handle, resolved.url);
      return NextResponse.json(
        { verified: false, message: "Code not found in public bio/about yet. Give it a minute and try again." },
        { status: 200 }
      );
    }

    const now = new Date();

    // Success: delete the code (one-time use) and update/create PlatformAccount with BIO_CODE
    await prisma.$transaction(async (tx) => {
      await tx.bioCode.delete({ where: { id: latest.id } });

      const existing = await tx.platformAccount.findFirst({
        where: { userId, platform } as any, // tolerate schema variance
        select: { id: true },
      });

      if (existing?.id) {
        // Build an update payload that tolerates different URL field names
        const updateData: Record<string, any> = {
          method: "BIO_CODE",
          verifiedAt: now,
          lastCheckedAt: now,
        };
        if (resolved.handle) updateData.handle = resolved.handle;
        Object.assign(updateData, urlFieldPatch(resolved.url));

        await tx.platformAccount.update({
          where: { id: existing.id },
          data: updateData as any,
        });
      } else {
        // Build a create payload that tolerates different URL field names
        const createData: Record<string, any> = {
          userId,
          // if your model uses a different field (e.g. provider), map it here:
          platform: platform as any,
          method: "BIO_CODE",
          verifiedAt: now,
          lastCheckedAt: now,
        };
        if (resolved.handle) createData.handle = resolved.handle;
        Object.assign(createData, urlFieldPatch(resolved.url));

        await tx.platformAccount.create({
          data: createData as any,
        });
      }
    });

    const platformAccount = await prisma.platformAccount.findFirst({
      where: { userId, platform } as any,
      select: { id: true } as any,
      orderBy: { updatedAt: "desc" } as any, // omit or keep; casted for safety
    });

    return NextResponse.json({
      verified: true,
      platformAccountId: (platformAccount as any)?.id,
      matchedAt: now.toISOString(),
    });
  } catch (err: any) {
    console.error("[bio-code/check] error:", err);
    return NextResponse.json(
      { error: "Verification check failed" },
      { status: 500 }
    );
  }
}

/* -------------------- helpers -------------------- */

// Session → userId resolver (runtime safety)
async function getAuthUserId(session: any): Promise<string | null> {
  const id = session?.user?.id;
  if (typeof id === "string" && id) return id;

  const email = session?.user?.email;
  if (typeof email === "string" && email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user?.id) return user.id;
  }
  return null;
}

// Soft-gating helper (adjust to your schema as needed)
async function ensurePlanAllowsBioCode(
  userId: string
): Promise<{ ok: true } | { ok: false; message?: string }> {
  try {
    const profile = await prisma.profile.findFirst({
      where: { userId },
      select: { plan: true },
    });
    const plan = (profile?.plan || "Lite").toLowerCase();
    const allowed = ["lite", "plus", "pro", "business", "enterprise"].includes(plan);
    if (!allowed) {
      return { ok: false, message: "Please upgrade your plan to use Code-in-Bio verification." };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// Resolve a usable handle and canonical URL from (handle | profileUrl | existing PlatformAccount)
async function resolveHandleAndUrl(
  userId: string,
  platform: string,
  handle?: string,
  profileUrl?: string
): Promise<{ ok: true; handle?: string; url?: string } | { ok: false; message: string }> {
  if (profileUrl) {
    return { ok: true, handle: handle ?? parseHandleFromUrl(platform, profileUrl), url: profileUrl };
  }
  if (handle) {
    return { ok: true, handle, url: buildDefaultUrl(platform, handle) };
  }

  const existing = await prisma.platformAccount.findFirst({
    where: { userId, platform } as any,
    select: { handle: true, /* tolerate schema variance */ } as any,
  });
  if ((existing as any)?.handle) {
    const h = (existing as any).handle as string;
    return { ok: true, handle: h, url: buildDefaultUrl(platform, h) };
  }

  return { ok: false, message: "Provide a handle or profileUrl to check." };
}

function parseHandleFromUrl(platform: string, url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase();
    const path = u.pathname.replace(/^\/+/, "");
    if (!path) return undefined;

    if (platform === "github" && host.includes("github.com")) return path.split("/")[0];
    if (platform === "x" && (host.includes("x.com") || host.includes("twitter.com"))) return path.split("/")[0];
    if (platform === "instagram" && host.includes("instagram.com")) return path.split("/")[0];
    if (platform === "tiktok" && host.includes("tiktok.com")) return path.split("/")[0].replace(/^@/, "");
    if (platform === "youtube" && host.includes("youtube.com")) {
      if (path.startsWith("@")) return path.slice(1);
      if (path.startsWith("channel/")) return path.split("/")[1];
      return path.split("/")[0];
    }
    if (platform === "substack" && host.endsWith(".substack.com")) return host.replace(".substack.com", "");
    if (platform === "etsy" && host.includes("etsy.com")) return path.split("/")[1]; // /shop/<handle>
    if (platform === "linkedin" && host.includes("linkedin.com")) return path.split("/")[1]; // /in/<handle> or /company/<handle>
    if (platform === "facebook" && host.includes("facebook.com")) return path.split("/")[0];
  } catch {}
  return undefined;
}

function buildDefaultUrl(platform: string, handle: string): string | undefined {
  switch (platform) {
    case "github":
      return `https://github.com/${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    case "instagram":
      return `https://www.instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "youtube":
      return handle.startsWith("@") ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/@${handle}`;
    case "substack":
      return `https://${handle}.substack.com`;
    case "etsy":
      return `https://www.etsy.com/shop/${handle}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${handle}`; // adjust for company pages if needed
    case "facebook":
      return `https://www.facebook.com/${handle}`;
    default:
      return undefined;
  }
}

async function findActiveBioCode(userId: string, platform: string) {
  const now = new Date();
  return prisma.bioCode.findFirst({
    where: { userId, platform, expiresAt: { gt: now } } as any,
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, expiresAt: true },
  });
}

async function touchPlatformAccount(userId: string, platform: string, handle?: string, url?: string) {
  const now = new Date();
  try {
    const existing = await prisma.platformAccount.findFirst({
      where: { userId, platform } as any,
      select: { id: true },
    });

    if (existing?.id) {
      const updateData: Record<string, any> = { lastCheckedAt: now };
      if (handle) updateData.handle = handle;
      Object.assign(updateData, urlFieldPatch(url));

      await prisma.platformAccount.update({
        where: { id: existing.id },
        data: updateData as any,
      });
    } else {
      const createData: Record<string, any> = {
        userId,
        platform: platform as any,
        lastCheckedAt: now,
      };
      if (handle) createData.handle = handle;
      Object.assign(createData, urlFieldPatch(url));

      await prisma.platformAccount.create({
        data: createData as any,
      });
    }
  } catch {
    // non-fatal
  }
}

async function fetchPlatformAbout(
  platform: string,
  handle: string,
  url: string
): Promise<{ bioText?: string; rawHtml?: string }> {
  try {
    if (platform === "github") {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
        headers: { "User-Agent": "aeobro-bio-verify" },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const name = typeof json.name === "string" ? json.name : "";
        const bio = typeof json.bio === "string" ? json.bio : "";
        const blog = typeof json.blog === "string" ? json.blog : "";
        return { bioText: [name, bio, blog].filter(Boolean).join("\n") };
      }
    }

    if (platform === "substack") {
      // Try /about first, then home
      const about = await safeFetchText(`${url.replace(/\/+$/, "")}/about`);
      if (about) return { rawHtml: about };
      const home = await safeFetchText(url);
      return { rawHtml: home ?? "" };
    }

    // Generic HTML fallback for other platforms
    const html = await safeFetchText(url);
    return { rawHtml: html ?? "" };
  } catch {
    return { bioText: "", rawHtml: "" };
  }
}

async function safeFetchText(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const text = await res.text();
    // normalize superfluous whitespace
    return text.replace(/\s+/g, " ");
  } catch {
    return;
  }
}

/** Build a tiny patch object assigning the profile URL to whichever field your schema uses. */
function urlFieldPatch(url?: string | null): Record<string, any> {
  if (!url) return {};
  return {
    // one of these will exist on your schema; casts keep TS happy
    profileUrl: url,
    url,
    profile: url,
  } as any;
}
