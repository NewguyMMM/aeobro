// app/api/account/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// UI-level plan labels used throughout the frontend
type UiPlan = "Lite" | "Plus" | "Pro" | "Business";

// Map DB enum (e.g. FREE, LITE, PLUS, PRO, BUSINESS) → UI label
function mapDbPlanToUi(plan: string | null | undefined): UiPlan {
  switch (plan) {
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

  // Not signed in → treat as Lite (or you could return 401 if you prefer)
  if (!session?.user?.email) {
    const plan: UiPlan = "Lite";
    return NextResponse.json({ plan }, { status: 200 });
  }

  // Look up the user's plan from the User table by email
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { plan: true },
  });

  const plan = mapDbPlanToUi(user?.plan ?? null);

  return NextResponse.json({ plan }, { status: 200 });
}
