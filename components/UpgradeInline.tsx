"use client";
import { useState } from "react";

export default function UpgradeInline({ priceId, label }: { priceId: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    setLoading(false);
    if (data?.url) window.location.href = data.url;
    else alert("Unable to start checkout.");
  };
  return (
    <button className="btn" disabled={loading} onClick={onClick}>
      {loading ? "Redirecting…" : label}
    </button>
  );
}
