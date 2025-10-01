// app/api/account/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Optional: import your DB here and look up the user's plan by userId/email.

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    // Not signed in; you can also return 401 if you prefer
    return NextResponse.json({ plan: null }, { status: 200 });
  }

  // TODO: replace this with a real lookup:
  // const plan = await db.accounts.findPlanByUser(session.user.id);
  const plan: "Lite" | "Pro" | "Business" | null = "Lite";

  return NextResponse.json({ plan }, { status: 200 });
}
