// components/LinkedAccountsCard.tsx
// ✅ Created: 2025-12-03 18:20 ET
// Standalone Linked Accounts card – lists & disconnects OAuth / Code-in-Bio accounts.

"use client";

import * as React from "react";
import Link from "next/link";

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

export default function LinkedAccountsCard() {
  const [accounts, setAccounts] = React.useState<PlatformAccount[] | null>(null);
  const [msg, setMsg] = React.useState<string>("");

  React.useEffect(() => {
    refreshAccounts().catch(() => {
      /* ignore */
    });
  }, []);

  async function refreshAccounts() {
    try {
      const r = await fetch("/api/verify/platform/list", { method: "GET" });
      if (!r.ok) {
        setAccounts(null);
        setMsg("Could not load linked accounts.");
        return;
      }
      const j: ListAccountsResponse = await r.json();
      setAccounts(j?.accounts || []);
      setMsg("");
    } catch (e: any) {
      setAccounts(null);
      setMsg(e?.message || "Could not load linked accounts.");
    }
  }

  async function disconnectAccount(id: string) {
    if (!id) return;
    setMsg("");
    try {
      const r = await fetch(`/api/verify/platform/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const text = await r.text();
        setMsg(text || "Failed to disconnect account.");
      } else {
        setMsg("Disconnected. If this was your last linked account, your profile may be demoted to Unverified.");
        refreshAccounts();
      }
    } catch (e: any) {
      setMsg(e?.message || "Error disconnecting account.");
    }
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Linked accounts</div>
          <p className="mt-1 text-sm text-neutral-600">
            These are the platforms AEOBRO currently trusts for your profile (via OAuth or Code-in-Bio).
            Disconnecting an account removes verification for that platform. If your profile was verified
            <span className="font-semibold"> only</span> through linked accounts, removing all of them may
            demote your profile to <span className="font-semibold">Unverified</span>.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            To remove DNS verification instead, delete the{" "}
            <span className="font-mono">_aeobro-verify.yourdomain</span> TXT record from your DNS. After DNS
            changes propagate, return to the DNS section above and click{" "}
            <span className="font-medium">“Check record now”</span> to refresh your status.
          </p>
        </div>
      </div>

      {/* List */}
      {accounts === null ? (
        <p className="mt-3 text-xs text-neutral-500">
          Loading linked accounts…
        </p>
      ) : accounts.length ? (
        <ul className="mt-3 divide-y rounded-xl border bg-neutral-50">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded border px-2 py-0.5 text-xs uppercase text-neutral-700">
                    {a.provider}
                  </span>
                  {a.status === "VERIFIED" ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      Verified
                    </span>
                  ) : a.status === "PENDING" ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Pending
                    </span>
                  ) : (
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
                      Failed
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-neutral-700">
                  {a.externalId}
                </div>
                {a.handle && (
                  <div className="truncate text-xs text-neutral-600">
                    {a.handle}
                  </div>
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
        <p className="mt-3 text-xs text-neutral-500">
          No accounts linked yet. Once you verify via OAuth or Code-in-Bio, they will appear here.
        </p>
      )}

      {!!msg && (
        <p className="mt-3 text-xs text-neutral-700">
          {msg}
        </p>
      )}
    </div>
  );
}
