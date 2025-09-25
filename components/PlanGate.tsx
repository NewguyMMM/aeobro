import { PLANS } from "@/lib/plan";
import UpgradeInline from "@/components/UpgradeInline";

type Props = {
  ok: boolean;
  needed: keyof typeof PLANS;
  children: React.ReactNode;
};

export default function PlanGate({ ok, needed, children }: Props) {
  if (ok) return <>{children}</>;
  const priceId =
    needed === "PRO"
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!
      : needed === "BUSINESS"
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS!
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE!;
  return (
    <div className="rounded-xl border p-4 bg-muted/40">
      <div className="mb-2 font-semibold">This feature requires {PLANS[needed].label}.</div>
      <UpgradeInline priceId={priceId} label={`Upgrade to ${PLANS[needed].label}`} />
    </div>
  );
}
