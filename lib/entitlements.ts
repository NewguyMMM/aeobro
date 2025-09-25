import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PLANS, requirePlan, getCap, hasFeature } from "@/lib/plan";

const PAYWALL_MODE = process.env.PAYWALL_MODE ?? "soft"; // off | soft | hard
const BETA_ALLOWLIST = (process.env.BETA_ALLOWLIST ?? "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export async function getCurrentUserWithPlan() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, plan: true, planStatus: true, currentPeriodEnd: true },
  });
}

export async function enforcePlan(minPlan: keyof typeof PLANS) {
  const user = await getCurrentUserWithPlan();
  if (!user) throw Object.assign(new Error("UNAUTHORIZED"), { code: 401 });

  if (PAYWALL_MODE === "off") return user;
  if (BETA_ALLOWLIST.includes(user.email.toLowerCase())) return user;
  if (PAYWALL_MODE === "soft") return user;

  if (!requirePlan(user.plan, minPlan)) {
    throw Object.assign(new Error("PAYWALL_REQUIRED"), { code: 402, minPlan, userPlan: user.plan });
  }
  return user;
}

export { PLANS, getCap, hasFeature };
