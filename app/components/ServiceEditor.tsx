"use client";
import * as React from "react";

type Service = {
  id?: string;
  position: number;
  name: string;
  description?: string;
  url?: string;
  priceMin?: string | number;
  priceMax?: string | number;
  priceUnit?: string;
  currency?: string;
  isPublic?: boolean;
};

export default function ServiceEditor({ profileId }: { profileId: string }) {
  const [items, setItems] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/services?profileId=${profileId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load services");
        const data = await res.json();
        setItems(data.items ?? []);
      } catch (e: any) {
        setStatus(e?.message || "Failed to load services");
      }
    })();
  }, [profileId]);

  function add() {
    setItems((arr) => [...arr, { position: arr.length, name: "", isPublic: true }]);
  }

  async function save() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, items }),
      });
      if (!res.ok) throw new Error("Failed to save services");
      setStatus("Services saved.");
    } catch (e: any) {
      setStatus(e?.message || "Failed to save services");
    } finally {
      setLoading(false);
    }
  }

  function upd<K extends keyof Service>(i: number, k: K, v: Service[K]) {
    setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Services</h3>
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
        <div key={it.id ?? idx} className="rounded-xl border p-4 grid gap-2 md:grid-cols-2">
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Service name"
            value={it.name}
            onChange={(e) => upd(idx, "name", e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="URL (optional)"
            value={it.url ?? ""}
            onChange={(e) => upd(idx, "url", e.target.value)}
          />
          <textarea
            className="md:col-span-2 rounded-md border px-3 py-2"
            placeholder="Description"
            value={it.description ?? ""}
            onChange={(e) => upd(idx, "description", e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Min price"
            value={it.priceMin ?? ""}
            onChange={(e) => upd(idx, "priceMin", e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Max price"
            value={it.priceMax ?? ""}
            onChange={(e) => upd(idx, "priceMax", e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Price unit (per hour, flat, etc.)"
            value={it.priceUnit ?? ""}
            onChange={(e) => upd(idx, "priceUnit", e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="Currency (USD, EUR...)"
            value={it.currency ?? ""}
            onChange={(e) => upd(idx, "currency", e.target.value.toUpperCase())}
          />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
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
