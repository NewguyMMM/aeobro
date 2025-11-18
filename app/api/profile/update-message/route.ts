// app/api/profile/update-message/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { updateMessage } = (await req.json()) as {
      updateMessage?: string | null;
    };

    if (typeof updateMessage !== "string" && updateMessage !== null) {
      return NextResponse.json(
        { ok: false, message: "Invalid payload" },
        { status: 400 }
      );
    }

    const email = session.user.email;

    // Find user & profile
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, profile: { select: { id: true } } },
    });

    if (!user || !user.profile) {
      // We assume a profile exists by the time they see the editor
      return NextResponse.json(
        { ok: false, message: "Profile not found for this user." },
        { status: 404 }
      );
    }

    const normalized =
      typeof updateMessage === "string"
        ? updateMessage.trim() || null
        : null;

    await prisma.profile.update({
      where: { id: user.profile.id },
      data: { updateMessage: normalized },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("update-message error:", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
