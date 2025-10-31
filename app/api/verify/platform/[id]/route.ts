// app/api/verify/platform/[id]/route.ts
// ✅ Updated: 2025-10-31 07:24 ET
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Deletes (or soft-disconnects) a PlatformAccount owned by the current user.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // Ensure the account belongs to this user
    const account = await prisma.platformAccount.findUnique({
      where: { id },
      select: { id: true, userId: true, profileId: true, provider: true, externalId: true },
    });
    if (!account || account.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Hard delete (or change to a soft update if you prefer)
    await prisma.platformAccount.delete({ where: { id } });

    // Optional: downgrade profile if no verified accounts remain (commented)
    // const remaining = await prisma.platformAccount.count({
    //   where: { profileId: account.profileId, status: "VERIFIED" },
    // });
    // if (remaining === 0 && account.profileId) {
    //   await prisma.profile.update({
    //     where: { id: account.profileId },
    //     data: { verificationStatus: "UNVERIFIED" },
    //   });
    // }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/verify/platform/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
