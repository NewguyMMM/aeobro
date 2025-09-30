"use client";
import * as React from "react";
import { useToast } from "@/components/Toast";

type FAQ = { id?: string; position: number; question: string; answer: string; isPublic?: boolean };

export default function FaqEditor({ profileId }: { profileId: string }) {
  const [items, setItems] = React.useState<FAQ[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    (async () => {
      const res = await fetch(`/api/faqs?profileId=${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    })();
  }, [profileId]);

  function add() {
    setItems((arr) => [...arr, { position: arr.length, question: "", answer: "", isPublic: true }]);
  }

  async function save() {
    setLoading(true);
    const res = await fetch("/api/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, items }),
    });
    setLoading(false);
    if (res.ok) toast("FAQ saved.");
    else toast("Failed to save FAQ.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">FAQ</h3>
        <div className="flex gap-2">
          <button onClick={add} className="btn">Add</button>
          <button onClick={save} className="btn bg-black text-white" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
        </div>
      </div>

      {items.map((it, idx) => (
        <div key={it.id ?? idx} className="rounded-xl border p-4 space-y-2">
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="Question"
            value={it.question}
            onChange={(e) => {
              const v = e.target.value;
              setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, question: v } : x)));
            }}
          />
          <textarea
            className="w-full rounded-md border px-3 py-2"
            placeholder="Answer"
            rows={4}
            value={it.answer}
            onChange={(e) => {
              const v = e.target.value;
              setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, answer: v } : x)));
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={it.isPublic ?? true}
              onChange={(e) => {
                const v = e.target.checked;
                setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, isPublic: v } : x)));
              }}
            />
            Public
          </label>
        </div>
      ))}
    </div>
  );
}
