// app/settings/page.tsx
// 📅 Updated: 2025-11-30 13:08 ET – New Settings page (account, plan, billing, profile shortcuts)

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ManageBillingButton from "@/components/stripe/ManageBillingButton";

export const runtime = "nodejs";

export const metadata = {
  title: "Settings | AEOBRO",
  description:
    "Manage your AEOBRO account, subscription, and AI Ready profile settings.",
} as const;

// Keep this mapping consistent with ProfileEditor
function normalizePlanForUi(raw?: string | null): string {
  const v = (raw ?? "").toString().toUpperCase();
  switch (v) {
    case "PLUS":
      return "Plus";
    case "PRO":
      return "Pro";
    case "BUSINESS":
      return "Business";
    case "ENTERPRISE":
      return "Enterprise";
    case "LITE":
    case "FREE":
    default:
      return "Lite";
  }
}

function formatStatusLabel(status?: string | null, endsAt?: Date | null) {
  const v = (status ?? "").toUpperCase();

  if (v === "CANCELED" && endsAt) {
    return `Canceled · access until ${endsAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  if (v === "TRIALING") return "Trialing";
  if (v === "PAST_DUE") return "Past due";
  if (v === "INCOMPLETE" || v === "INCOMPLETE_EXPIRED")
    return "Payment incomplete";
  if (v === "UNPAID") return "Unpaid";
  if (v === "ACTIVE" || !v) return "Active";

  return v.charAt(0) + v.slice(1).toLowerCase();
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    // Force sign-in, then return here
    redirect("/api/auth/signin?callbackUrl=/settings");
  }

  // Pull the user's plan + status from DB
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      name: true,
      email: true,
      plan: true,
      planStatus: true,
      planEndsAt: true, // if your schema uses a different field, adjust this name
    },
  });

  const uiPlan = normalizePlanForUi(user?.plan);
  const statusLabel = formatStatusLabel(user?.planStatus, user?.planEndsAt ?? null);

  return (
    <section className="container py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Settings
        </h1>
        <p className="text-sm text-gray-600 max-w-xl">
          Manage your AEOBRO account, subscription, and AI Ready profile from one place.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account & plan */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Account &amp; plan</h2>
            <p className="mt-1 text-sm text-gray-600">
              See your current AEOBRO plan and subscription status.
            </p>
          </div>

          <div className="rounded-xl border bg-gray-50 px-4 py-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-700 font-medium">
                {uiPlan} plan
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 border border-gray-200">
                {statusLabel}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Signed in as{" "}
              <span className="font-medium">
                {user?.email ?? session.user.email}
              </span>
              {user?.name ? ` · ${user.name}` : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <ManageBillingButton />
          </div>

          <p className="text-xs text-gray-500 leading-snug">
            Use the billing portal to upgrade or downgrade your plan, update your
            payment method, or cancel. Your subscription remains active until the
            end of your current billing period.
          </p>
        </div>

        {/* Profile & verification shortcuts */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">AI Ready profile</h2>
            <p className="mt-1 text-sm text-gray-600">
              Edit your public profile, structured data, and verification settings.
            </p>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="rounded-xl border bg-gray-50 px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">
                  Edit AI Ready profile
                </span>
              </div>
              <p className="text-xs text-gray-600">
                Update your name, links, media, FAQs, and services. Changes are
                reflected in your JSON-LD export and public profile page.
              </p>
              <div className="mt-2">
                <a
                  href="/dashboard"
                  className="inline-flex items-center rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
                >
                  Open profile editor
                </a>
              </div>
            </div>

            <div className="rounded-xl border bg-gray-50 px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">
                  Verification
                </span>
              </div>
              <p className="text-xs text-gray-600">
                Connect a domain (business) or social account (creator) so AEOBRO
                can mark your profile as verified for AI assistants and search.
              </p>
              <div className="mt-2">
                <a
                  href="/dashboard#verify"
                  className="inline-flex items-center rounded-md border border-gray-800 px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-900 hover:text-white"
                >
                  Go to verification options
                </a>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 leading-snug">
            Verification is required before AEOBRO exports your structured data
            for consumption by AI systems. Draft profiles remain private until
            verified and published.
          </p>
        </div>
      </div>
    </section>
  );
}
