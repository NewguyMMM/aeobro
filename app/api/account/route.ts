// app/api/account/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next"; // ✅ App Router correct import
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// UI-level plan labels used throughout the frontend
type UiPlan = "Lite" | "Plus" | "Pro" | "Business";

// Map DB enum (e.g. FREE, LITE, PLUS, PRO, BUSINESS) → UI label
function mapDbPlanToUi(plan: string | null | undefined): UiPlan {
  switch ((plan ?? "").toUpperCase()) {
    case "PLUS":
      return "Plus";
    case "PRO":
      return "Pro";
    case "BUSINESS":
      return "Business";
    // Treat FREE, LITE, null, or anything unknown as Lite
    case "FREE":
    case "LITE":
    default:
      return "Lite";
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);

  // ✅ Not signed in → 401 (do NOT claim any plan)
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Look up the user's plan + status from the User table by email
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      plan: true,
      planStatus: true, // ✅ include status if present in your schema
    },
  });

  const plan = mapDbPlanToUi(user?.plan ?? null);

  return NextResponse.json(
    {
      ok: true,
      plan,
      planStatus: user?.planStatus ?? null,
    },
    { status: 200 }
  );
}
