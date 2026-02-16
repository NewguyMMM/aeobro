// components/stripe/ManageBillingButton.tsx
"use client";

import * as React from "react";

type Props = {
  label?: string;
  className?: string;
};

export default function ManageBillingButton({
  label = "Manage billing / change plan",
  className = "",
}: Props) {
  const [loading, setLoading] = React.useState(false);

  async function handleClick() {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Read body safely (JSON if possible, otherwise text)
      const contentType = res.headers.get("content-type") || "";
      let payload: any = null;
      let rawText: string | null = null;

      if (contentType.includes("application/json")) {
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
      } else {
        try {
          rawText = await res.text();
        } catch {
          rawText = null;
        }
      }

      if (!res.ok) {
        const msg =
          payload?.message ||
          payload?.stripeMessage ||
          rawText ||
          `HTTP ${res.status} (portal session failed)`;

        console.error("[BillingPortal] create-portal-session failed", {
          status: res.status,
          payload,
          rawText,
        });

        alert(msg);
        return;
      }

      const url = payload?.url;
      if (url) {
        window.location.href = url;
        return;
      }

      console.error("[BillingPortal] No portal URL returned", { payload });
      alert(payload?.message || "No portal URL returned from server.");
    } catch (err: any) {
      console.error("[BillingPortal] exception", err);
      alert(err?.message || "Something went wrong opening the billing portal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={[
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold",
        "bg-black text-white hover:bg-neutral-900 disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {loading ? "Opening…" : label}
    </button>
  );
}
