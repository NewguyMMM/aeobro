// app/(app)/dashboard/page.tsx
"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm opacity-70">Owner-only controls for verification (dev).</p>
      </header>

      <DevVerifyControls />
    </main>
  );
}

/** Owner-only: flip verification status for your profile */
function DevVerifyControls() {
  const [busy, setBusy] = useState<false | "plat" | "dom" | "un">(false);
  const [msg, setMsg] = useState<string>("");

  async function setLevel(
    level: "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED" | "UNVERIFIED"
  ) {
    try {
      setBusy(level === "PLATFORM_VERIFIED" ? "plat" : level === "DOMAIN_VERIFIED" ? "dom" : "un");
      setMsg("");
      const res = await fetch("/api/profile/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setMsg(`Status updated to ${json.profile.verificationStatus}`);
    } catch (e: any) {
      setMsg(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border p-3">
      <div className="text-sm font-medium mb-2">Verification (dev only)</div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setLevel("PLATFORM_VERIFIED")}
          disabled={!!busy}
          className="px-3 py-2 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {busy === "plat" ? "Setting…" : "Mark PLATFORM_VERIFIED"}
        </button>
        <button
          onClick={() => setLevel("DOMAIN_VERIFIED")}
          disabled={!!busy}
          className="px-3 py-2 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {busy === "dom" ? "Setting…" : "Mark DOMAIN_VERIFIED"}
        </button>
        <button
          onClick={() => setLevel("UNVERIFIED")}
          disabled={!!busy}
          className="px-3 py-2 rounded-lg border"
        >
          {busy === "un" ? "Setting…" : "Revert to UNVERIFIED"}
        </button>
      </div>
      {msg ? <p className="text-xs mt-2 opacity-80">{msg}</p> : null}
    </div>
  );
}
