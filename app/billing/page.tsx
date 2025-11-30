// app/billing/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ManageBillingButton from "@/components/stripe/ManageBillingButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manage subscription | AEOBRO",
};

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Manage your subscription
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Use the secure Stripe Billing Portal to change plans (upgrade or
          downgrade), update your payment method, or cancel your subscription.
        </p>
      </header>

      <ManageBillingButton />

      <p className="text-xs text-neutral-500">
        AEOBRO never sees your full card number. All billing details are handled
        by Stripe.
      </p>
    </main>
  );
}
