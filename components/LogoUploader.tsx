// app/components/LogoUploader.tsx
"use client";

import { useRef, useState } from "react";

type Props = {
  value?: string | null;
  onChange: (url: string) => void;
};

export default function LogoUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch (e: any) {
      setErr(e.message || "Upload error");
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) upload(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed p-4 text-sm text-gray-600 hover:bg-gray-50"
        title="Click or drag-and-drop to upload a logo"
      >
        {busy ? (
          <span>Uploading…</span>
        ) : value ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Logo" className="h-10 w-10 rounded object-cover" />
            <span className="text-gray-700 truncate">{value}</span>
          </div>
        ) : (
          <span>Click or drag a logo image here</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-xs text-gray-500">
        Tip: PNG/JPG/WebP/SVG. We’ll host the file and fill the Logo URL for you.
      </p>
    </div>
  );
}
