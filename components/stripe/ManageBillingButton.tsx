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
      });

      if (!res.ok) {
        console.error("Failed to create portal session", await res.text());
        alert("Sorry—unable to open billing portal right now.");
        return;
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert("No portal URL returned from server.");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong opening the billing portal.");
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
