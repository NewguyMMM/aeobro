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
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { plan: true, planStatus: true },
  });

  // ✅ Session exists but user row missing (rare edge case) → treat as unauthorized
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND" },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      plan: mapDbPlanToUi(user.plan),
      planStatus: user.planStatus ?? null,
    },
    { status: 200 }
  );
}
