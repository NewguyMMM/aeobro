import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PLANS, requirePlan, getCap, hasFeature } from "@/lib/plan";

// Paywall switches
// - "off": no gating
// - "soft": gating only when plan is below minimum BUT allow dev/test to proceed
// - "hard": strict gating
const PAYWALL_MODE = process.env.PAYWALL_MODE ?? "soft";

// Comma-separated allowlist of emails (case-insensitive)
const BETA_ALLOWLIST: string[] = (process.env.BETA_ALLOWLIST || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function getCurrentUserWithPlan() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,            // string | null in schema
      plan: true,
      planStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true, // optional but often handy
    },
  });
}

export async function enforcePlan(minPlan: keyof typeof PLANS) {
  const user = await getCurrentUserWithPlan();
  if (!user) {
    throw Object.assign(new Error("UNAUTHORIZED"), { code: 401 as const });
  }

  // Global bypasses
  if (PAYWALL_MODE === "off") return user;

  // Null-safe allowlist check
  const emailLower = (user.email ?? "").toLowerCase();
  if (emailLower && BETA_ALLOWLIST.includes(emailLower)) return user;

  if (PAYWALL_MODE === "soft") return user;

  // Hard gating
  if (!requirePlan(user.plan, minPlan)) {
    throw Object.assign(new Error("PAYWALL_REQUIRED"), {
      code: 402 as const,
      minPlan,
      userPlan: user.plan,
    });
  }

  return user;
}

export { PLANS, getCap, hasFeature };
