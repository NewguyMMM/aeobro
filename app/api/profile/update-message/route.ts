// app/api/profile/update-message/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPlusAllowed(planRaw: unknown): boolean {
  const plan = String(planRaw ?? "LITE").toUpperCase();
  const normalized = plan === "FREE" ? "LITE" : plan;

  // PRO remains hidden; behaves like PLUS for now
  return (
    normalized === "PLUS" ||
    normalized === "PRO" ||
    normalized === "BUSINESS" ||
    normalized === "ENTERPRISE"
  );
}

function isActiveStatus(statusRaw: unknown): boolean {
  // Fail-closed: missing => NOT active
  return String(statusRaw ?? "").toLowerCase() === "active";
}

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

    // Single query: user + plan fields + profile id
    const user = await (prisma.user as any).findUnique({
      where: { email },
      select: {
        id: true,
        plan: true,
        planStatus: true,
        profile: { select: { id: true } },
      },
    });

    if (!user || !user.profile) {
      return NextResponse.json(
        { ok: false, message: "Profile not found for this user." },
        { status: 404 }
      );
    }

    // ✅ Permission boundary (fail-closed)
    const active = isActiveStatus(user.planStatus);
    const plusAllowed = isPlusAllowed(user.plan);

    // planStatus !== "active" => treat as LITE everywhere (deny)
    if (!active || !plusAllowed) {
      return NextResponse.json(
        { ok: false, message: "This feature requires Plus (active subscription)." },
        { status: 403 }
      );
    }

    const normalized =
      typeof updateMessage === "string" ? updateMessage.trim() || null : null;

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
