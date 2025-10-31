// app/api/verify/platform/list/route.ts
// ✅ Updated: 2025-10-31 07:06 ET
export const runtime = "nodejs"; // Prisma needs Node runtime
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns the current user's linked PlatformAccount[].
 * Optional query: ?profileId=<id> to filter for a specific profile.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const profileId = url.searchParams.get("profileId") || undefined;

    const accounts = await prisma.platformAccount.findMany({
      where: {
        userId: session.user.id,
        ...(profileId ? { profileId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        externalId: true,
        handle: true,
        url: true,
        status: true,
        platformContext: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ accounts }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/verify/platform/list error:", err);
    return NextResponse.json(
      { error: "Failed to load linked accounts" },
      { status: 500 }
    );
  }
}
