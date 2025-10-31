// app/api/verify/platform/[id]/route.ts
// ✅ Updated: 2025-10-31 07:06 ET
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Deletes (or you can "soft fail") a PlatformAccount owned by the current user.
 * If you prefer soft disconnects, swap the delete for an update: { status: "FAILED" }.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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
    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Hard delete (or soft update to FAILED)
    await prisma.platformAccount.delete({ where: { id } });

    // Optional: if no verified accounts remain, you may downgrade the profile status.
    // Commented out by default; uncomment if desired.
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
