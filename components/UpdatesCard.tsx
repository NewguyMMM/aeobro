// components/UpdatesCard.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import { requirePlan } from "@/lib/plan";
import { useToast } from "@/components/Toast";

type Props = {
  // e.g. "FREE" | "LITE" | "PLUS" | "PRO" | ...
  plan: string;
  initialUpdateMessage: string | null | undefined;
};

export default function UpdatesCard({ plan, initialUpdateMessage }: Props) {
  const toast = useToast(); // ✅ hook returns a function, not { pushToast }
  const [value, setValue] = useState(initialUpdateMessage ?? "");
  const [saving, setSaving] = useState(false);

  const canEdit = requirePlan(plan as any, "PLUS"); // PLUS & above

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch("/api/profile/update-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updateMessage: value }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Failed to save update.");
      }

      toast({
        type: "success",
        title: "Update saved",
        message: "Your latest update is now live.",
      });
    } catch (err: any) {
      console.error("UpdatesCard save error:", err);
      toast({
        type: "error",
        title: "Error",
        message: err?.message || "Could not save update.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    // Lite / Free: show locked state
    return (
      <section className="rounded-2xl border bg-neutral-50 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Updates</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Share time-sensitive promotions, launches, or announcements in a way
          that AI can read and reuse.
        </p>
        <p className="mt-3 inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
          Unlock with Plus
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-900">Updates</h2>
      <p className="mt-2 text-sm text-neutral-700">
        Post your latest offer, launch, or announcement. This becomes a
        machine-readable “Latest update” that AEOBRO exposes to AI systems.
      </p>

      <textarea
        className="mt-3 w-full min-h-[120px] resize-vertical rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
        placeholder="Example: “Holiday promo: 20% off family photo sessions booked before Dec 15.”"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Tip: Keep this short and concrete. Think: one headline update you’d
          want AI to repeat.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {saving ? "Saving…" : "Save update"}
        </button>
      </div>
    </section>
  );
}
