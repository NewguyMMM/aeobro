// components/SchemaPreviewButton.tsx
"use client";

import * as React from "react";

type Props = {
  slug: string;
  /** default: true → include Services + FAQ JSON-LD */
  includeAll?: boolean;
  /** default: true → pretty-print JSON */
  pretty?: boolean;
  className?: string;
  label?: string;
};

export default function SchemaPreviewButton({
  slug,
  includeAll = true,
  pretty = true,
  className,
  label = "Preview & Copy JSON-LD",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [jsonText, setJsonText] = React.useState<string>("");

  const endpoint = React.useMemo(() => {
    const p = new URLSearchParams();
    if (includeAll) p.set("all", "1");
    if (pretty) p.set("pretty", "1");
    return `/api/profile/${encodeURIComponent(slug)}/schema${p.toString() ? "?" + p.toString() : ""}`;
  }, [slug, includeAll, pretty]);

  async function openModal() {
    setOpen(true);
    setError(null);
    if (!jsonText) {
      setLoading(true);
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const txt = await res.text();
        setJsonText(txt);
      } catch (e: any) {
        setError(e?.message || "Failed to fetch schema");
      } finally {
        setLoading(false);
      }
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(jsonText);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = jsonText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  function download() {
    const href = `${endpoint}${endpoint.includes("?") ? "&" : "?"}download=1`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={className || "rounded-md bg-black text-white px-3 py-2 text-sm"}
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
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
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

            <div className="mt-3 flex gap-2">
              <button onClick={copy} className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white">
                Copy
              </button>
              <button onClick={download} className="rounded border px-3 py-1.5 text-sm">
                Download .json
              </button>
              <a
                href={endpoint}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border px-3 py-1.5 text-sm"
              >
                Open raw
              </a>
            </div>

            <div className="mt-3">
              {loading ? (
                <div className="text-sm text-gray-600">Loading…</div>
              ) : error ? (
                <div className="text-sm text-red-600">Error: {error}</div>
              ) : (
                <pre className="max-h-[60vh] overflow-auto rounded-lg bg-gray-950 p-3 text-[12px] leading-relaxed text-gray-100">
                  {jsonText}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
