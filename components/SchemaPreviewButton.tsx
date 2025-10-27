// components/SchemaPreviewButton.tsx
"use client";

import * as React from "react";

type Props = {
  slug: string;
  /** default: true → include Services + FAQ JSON-LD */
  includeAll?: boolean;
  /** Pretty-print the preview/copy/download (always true for preview). */
  pretty?: boolean;
  className?: string;
  /** Visible label on the trigger button */
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

  // Canonical raw endpoint used by crawlers; we will fetch this and pretty-print locally.
  const rawEndpoint = React.useMemo(() => {
    const p = new URLSearchParams();
    if (includeAll) p.set("all", "1");
    // NOTE: do NOT pass pretty here; we want the raw canonical JSON and we will pretty-print in the UI.
    return `/api/profile/${encodeURIComponent(slug)}/schema${p.toString() ? "?" + p.toString() : ""}`;
  }, [slug, includeAll]);

  async function openModal() {
    setOpen(true);
    setError(null);
    if (!formattedText) {
      setLoading(true);
      try {
        const res = await fetch(rawEndpoint, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Try to parse as JSON, then pretty-print. Fallback to text if needed.
        let prettyText = "";
        try {
          const json = await res.json();
          prettyText = JSON.stringify(json, null, 2);
        } catch {
          const txt = await res.text();
          try {
            const parsed = JSON.parse(txt);
            prettyText = JSON.stringify(parsed, null, 2);
          } catch {
            // If it truly isn't JSON, show the raw text (unlikely)
            prettyText = txt;
          }
        }

        setFormattedText(prettyText);
      } catch (e: any) {
        setError(e?.message || "Failed to fetch schema");
      } finally {
        setLoading(false);
      }
    }
  }

  async function copy() {
    if (!formattedText) return;
    try {
      await navigator.clipboard.writeText(formattedText);
    } catch {
      // Fallback
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
    const blob = new Blob([formattedText], { type: "application/json;charset=utf-8" });
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
        className={className || "rounded-md bg-black text-white px-3 py-2 text-sm"}
        title="Copies the same JSON-LD AI systems read, formatted for readability."
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

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={copy}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white"
                title="Copy the formatted JSON-LD to clipboard"
              >
                Copy
              </button>

              <button
                onClick={download}
                className="rounded border px-3 py-1.5 text-sm"
                title="Download the formatted JSON-LD as a .json file"
              >
                Download .json
              </button>

              <a
                href={rawEndpoint}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border px-3 py-1.5 text-sm"
                title="Open the canonical machine-readable endpoint used by crawlers"
              >
                Open raw endpoint (/schema)
              </a>
            </div>

            <div className="mt-3">
              {loading ? (
                <div className="text-sm text-gray-600">Loading…</div>
              ) : error ? (
                <div className="text-sm text-red-600">Error: {error}</div>
              ) : (
                <pre className="max-h-[60vh] overflow-auto rounded-lg bg-gray-950 p-3 text-[12px] leading-relaxed text-gray-100">
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
