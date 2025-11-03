// components/LogoUploader.tsx
// ✅ Updated: 2025-11-03 06:25 ET
// Uses POST multipart/form-data to /api/uploads/logo (matches server route)

"use client";

import { useRef, useState } from "react";

type Props = {
  value?: string | null;
  onChange: (url: string) => void;
  /** Optional max size in MB (default 4 MB) */
  maxSizeMB?: number;
};

const ACCEPT_TYPES = /^(image\/png|image\/jpeg|image\/webp|image\/svg\+xml)$/i;

export default function LogoUploader({ value, onChange, maxSizeMB = 4 }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  /** ---- Helpers ---- */
  function kbTrigger(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  function validate(file: File): string | null {
    if (!ACCEPT_TYPES.test(file.type)) {
      return "Unsupported file type. Use PNG, JPG/JPEG, WebP, or SVG.";
    }
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File too large. Max ${maxSizeMB} MB.`;
    }
    return null;
  }

  async function safeParseResponse(res: Response): Promise<{ url?: string; error?: string }> {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        return await res.json();
      } catch {
        return { error: "Server returned invalid JSON." };
      }
    }
    const text = await res.text();
    if (/^https?:\/\//i.test(text)) return { url: text.trim() };
    return { error: text || `Unexpected server response (${res.status}).` };
  }

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const vErr = validate(file);
      if (vErr) throw new Error(vErr);

      const fd = new FormData();
      fd.append("file", file);

      // 🔁 IMPORTANT: matches server route path exactly
      const res = await fetch("/api/uploads/logo", { method: "POST", body: fd });
      const data = await safeParseResponse(res);

      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      if (!data.url) throw new Error("Upload succeeded but no URL was returned.");
      onChange(data.url);
    } catch (e: any) {
      setErr(e?.message || "Upload error");
    } finally {
      setBusy(false);
      setDragging(false);
    }
  }

  /** ---- Input handlers ---- */
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) upload(f);
    // allow re-pick of same file
    e.currentTarget.value = "";
  }

  /** Safari/Chrome: must preventDefault on dragenter/dragover/drop */
  function onDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);

    let file: File | null = null;

    // 1) Direct files list
    const files = e.dataTransfer.files;
    if (files && files.length > 0) file = files[0];

    // 2) Fallback: DataTransferItemList
    if (!file) {
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        for (const item of Array.from(items)) {
          if (item.kind === "file") {
            const got = item.getAsFile();
            if (got) {
              file = got;
              break;
            }
          }
        }
      }
    }

    if (file) upload(file);
  }

  function clearImage() {
    onChange("");
    setErr(null);
  }

  /** ---- UI ---- */
  return (
    <div className="select-none">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload logo"
        title="Click or drag-and-drop to upload a logo"
        onKeyDown={kbTrigger}
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          "flex items-center justify-center rounded-2xl border border-dashed p-5 text-sm outline-none transition-colors",
          "cursor-pointer",
          dragging ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50 border-gray-300",
        ].join(" ")}
      >
        {busy ? (
          <span className="text-gray-700">Uploading…</span>
        ) : value ? (
          <div className="flex w-full items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Logo preview"
              className="h-12 w-12 shrink-0 rounded object-cover"
              onError={(ev) => {
                // If thumbnail fails, just fade it so the URL is still visible.
                (ev.currentTarget.style as any).opacity = "0.4";
              }}
            />
            <span className="truncate text-gray-700">{value}</span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-100"
                onClick={(ev) => {
                  ev.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Replace
              </button>
              <button
                type="button"
                className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-100"
                onClick={(ev) => {
                  ev.stopPropagation();
                  clearImage();
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <span className="text-gray-600">Click or drag a logo image here</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={onPick}
      />

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <p className="mt-2 text-xs text-gray-500">
        Tip: PNG / JPG / WebP / SVG. Max {maxSizeMB} MB. We’ll host the file and fill the Logo URL for you.
      </p>
    </div>
  );
}
