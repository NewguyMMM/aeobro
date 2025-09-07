// components/CancelSubscriptionButton.tsx
"use client";

import { useState } from "react";

export default function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");

      if (data.current_period_end) {
        const when = new Date(data.current_period_end * 1000).toLocaleString();
        setMessage(
          `Cancellation scheduled. You will retain access until ${when}.`
        );
      } else {
        setMessage("Cancellation scheduled at period end.");
      }
    } catch (e: any) {
      setErr(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div>
        <div className="font-semibold">Cancel Subscription</div>
        <div className="text-sm text-gray-600">
          Cancels your active plan at the end of the billing period.
        </div>
      </div>

      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Cancel Subscription"}
      </button>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
