"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function VerificationPage() {
  const { data } = useSession();
  const [domain, setDomain] = useState("");
  const [domainEmail, setDomainEmail] = useState("");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [platformUrl, setPlatformUrl] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [bioId, setBioId] = useState<string | null>(null);
  const [bioCode, setBioCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function startDomain() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/verify/domain/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, domainEmail: domainEmail || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Error"); setBusy(false); return; }
    setClaimId(data.id);
    setMsg(`Add this TXT record: ${data.txtToken} to either ${domain} OR _aeobro.${domain}`);
    setBusy(false);
  }

  async function checkDomain() {
    if (!claimId) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/verify/domain/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId }),
    });
    const data = await res.json();
    setMsg(`DNS: ${data.dnsVerified ? "OK" : "Not found"} · Status: ${data.status}${data.emailQueued ? " · Email sent" : ""}`);
    setBusy(false);
  }

  async function startBio() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/verify/bio/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, profileUrl: platformUrl }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Error"); setBusy(false); return; }
    setBioId(data.id); setBioCode(data.code);
    setMsg(`Place this in your ${platform} bio: ${data.code}`);
    setBusy(false);
  }

  async function checkBio() {
    if (!bioId) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/verify/bio/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bioId }),
    });
    const data = await res.json();
    setMsg(`Bio check: ${data.verified ? "VERIFIED" : "Pending"}`);
    setBusy(false);
  }

  async function linkGoogle() {
    // Normal NextAuth OAuth sign-in; after success, call our link endpoint with profile ids
    await signIn("google", { callbackUrl: "/dashboard/verification?provider=google" });
  }

  return (
    <main className="container max-w-3xl py-10">
      <h1 className="text-3xl font-bold mb-6">Verification</h1>

      {/* DOMAIN */}
      <section className="mb-10 p-5 border rounded-xl">
        <h2 className="text-xl font-semibold mb-2">Domain Verification (Pro)</h2>
        <p className="text-sm text-gray-600 mb-4">Prove you own a domain via DNS TXT + domain email.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="border rounded px-3 py-2" placeholder="yourbusiness.com" value={domain} onChange={e=>setDomain(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="owner@yourbusiness.com (optional)" value={domainEmail} onChange={e=>setDomainEmail(e.target.value)} />
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={startDomain} disabled={busy} className="px-4 py-2 rounded bg-black text-white">Get TXT</button>
          <button onClick={checkDomain} disabled={!claimId || busy} className="px-4 py-2 rounded border">Check</button>
        </div>
      </section>

      {/* PLATFORM OAUTH (Google starter) */}
      <section className="mb-10 p-5 border rounded-xl">
        <h2 className="text-xl font-semibold mb-2">Platform Verification (Lite)</h2>
        <p className="text-sm text-gray-600 mb-4">Link a platform account. Google is supported now (YouTube coming next).</p>
        <button onClick={linkGoogle} className="px-4 py-2 rounded bg-black text-white">Link Google</button>
        <p className="text-xs text-gray-500 mt-2">After linking, we’ll store your platform identity for verification.</p>
      </section>

      {/* CODE IN BIO */}
      <section className="mb-10 p-5 border rounded-xl">
        <h2 className="text-xl font-semibold mb-2">Code-in-Bio (Lite)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="border rounded px-3 py-2" value={platform} onChange={e=>setPlatform(e.target.value)}>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="substack">Substack</option>
            <option value="etsy">Etsy</option>
            <option value="youtube">YouTube</option>
          </select>
          <input className="border rounded px-3 py-2" placeholder="https://example.com/your-profile" value={platformUrl} onChange={e=>setPlatformUrl(e.target.value)} />
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={startBio} disabled={busy} className="px-4 py-2 rounded bg-black text-white">Generate Code</button>
          <button onClick={checkBio} disabled={!bioId || busy} className="px-4 py-2 rounded border">Check Bio</button>
        </div>
        {bioCode && (
          <div className="mt-3 text-sm">
            Place this exact text in your bio: <code className="px-1 py-0.5 bg-gray-100 rounded">{bioCode}</code>
          </div>
        )}
      </section>

      {msg && <p className="p-3 rounded bg-amber-50 text-amber-900 text-sm">{msg}</p>}
    </main>
  );
}
