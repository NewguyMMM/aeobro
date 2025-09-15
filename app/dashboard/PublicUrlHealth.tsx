// app/dashboard/PublicUrlHealth.tsx
"use client";

import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  status?: number;
  url?: string;
  redirected?: boolean;
  canonical?: string | null;
  canonicalOk?: boolean;
  jsonLdOk?: boolean;
  expected?: string;
  issues?: {
    http?: string | null;
    canonical?: string | null;
    jsonLd?: string | null;
  };
  error?: string;
};

export default function PublicUrlHealth({ slugOrId }: { slugOrId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Health | null>(null);

  async function check() {
    if (!slugOrId) return;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (/^\d+$/.test(slugOrId)) p.set("id", slugOrId);
      else p.set("slug", slugOrId);

      const res = await fetch(`/api/profile/health?${p.toString()}`, {
        cache: "no-store",
      });
      const json: Health = await res.json();
      setData(json);
    } catch (e: any) {
      setData({ ok: false, error: e?.message || "Check failed" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugOrId]);

  const variant =
    loading ? "bg-gray-200 text-gray-700" :
    data?.ok ? "bg-green-100 text-green-800 border border-green-300" :
    "bg-amber-100 text-amber-800 border border-amber-300";

  return (
    <div className="flex items-center gap-2">
      <span className={`px-3 py-1 rounded-full text-sm ${variant}`}>
        {loading
          ? "Checking public page…"
          : data?.ok
          ? "Public page OK"
          : "Needs attention"}
      </span>

      <button
        type="button"
        className="text-sm underline"
        onClick={check}
        disabled={loading}
      >
        Recheck
      </button>

      {/* Details (only when not OK) */}
      {!loading && data && !data.ok && (
        <div className="text-xs text-gray-600">
          <ul className="list-disc pl-4 space-y-1">
            {data.issues?.http && <li>{data.issues.http}</li>}
            {data.issues?.canonical && <li>{data.issues.canonical}</li>}
            {data.issues?.jsonLd && <li>{data.issues.jsonLd}</li>}
            {data.error && <li>{data.error}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
