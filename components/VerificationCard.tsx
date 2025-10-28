// components/VerificationCard.tsx
"use client";

import * as React from "react";

type StartDnsResponse = {
  recordHost: string;
  recordType: "TXT";
  recordValue: string;
};

type StartPlatformResponse = {
  marker: string;
};

export default function VerificationCard() {
  const [mode, setMode] = React.useState<"dns" | "platform" | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any>(null);
  const [message, setMessage] = React.useState<string>("");

  async function startDns() {
    try {
      setLoading(true);
      setMessage("");
      const domain = prompt("Enter your domain (example.com):");
      if (!domain) return;
      const r = await fetch("/api/verify/dns/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const j: StartDnsResponse = await r.json();
      if (!r.ok) throw new Error((j as any)?.error || "Failed to start DNS verification");
      setData(j);
      setMode("dns");
    } catch (e: any) {
      setMessage(e.message || "Error starting DNS verification");
    } finally {
      setLoading(false);
    }
  }

  async function checkDns() {
    try {
      setLoading(true);
      setMessage("");
      const r = await fetch("/api/verify/dns/check", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "DNS check failed");
      setMessage(j?.profile?.verificationStatus || j?.message || "Checked");
    } catch (e: any) {
      setMessage(e.message || "Error during DNS check");
    } finally {
      setLoading(false);
    }
  }

  async function startPlatform() {
    try {
      setLoading(true);
      setMessage("");
      const r = await fetch("/api/verify/platform/start", { method: "POST" });
      const j: StartPlatformResponse = await r.json();
      if (!r.ok) throw new Error((j as any)?.error || "Failed to start platform verification");
      setData(j);
      setMode("platform");
    } catch (e: any) {
      setMessage(e.message || "Error starting platform verification");
    } finally {
      setLoading(false);
    }
  }

  async function checkPlatform() {
    try {
      setLoading(true);
      setMessage("");
      const r = await fetch("/api/verify/platform/check", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Platform check failed");
      setMessage(j?.profile?.verificationStatus || j?.message || "Checked");
    } catch (e: any) {
      setMessage(e.message || "Error during platform check");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold">Verify</div>

      {!mode && (
        <div className="flex gap-2">
          <button
            onClick={startDns}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-white disabled:opacity-50"
            disabled={loading}
          >
            Verify domain
          </button>
          <button
            onClick={startPlatform}
            className="rounded-lg border px-3 py-2 disabled:opacity-50"
            disabled={loading}
          >
            Use code-in-bio
          </button>
        </div>
      )}

      {mode === "dns" && data && (
        <div className="mt-3 text-sm">
          <div className="mb-2">Create this DNS TXT record, then click “Check”:</div>
          <pre className="rounded bg-neutral-50 p-2 text-xs whitespace-pre-wrap">{`Host: ${data.recordHost}
Type: ${data.recordType}
Value: ${data.recordValue}`}</pre>
          <button
            onClick={checkDns}
            className="mt-2 rounded-lg border px-3 py-2 disabled:opacity-50"
            disabled={loading}
          >
            Check
          </button>
        </div>
      )}

      {mode === "platform" && data && (
        <div className="mt-3 text-sm">
          <div className="mb-2">Add this code to one connected platform bio, then click “Check”:</div>
          <pre className="rounded bg-neutral-50 p-2 text-xs whitespace-pre-wrap">{data.marker}</pre>
          <button
            onClick={checkPlatform}
            className="mt-2 rounded-lg border px-3 py-2 disabled:opacity-50"
            disabled={loading}
          >
            Check
          </button>
        </div>
      )}

      {!!message && <div className="mt-2 text-sm text-neutral-700">{message}</div>}
    </div>
  );
}
