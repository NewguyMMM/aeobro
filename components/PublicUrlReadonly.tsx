// components/PublicUrlReadonly.tsx
"use client";

import { useMemo, useState } from "react";

type Props = {
  slug?: string | null;
  /** Optional: override the origin (e.g., https://aeobro.com) */
  base?: string;
};

export default function PublicUrlReadonly({ slug, base }: Props) {
  const [copied, setCopied] = useState(false);

  // Fallbacks so the UI is stable even before first save
  const safeSlug = (slug && String(slug).trim()) || "your-page";
  const origin =
    base ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://aeobro.com");

  const url = useMemo(() => `${origin}/p/${safeSlug}`, [origin, safeSlug]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // settle the "Copied!" badge after a moment
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // basic fallback: select + prompt
      try {
        const ok = window.prompt("Copy your public URL:", url);
        if (ok !== null) setCopied(true);
      } catch {
        // no-op
      }
    }
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium">
        Public URL
        {/* Tooltip */}
        <span className="relative group inline-flex items-center">
          <span
            aria-label="About your public URL"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs leading-none"
            role="img"
          >
            ℹ︎
          </span>
          <span
            className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-white px-3 py-2 text-xs shadow-md opacity-0 transition group-hover:opacity-100"
            style={{ zIndex: 20 }}
          >
            This is your public page link. If someone already uses your name,
            we’ll add a short ending like “-nj” or “-2” so yours is unique.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-md border px-3 py-2 text-sm bg-gray-50"
          readOnly
          value={url}
          aria-readonly="true"
        />
        <button type="button" onClick={copy} className="btn">
          {copied ? "Copied!" : "Copy"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          Open
        </a>
      </div>

      <p className="text-xs text-gray-500">
        Your URL is created automatically from your Display Name (and location,
        if added). You don’t need to change anything here.
      </p>
    </div>
  );
}
