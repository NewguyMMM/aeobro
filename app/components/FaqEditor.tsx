"use client";
import * as React from "react";

type FAQ = { id?: string; position: number; question: string; answer: string; isPublic?: boolean };

export default function FaqEditor({ profileId }: { profileId: string }) {
  const [items, setItems] = React.useState<FAQ[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/faqs?profileId=${profileId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load FAQ");
        const data = await res.json();
        setItems(data.items ?? []);
      } catch (e: any) {
        setStatus(e?.message || "Failed to load FAQ");
      }
    })();
  }, [profileId]);

  function add() {
    setItems((arr) => [...arr, { position: arr.length, question: "", answer: "", isPublic: true }]);
  }

  async function save() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, items }),
      });
      if (!res.ok) throw new Error("Failed to save FAQ");
      setStatus("FAQ saved.");
    } catch (e: any) {
      setStatus(e?.message || "Failed to save FAQ");
    } finally {
      setLoading(false);
    }
  }

  function upd<K extends keyof FAQ>(i: number, k: K, v: FAQ[K]) {
    setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">FAQ</h3>
        <div className="flex gap-2">
          <button onClick={add} className="rounded-md border px-3 py-2">Add</button>
          <button
            onClick={save}
            className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {status ? <p className="text-sm text-gray-600">{status}</p> : null}

      {items.map((it, idx) => (
        <div key={it.id ?? idx} className="rounded-xl border p-4 space-y-2">
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="Question"
            value={it.question}
            onChange={(e) => upd(idx, "question", e.target.value)}
          />
          <textarea
            className="w-full rounded-md border px-3 py-2"
            placeholder="Answer"
            rows={4}
            value={it.answer}
            onChange={(e) => upd(idx, "answer", e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={it.isPublic ?? true}
              onChange={(e) => upd(idx, "isPublic", e.target.checked)}
            />
            Public
          </label>
        </div>
      ))}
    </div>
  );
}
