// components/VerificationCard.tsx
// AEOBRO — Domain + Platform Verification Card (DNS • Code-in-Bio • OAuth Connect)
// ✅ Updated: 2025-11-02 09:06 ET — Removed legacy "Use code-in-bio (legacy)" flow; kept DNS, OAuth, and new Code-in-Bio rows.

"use client";

import * as React from "react";
import Link from "next/link";

type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "PLATFORM_VERIFIED"
  | "DOMAIN_VERIFIED";

type StartDnsResponse = {
  recordHost?: string;
  recordType?: "TXT";
  recordValue?: string;
  token?: string;
  status?: VerificationStatus;
  error?: string;
};

type CheckDnsResponse = {
  verified?: boolean;
  status?: VerificationStatus;
  token?: string;
  profile?: { verificationStatus?: VerificationStatus };
  message?: string;
  error?: string;
};

type PlatformAccount = {
  id: string;
  provider: string; // "google" | "facebook" | "twitter" | "tiktok" | ...
  externalId: string;
  handle?: string | null;
  url?: string | null;
  status: "PENDING" | "VERIFIED" | "FAILED";
  platformContext?: string | null;
  verifiedAt?: string | null;
};

type ListAccountsResponse = {
  accounts?: PlatformAccount[];
  error?: string;
};

type Props = {
  /** Optional now (so callers that don't have it yet won't break builds) */
  profileId?: string;

  initialDomain?: string | null;
  initialStatus?: VerificationStatus | null;
  onStatusChange?: (status: VerificationStatus) => void;
  className?: string;
  /** Optional: return path after OAuth completes (defaults to /dashboard?verified=1) */
  returnTo?: string;
};

export default function VerificationCard({
  profileId,
  initialDomain = "",
  initialStatus = "UNVERIFIED",
  onStatusChange,
  className,
  returnTo = "/dashboard?verified=1",
}: Props) {
  const [mode, setMode] = React.useState<"dns" | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string>("");

  const [domainInput, setDomainInput] = React.useState<string>(initialDomain || "");
  const [normalizedDomain, setNormalizedDomain] = React.useState<string>("");

  const [status, setStatus] = React.useState<VerificationStatus>(
    (initialStatus || "UNVERIFIED").toUpperCase() as VerificationStatus
  );

  // DNS state
  const [dnsToken, setDnsToken] = React.useState<string>("");
  const [dnsRecordHost, setDnsRecordHost] = React.useState<string>("");
  const [dnsRecordType, setDnsRecordType] = React.useState<"TXT">("TXT");
  const [dnsRecordValue, setDnsRecordValue] = React.useState<string>("");

  // OAuth-linked accounts state
  const [accounts, setAccounts] = React.useState<PlatformAccount[] | null>(null);
  const [accountsMsg, setAccountsMsg] = React.useState<string>("");

  React.useEffect(() => {
    if (domainInput?.trim()) {
      setNormalizedDomain(normalizeDomain(domainInput));
    } else {
      setNormalizedDomain("");
    }
  }, [domainInput]);

  React.useEffect(() => {
    refreshAccounts().catch(() => {
      /* ignore */
    });
  }, []);

  function normalizeDomain(input: string): string {
    const raw = (input || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
      return url.hostname.replace(/^www\./i, "");
    } catch {
      return raw
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .split("/")[0]
        .trim();
    }
  }

  function preferredHost(domain: string) {
    return domain ? `_aeobro-verify.${domain}` : `_aeobro-verify.<yourdomain>`;
  }

  function preferredValue(token?: string) {
    return token ? `aeobro-site-verify=${token}` : "aeobro-site-verify=<token>";
  }

  function copy(text: string, label = "Copied!") {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setMessage(label);
      setTimeout(() => setMessage(""), 1200);
    });
  }

  function updateStatus(newStatus?: VerificationStatus) {
    if (!newStatus) return;
    const s = (newStatus || "UNVERIFIED").toUpperCase() as VerificationStatus;
    setStatus(s);
    onStatusChange?.(s);
  }

  function callbackUrl() {
    return encodeURIComponent(returnTo || "/dashboard?verified=1");
  }

  /** ------ DNS Flow ------ */
  async function handleDnsGenerate() {
    setMessage("");
    if (!profileId) {
      setMessage("Profile not loaded yet. Save your profile to get a profileId.");
      return;
    }
    if (!normalizedDomain) {
      setMessage("Enter a domain before generating a TXT record.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/verify/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          domain: normalizedDomain,
          init: true,
        }),
      });
      const j: StartDnsResponse = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to generate DNS record");

      if (j?.token) {
        setDnsToken(j.token);
        setDnsRecordHost(preferredHost(normalizedDomain));
        setDnsRecordType("TXT");
        setDnsRecordValue(preferredValue(j.token));
        updateStatus(j?.status || "PENDING");
        setMode("dns");
        setMessage("TXT record generated. Publish it at your DNS, then click “Check record now”.");
        return;
      }

      if (j?.recordHost || j?.recordValue) {
        setDnsRecordHost(j.recordHost || preferredHost(normalizedDomain));
        setDnsRecordType("TXT");
        setDnsRecordValue(j.recordValue || preferredValue());
        updateStatus(j?.status || "PENDING");
        setMode("dns");
        setMessage("TXT record generated (legacy). Publish it, then click “Check record now”.");
        return;
      }

      throw new Error("No token/record returned by server.");
    } catch (e: any) {
      setMessage(e?.message || "Error starting DNS verification");
    } finally {
      setLoading(false);
    }
  }

  async function handleDnsCheck() {
    setMessage("");
    if (!profileId) {
      setMessage("Profile not loaded yet. Save your profile to get a profileId.");
      return;
    }
    if (!normalizedDomain) {
      setMessage("Enter a domain before checking.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/verify/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          domain: normalizedDomain,
        }),
      });
      const j: CheckDnsResponse = await r.json();
      if (!r.ok) throw new Error(j?.error || "Verification check failed");

      if (j?.token && !dnsToken) {
        setDnsToken(j.token);
        setDnsRecordHost(preferredHost(normalizedDomain));
        setDnsRecordType("TXT");
        setDnsRecordValue(preferredValue(j.token));
      }

      const newStatus =
        (j?.status as VerificationStatus) ||
        (j?.profile?.verificationStatus as VerificationStatus) ||
        (j?.verified ? "DOMAIN_VERIFIED" : undefined);

      if (newStatus) {
        updateStatus(newStatus);
        if (newStatus === "DOMAIN_VERIFIED") {
          setMessage("Domain verified! Your profile is now DOMAIN_VERIFIED.");
        } else if (newStatus === "PENDING") {
          setMessage(
            "Not verified yet. DNS can take time to propagate. Double-check host & value, then try again later."
          );
        } else {
          setMessage(`Status: ${newStatus}`);
        }
      } else {
        setMessage(j?.message || "Checked.");
      }
    } catch (e: any) {
      setMessage(e?.message || "Error during DNS check");
    } finally {
      setLoading(false);
    }
  }

  /** ------ OAuth Connect buttons ------ */
  function startOAuth(provider: string) {
    const url = `/api/auth/signin/${provider}?callbackUrl=${callbackUrl()}`;
    window.location.href = url;
  }

  /** ------ Linked Accounts (via API) ------ */
  async function refreshAccounts() {
    try {
      const r = await fetch("/api/verify/platform/list", { method: "GET" });
      if (!r.ok) {
        setAccounts(null);
        return;
      }
      const j: ListAccountsResponse = await r.json();
      setAccounts(j?.accounts || []);
      setAccountsMsg("");
    } catch (e: any) {
      setAccounts(null);
      setAccountsMsg("Could not load linked accounts.");
    }
  }

  async function disconnectAccount(id: string) {
    if (!id) return;
    setAccountsMsg("");
    try {
      const r = await fetch(`/api/verify/platform/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const text = await r.text();
        setAccountsMsg(text || "Failed to disconnect.");
      } else {
        setAccountsMsg("Disconnected.");
        refreshAccounts();
      }
    } catch (e: any) {
      setAccountsMsg(e?.message || "Error disconnecting.");
    }
  }

  const profileMissing = !profileId;

  return (
    <div className={`w-full max-w-2xl rounded-2xl border bg-white p-5 shadow-sm ${className || ""}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Verify</div>
          <p className="text-sm text-neutral-600">
            Prefer DNS TXT verification. You can also connect a platform via OAuth, or use our Code-in-Bio verifier.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {profileMissing && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Save your profile to obtain a <span className="font-semibold">profileId</span>. Verification actions are
          disabled until then.
        </div>
      )}

      {/* === Code-in-Bio (Generate & Check) === */}
      <section className="mt-2 rounded-xl border bg-neutral-50 p-4">
        <div className="mb-2 text-sm font-medium">Verify with Code-in-Bio</div>
        <p className="mb-3 text-xs text-neutral-600">
          Paste your profile URL, generate a short code, add it to your bio/about, then click <em>Check Now</em>.
        </p>

        <div className="grid gap-3">
          {PLATFORMS.map((p) => (
            <PlatformBioRow
              key={p.key}
              platform={p.key}
              label={p.label}
              placeholder={p.placeholder}
              disabled={loading || profileMissing}
              onVerified={() => updateStatus("PLATFORM_VERIFIED")}
            />
          ))}
        </div>
      </section>

      {/* OAuth Connect — quick path to Platform Verified */}
      <section className="mt-4 rounded-xl border bg-neutral-50 p-4">
        <div className="mb-2 text-sm font-medium">Connect a platform (OAuth)</div>
        <p className="mb-3 text-xs text-neutral-600">
          We’ll fetch your canonical identity (e.g., YouTube Channel ID, Twitter/X User ID) and mark your profile{" "}
          <span className="font-medium">PLATFORM_VERIFIED</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startOAuth("google")}
            disabled={loading || profileMissing}
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
            title="Google / YouTube"
          >
            Connect Google · YouTube
          </button>
          <button
            type="button"
            onClick={() => startOAuth("facebook")}
            disabled={loading || profileMissing}
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
            title="Facebook (and Facebook Pages/IG Business via Graph later)"
          >
            Connect Facebook
          </button>
          <button
            type="button"
            onClick={() => startOAuth("twitter")}
            disabled={loading || profileMissing}
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
            title="X (Twitter)"
          >
            Connect X (Twitter)
          </button>
        </div>

        {/* Linked accounts list (if API route exists) */}
        <div className="mt-4">
          <div className="text-xs font-medium text-neutral-700">Linked accounts</div>
          {accounts === null ? (
            <p className="mt-1 text-xs text-neutral-500">
              (Linked accounts will appear here once available.)
            </p>
          ) : accounts?.length ? (
            <ul className="mt-2 divide-y rounded-xl border bg-white">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded border px-2 py-0.5 text-xs uppercase text-neutral-700">
                        {a.provider}
                      </span>
                      {a.status === "VERIFIED" ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Verified</span>
                      ) : a.status === "PENDING" ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Pending</span>
                      ) : (
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800">Failed</span>
                      )}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-neutral-700">
                      {a.externalId}
                    </div>
                    {a.handle && (
                      <div className="truncate text-xs text-neutral-600">{a.handle}</div>
                    )}
                    {a.url ? (
                      <Link
                        href={a.url}
                        target="_blank"
                        className="truncate text-xs text-blue-700 underline"
                      >
                        {a.url}
                      </Link>
                    ) : null}
                  </div>
                  <div className="shrink-0">
                    <button
                      onClick={() => disconnectAccount(a.id)}
                      className="rounded-lg border px-3 py-1 text-xs hover:bg-neutral-50"
                      type="button"
                    >
                      Disconnect
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-neutral-500">No accounts linked yet.</p>
          )}
          {!!accountsMsg && <p className="mt-2 text-xs text-neutral-700">{accountsMsg}</p>}
        </div>
      </section>

      {/* Domain input (used for DNS flow) */}
      <div className="mt-5">
        <label htmlFor="domain" className="text-sm font-medium">Your domain</label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="domain"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="example.com or https://www.example.com/path"
            className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm"
            onClick={() => copy(normalizedDomain || "", "Domain copied")}
          >
            Copy domain
          </button>
        </div>
        {!!normalizedDomain && (
          <p className="mt-1 text-xs text-neutral-500">
            Normalized: <span className="font-mono">{normalizedDomain}</span>
          </p>
        )}
      </div>

      {/* Mode selector for DNS actions */}
      {!mode && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleDnsGenerate}
            disabled={loading || profileMissing}
            className="rounded-xl bg-[#2563EB] px-4 py-2 text-white disabled:opacity-50"
            type="button"
          >
            {loading ? "Working…" : "Generate DNS record"}
          </button>
        </div>
      )}

      {/* DNS instructions */}
      {mode === "dns" && (
        <div className="mt-5 rounded-xl border bg-neutral-50 p-4">
          <p className="mb-2 text-sm font-medium">Create this DNS TXT record, then click “Check record now”:</p>

          <div className="grid grid-cols-1 items-center gap-3 text-sm md:grid-cols-12">
            <div className="text-xs uppercase tracking-wide text-neutral-500 md:col-span-2">Host</div>
            <div className="font-mono break-all md:col-span-9">
              {dnsRecordHost || preferredHost(normalizedDomain)}
            </div>
            <div className="md:col-span-1">
              <button
                type="button"
                onClick={() => copy(dnsRecordHost || preferredHost(normalizedDomain))}
                className="text-sm underline"
              >
                Copy
              </button>
            </div>

            <div className="text-xs uppercase tracking-wide text-neutral-500 md:col-span-2">Type</div>
            <div className="font-mono md:col-span-9">{dnsRecordType}</div>
            <div className="md:col-span-1">
              <button type="button" onClick={() => copy("TXT")} className="text-sm underline">
                Copy
              </button>
            </div>

            <div className="text-xs uppercase tracking-wide text-neutral-500 md:col-span-2">Value</div>
            <div className="font-mono break-all md:col-span-9">
              {dnsRecordValue || preferredValue(dnsToken)}
            </div>
            <div className="md:col-span-1">
              <button
                type="button"
                onClick={() => copy(dnsRecordValue || preferredValue(dnsToken))}
                className="text-sm underline"
              >
                Copy
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-neutral-600">
            DNS propagation can take time (often minutes, sometimes longer). When ready, click{" "}
            <span className="font-medium">“Check record now”</span>.
          </p>

          <button
            onClick={handleDnsCheck}
            disabled={loading || profileMissing}
            className="mt-3 rounded-xl border px-4 py-2 disabled:opacity-50"
            type="button"
          >
            {loading ? "Checking…" : "Check record now"}
          </button>
        </div>
      )}

      {!!message && <div className="mt-4 text-sm text-neutral-700">{message}</div>}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-neutral-700">Why DNS TXT verification?</summary>
        <p className="mt-2 text-sm text-neutral-600">
          We look up <span className="font-mono">{preferredHost(normalizedDomain)}</span> for a TXT record that equals{" "}
          <span className="font-mono">aeobro-site-verify=&lt;token&gt;</span>. If it matches, your domain is marked{" "}
          <span className="font-medium">DOMAIN_VERIFIED</span>.
        </p>
      </details>
    </div>
  );
}

/* ---------- Small embedded component for Code-in-Bio rows ---------- */

type PlatformKey =
  | "instagram"
  | "x"
  | "tiktok"
  | "substack"
  | "youtube"
  | "facebook"
  | "linkedin"
  | "github"
  | "etsy";

const PLATFORMS: Array<{ key: PlatformKey; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/your_handle/" },
  { key: "x",         label: "X (Twitter)", placeholder: "https://x.com/your_handle" },
  { key: "tiktok",    label: "TikTok", placeholder: "https://www.tiktok.com/@your_handle" },
  { key: "substack",  label: "Substack", placeholder: "https://yourname.substack.com/" },
  { key: "youtube",   label: "YouTube", placeholder: "https://www.youtube.com/@your_handle" },
  { key: "facebook",  label: "Facebook", placeholder: "https://www.facebook.com/your.profile" },
  { key: "linkedin",  label: "LinkedIn", placeholder: "https://www.linkedin.com/in/your-handle/" },
  { key: "github",    label: "GitHub", placeholder: "https://github.com/yourname" },
  { key: "etsy",      label: "Etsy", placeholder: "https://www.etsy.com/shop/yourshop" },
];

function PlatformBioRow({
  platform,
  label,
  placeholder,
  disabled,
  onVerified,
}: {
  platform: PlatformKey;
  label: string;
  placeholder: string;
  disabled?: boolean;
  onVerified?: () => void;
}) {
  const [profileUrl, setProfileUrl] = React.useState<string>("");
  const [code, setCode] = React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<string>("");
  const [busy, setBusy] = React.useState<false | "gen" | "check">(false);
  const [msg, setMsg] = React.useState<string>("");
  const [ok, setOk] = React.useState<boolean>(false);

  async function onGenerate() {
    try {
      setBusy("gen"); setMsg("");
      const r = await fetch("/api/verify/bio-code/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, profileUrl }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok !== true) throw new Error(j?.error || "Failed to generate code");
      setCode(j.code);
      setExpiresAt(j.expiresAt);
      setMsg("Code generated. Paste it into your bio, then click Check Now.");
    } catch (e: any) {
      setMsg(e?.message || "Error generating code");
    } finally {
      setBusy(false);
    }
  }

  async function onCheck() {
    try {
      setBusy("check"); setMsg("");
      const r = await fetch("/api/verify/bio-code/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, profileUrl }),
      });
      const j = await r.json();
      if (!r.ok || j?.verified !== true) {
        setOk(false);
        setMsg(j?.message || j?.error || "Verification not found yet.");
        return;
      }
      setOk(true);
      setMsg("Verified! This account is now platform-verified via Code-in-Bio.");
      onVerified?.();
    } catch (e: any) {
      setOk(false);
      setMsg(e?.message || "Error checking code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        {ok && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Verified</span>}
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-[1fr,auto,auto]">
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder={placeholder}
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          disabled={!!busy || disabled}
        />
        <button
          onClick={onGenerate}
          disabled={!profileUrl || !!busy || disabled}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy === "gen" ? "Generating…" : "Generate Code"}
        </button>
        <button
          onClick={onCheck}
          disabled={!profileUrl || !!busy || disabled}
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy === "check" ? "Checking…" : "Check Now"}
        </button>
      </div>

      {code && (
        <div className="mt-2 rounded-lg bg-neutral-50 p-2 text-xs">
          <div className="font-medium">Your code:</div>
          <code className="block break-all">{code}</code>
          {expiresAt && (
            <div className="mt-1 text-[11px] text-neutral-600">
              Expires: {new Date(expiresAt).toLocaleString()}
            </div>
          )}
          <ul className="mt-1 list-disc pl-5 text-[11px] text-neutral-700 space-y-0.5">
            <li>Copy the code exactly as shown.</li>
            <li>Edit your {label} profile and paste it into the bio/about section.</li>
            <li>Make sure your profile is public, then click <strong>Check Now</strong>.</li>
          </ul>
        </div>
      )}

      {!!msg && (
        <div className={`mt-2 text-xs ${ok ? "text-emerald-700" : "text-neutral-700"}`}>
          {msg}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: VerificationStatus | null }) {
  const s = (status || "UNVERIFIED").toUpperCase() as VerificationStatus;
  const styles: Record<VerificationStatus, string> = {
    UNVERIFIED: "bg-gray-100 text-gray-700",
    PENDING: "bg-amber-100 text-amber-800",
    PLATFORM_VERIFIED: "bg-indigo-100 text-indigo-800",
    DOMAIN_VERIFIED: "bg-emerald-100 text-emerald-800",
  };
  const labels: Record<VerificationStatus, string> = {
    UNVERIFIED: "Unverified",
    PENDING: "Pending",
    PLATFORM_VERIFIED: "Platform-verified",
    DOMAIN_VERIFIED: "Domain-verified",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${styles[s]}`}>
      {labels[s]}
    </span>
  );
}
