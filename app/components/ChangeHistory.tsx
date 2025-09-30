"use client";
import * as React from "react";

export default function ChangeHistory({ profileId }: { profileId: string }) {
  const [items, setItems] = React.useState<any[]>([]);
  React.useEffect(() => {
    (async () => {
      const res = await fetch(`/api/change-log?profileId=${profileId}&limit=150`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    })();
  }, [profileId]);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Change history</h3>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{it.entity} · {it.action}{it.field ? ` · ${it.field}` : ""}</span>
              <span className="text-gray-500">{new Date(it.createdAt).toLocaleString()}</span>
            </div>
            {it.before || it.after ? (
              <details className="mt-2">
                <summary className="cursor-pointer">Diff</summary>
                <div className="grid md:grid-cols-2 gap-2 mt-2">
                  <pre className="overflow-auto bg-gray-50 p-2 rounded">{JSON.stringify(it.before, null, 2)}</pre>
                  <pre className="overflow-auto bg-gray-50 p-2 rounded">{JSON.stringify(it.after, null, 2)}</pre>
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
