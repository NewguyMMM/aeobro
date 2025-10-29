// components/VerificationCard.tsx
// AEOBRO — Reconciled Domain + Platform Verification Card
// Updated: 2025-10-29 14:20 ET

"use client";

import * as React from "react";

type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "PLATFORM_VERIFIED"
  | "DOMAIN_VERIFIED";

type StartDnsResponse = {
  // legacy shape (from /api/verify/dns/start)
  recordHost?: string;
  recordType?: "TXT";
  recordValue?: string;

  // new shape (from /api/verify/domain { init: true })
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

type StartPlatformResponse = {
  marker?: string;
  error?: string;
};

type CheckPlatformResponse = {
  profile?: { verificationStatus?: VerificationStatus };
  message?: string;
  error?: string;
};

type Props = {
  /** Required for /api/verify/domain */
  profileId: string;

  /** Optional initial values if you have them on the profile */
  initialDomain?: string | null;
  initialStatus?: VerificationStatus | null;

  /** Optional callback when status changes */
  onStatusChange?: (status: VerificationStatus) => void;

  className?: string;
};

export default function VerificationCard({
  profileId,
  initialDomain = "",
  initialStatus = "UNVERIFIED",
  onStatusChange,
  className,
}: Props) {
  const [mode, setMode] = React.useState<"dns" | "platform" | null>(null);
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

  // Platform state
  const [platformMarker, setPlatformMarker] = React.useState<string>("");

  React.useEffect(() => {
    // normalize domain once (idempotent)
    if (domainInput?.trim()) {
      setNormalizedDomain(normalizeDomain(domainInput));
    } else {
      setNormalizedDomain("");
    }
  }, [domainInput]);

  // --- Helpers ---

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

  // --- DNS Flow (NEW endpoints) ---

  async function handleDnsGenerate() {
    setMessage("");
    if (!profileId) {
      setMessage("Missing profileId.");
      return;
    }
    if (!normalizedDomain) {
      setMessage("Enter a domain before generating a TXT record.");
      return;
    }
    setLoading(true);
    try {
      // New contract: POST /api/verify/domain { profileId, domain, init: true }
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

      // Prefer new shape: token + preferred format
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

      // Back-compat: legacy shape (recordHost/Type/Value)
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
      setMessage("Missing profileId.");
      return;
    }
    if (!normalizedDomain) {
      setMessage("Enter a domain before checking.");
      return;
    }
    setLoading(true);
    try {
      // New contract: POST /api/verify/domain { profileId, domain }
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

  // --- Platform Flow (existing endpoints retained) ---

  async function handlePlatformStart() {
    setMessage("");
    setLoading(true);
    try {
      const r = await fetch("/api/verify/platform/start", { method: "POST" });
      const j: StartPlatformResponse = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to start platform verification");
      setPlatformMarker(j?.marker || "");
      setMode("platform");
      setMessage("Add the code to a connected platform bio, then click “Check”.");
      updateStatus("PENDING");
    } catch (e: any) {
      setMessage(e?.message || "Error starting platform verification");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlatformCheck() {
    setMessage("");
    setLoading(true);
    try {
      const r = await fetch("/api/verify/platform/check", { method: "POST" });
      const j: CheckPlatformResponse = await r.json();
      if (!r.ok) throw new Error(j?.error || "Platform check failed");
      const newStatus =
        (j?.profile?.verificationStatus as VerificationStatus) || undefined;
      if (newStatus) {
        updateStatus(newStatus);
        setMessage(newStatus === "PLATFORM_VERIFIED" ? "Platform verified!" : `Status: ${newStatus}`);
      } else {
        setMessage(j?.message || "Checked.");
      }
    } catch (e: any) {
      setMessage(e?.message || "Error during platform check");
    } finally {
      setLoading(false);
    }
  }

  // --- UI ---

  return (
    <div className={`w-full max-w-2xl rounded-2xl border bg-white p-5 shadow-sm ${className || ""}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Verify</div>
          <p className="text-sm text-neutral-600">
            Prefer DNS TXT verification. We accept legacy values under the hood, but we recommend the new format below.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Domain input (used for DNS flow) */}
      <div className="mt-2">
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

      {/* Mode selector (initial) */}
      {!mode && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleDnsGenerate}
            disabled={loading}
            className="rounded-xl bg-[#2563EB] px-4 py-2 text-white disabled:opacity-50"
            type="button"
          >
            {loading ? "Working…" : "Generate DNS record"}
          </button>
          <button
            onClick={handlePlatformStart}
            disabled={loading}
            className="rounded-xl border px-4 py-2 disabled:opacity-50"
            type="button"
          >
            Use code-in-bio
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
            disabled={loading}
            className="mt-3 rounded-xl border px-4 py-2 disabled:opacity-50"
            type="button"
          >
            {loading ? "Checking…" : "Check record now"}
          </button>
        </div>
      )}

      {/* Platform instructions */}
      {mode === "platform" && (
        <div className="mt-5 rounded-xl border bg-neutral-50 p-4">
          <p className="mb-2 text-sm font-medium">Add this code to one connected platform bio, then click “Check”:</p>
          <pre className="whitespace-pre-wrap rounded bg-white p-2 text-xs">{platformMarker || "<marker>"}</pre>
          <button
            onClick={handlePlatformCheck}
            disabled={loading}
            className="mt-3 rounded-xl border px-4 py-2 disabled:opacity-50"
            type="button"
          >
            {loading ? "Checking…" : "Check"}
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
