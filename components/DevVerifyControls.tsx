"use client";
import { useState } from "react";
type Level = "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED" | "UNVERIFIED";

export default function DevVerifyControls() {
  const [busy, setBusy] = useState<Level | null>(null);
  const [msg, setMsg] = useState("");

  async function setLevel(level: Level) {
    try {
      setBusy(level);
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
      setBusy(null);
    }
  }

  const Btn = ({ level, children }: { level: Level; children: React.ReactNode }) => (
    <button
      onClick={() => setLevel(level)}
      disabled={!!busy}
      className="px-3 py-2 rounded-lg bg-black text-white disabled:opacity-50"
    >
      {busy === level ? "Setting…" : children}
    </button>
  );

  return (
    <div className="mt-4 rounded-xl border p-3">
      <div className="text-sm font-medium mb-2">Verification (dev only)</div>
      <div className="flex gap-2 flex-wrap">
        <Btn level="PLATFORM_VERIFIED">Mark PLATFORM_VERIFIED</Btn>
        <Btn level="DOMAIN_VERIFIED">Mark DOMAIN_VERIFIED</Btn>
        <button
          onClick={() => setLevel("UNVERIFIED")}
          disabled={!!busy}
          className="px-3 py-2 rounded-lg border"
        >
          {busy === "UNVERIFIED" ? "Setting…" : "Revert to UNVERIFIED"}
        </button>
      </div>
      {msg ? <p className="text-xs mt-2 opacity-80">{msg}</p> : null}
    </div>
  );
}
