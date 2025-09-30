"use client";
import * as React from "react";
import { useToast } from "@/components/Toast";

type Service = {
  id?: string; position: number; name: string; description?: string;
  url?: string; priceMin?: string | number; priceMax?: string | number;
  priceUnit?: string; currency?: string; isPublic?: boolean;
};

export default function ServiceEditor({ profileId }: { profileId: string }) {
  const [items, setItems] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    (async () => {
      const res = await fetch(`/api/services?profileId=${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    })();
  }, [profileId]);

  function add() {
    setItems((arr) => [...arr, { position: arr.length, name: "", isPublic: true }]);
  }

  async function save() {
    setLoading(true);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, items }),
    });
    setLoading(false);
    if (res.ok) toast("Services saved.");
    else toast("Failed to save services.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Services</h3>
        <div className="flex gap-2">
          <button onClick={add} className="btn">Add</button>
          <button onClick={save} className="btn bg-black text-white" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
        </div>
      </div>

      {items.map((it, idx) => (
        <div key={it.id ?? idx} className="rounded-xl border p-4 grid gap-2 md:grid-cols-2">
          <input className="rounded-md border px-3 py-2" placeholder="Service name"
            value={it.name} onChange={(e) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
          <input className="rounded-md border px-3 py-2" placeholder="URL (optional)"
            value={it.url ?? ""} onChange={(e) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))} />
          <textarea className="md:col-span-2 rounded-md border px-3 py-2" placeholder="Description"
            value={it.description ?? ""} onChange={(e) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
          <input className="rounded-md border px-3 py-2" placeholder="Min price"
            value={it.priceMin ?? ""} onChange={(e) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, priceMin: e.target.value } : x))} />
          <input className="rounded-md border px-3 py-2" placeholder="Max price"
            value={it.priceMax ?? ""} onChange={(e) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, priceMax: e.target.value } : x))} />
          <input className="rounded-md border px-3 py-2" placeholder="Price unit (per hour, flat, etc.)"
            value={it.priceUnit ?? ""} onChange={(e) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, priceUnit: e.target.value } : x))} />
          <input className="rounded-md border px-3 py-2" placeholder="Currency (USD, EUR...)"
            value={it.currency ?? ""} onChange={(e) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, currency: e.target.value.toUpperCase() } : x))} />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={it.isPublic ?? true}
              onChange={(e) => setItems((arr) => arr.map((x, i) => i === idx ? { ...x, isPublic: e.target.checked } : x))} />
            Public
          </label>
        </div>
      ))}
    </div>
  );
}
