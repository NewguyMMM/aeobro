// components/SchemaPreviewButton.tsx
// 📅 Updated: 2025-11-25 16:10 ET
// Fully hardened: no auto-fetch, no hydration failures, safe modal-only loading.

"use client";

import * as React from "react";

type Props = {
  slug: string;
  includeAll?: boolean;
  pretty?: boolean;
  className?: string;
  label?: string;
};

export default function SchemaPreviewButton({
  slug,
  includeAll = true,
  pretty = true,
  className,
  label = "Copy formatted JSON-LD",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formattedText, setFormattedText] = React.useState<string>("");

  /**
   * Canonical raw endpoint — always used for crawlers.
   * We do not pass "pretty", because we always pretty-print in the UI.
   */
  const rawEndpoint = React.useMemo(() => {
    const p = new URLSearchParams();
    if (includeAll) p.set("all", "1");
    return `/api/profile/${encodeURIComponent(slug)}/schema${
      p.toString() ? "?" + p.toString() : ""
    }`;
  }, [slug, includeAll]);

  /**
   * Open modal → fetch schema only when needed.
   * This avoids hydration-triggered fetches entirely.
   */
  async function openModal() {
    setOpen(true);
    setError(null);

    // If already loaded once, do not fetch again unless user closes and reopens modal.
    if (formattedText) return;

    setLoading(true);

    try {
      const url = `${rawEndpoint}${rawEndpoint.includes("?") ? "&" : "?"}t=${Date.now()}`;

      const res = await fetch(url, {
        cache: "no-store",
        method: "GET",
      });

      const raw = await res.text();

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const maybeJson = JSON.parse(raw);
          if (maybeJson?.error) {
            message = maybeJson.error;
          } else if (maybeJson?.verificationStatus === "UNVERIFIED") {
            message = "Export blocked: verify your domain or connect a platform.";
          }
        } catch {
          // ignore parse failure — keep generic message
        }
        setError(message);
        return;
      }

      /**
       * Try to parse JSON — but do NOT let parse errors throw.
       */
      let prettyText = raw;
      try {
        const json = JSON.parse(raw);
        prettyText = JSON.stringify(json, null, 2);
      } catch {
        // If raw is not JSON, we leave it as-is.
      }

      setFormattedText(prettyText);
    } catch (err: any) {
      console.error("Schema preview error:", err);
      setError("Failed to load JSON-LD. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Clipboard-safe copy function.
   */
  async function copy() {
    if (!formattedText) return;

    try {
      await navigator.clipboard.writeText(formattedText);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = formattedText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  function download() {
    if (!formattedText) return;

    const blob = new Blob([formattedText], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-schema.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          className ||
          "rounded-md bg-black text-white px-3 py-2 text-sm hover:bg-gray-900 transition"
        }
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden
        >
          <div
            className="absolute left-1/2 top-16 w-[min(900px,92vw)] -translate-x-1/2 rounded-xl bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">JSON-LD Preview</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-sm hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Actions */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={copy}
                disabled={!formattedText}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Copy
              </button>

              <button
                onClick={download}
                disabled={!formattedText}
                className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Download .json
              </button>

              <a
                href={rawEndpoint}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border px-3 py-1.5 text-sm"
              >
                Open raw endpoint
              </a>
            </div>

            {/* Content */}
            <div className="mt-4">
              {loading ? (
                <div className="text-sm text-gray-600">Loading…</div>
              ) : error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : (
                <pre className="max-h-[60vh] overflow-auto rounded-lg bg-gray-950 p-3 text-xs leading-relaxed text-gray-100 whitespace-pre-wrap">
                  {formattedText}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
