// components/ProfileEditor.tsx
"use client";

import * as React from "react";

type LinkItem = { label: string; url: string };
type Profile = {
  displayName?: string | null;
  tagline?: string | null;
  location?: string | null;
  website?: string | null;
  bio?: string | null;
  links?: LinkItem[] | null;
};

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export default function ProfileEditor({ initial }: { initial: Profile | null }) {
  const [form, setForm] = React.useState<Profile>({
    displayName: initial?.displayName ?? "",
    tagline: initial?.tagline ?? "",
    location: initial?.location ?? "",
    website: initial?.website ?? "",
    bio: initial?.bio ?? "",
    links: initial?.links ?? [],
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  function update<K extends keyof Profile>(key: K, val: Profile[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function updateLink(i: number, key: keyof LinkItem, val: string) {
    setForm((f) => {
      const links = [...(f.links ?? [])];
      links[i] = { ...links[i], [key]: val };
      return { ...f, links };
    });
  }

  function addLink() {
    setForm((f) => ({ ...f, links: [...(f.links ?? []), { label: "", url: "" }] }));
  }

  function removeLink(i: number) {
    setForm((f) => {
      const links = [...(f.links ?? [])];
      links.splice(i, 1);
      return { ...f, links };
    });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const payload: Profile = {
        ...form,
        website: form.website ? normalizeUrl(form.website) : "",
        links: (form.links ?? []).map((l) => ({
          label: (l.label ?? "").trim(),
          url: normalizeUrl(l.url ?? ""),
        })),
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      setMsg("Saved ✓");
    } catch (e) {
      setMsg("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full border rounded-lg px-3 py-2";
  const label = "text-sm font-medium text-gray-700";
  const row = "grid gap-2";

  return (
    <div className="max-w-2xl grid gap-6">
      <div className={row}>
        <label className={label} htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          className={input}
          value={form.displayName ?? ""}
          onChange={(e) => update("displayName", e.target.value)}
          maxLength={120}
        />
      </div>

      <div className={row}>
        <label className={label} htmlFor="tagline">Tagline</label>
        <input
          id="tagline"
          className={input}
          value={form.tagline ?? ""}
          onChange={(e) => update("tagline", e.target.value)}
          maxLength={160}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={row}>
          <label className={label} htmlFor="location">Location</label>
          <input
            id="location"
            className={input}
            value={form.location ?? ""}
            onChange={(e) => update("location", e.target.value)}
            maxLength={120}
          />
        </div>
        <div className={row}>
          <label className={label} htmlFor="website">Website</label>
          <input
            id="website"
            className={input}
            placeholder="https://example.com"
            value={form.website ?? ""}
            onChange={(e) => update("website", e.target.value)}
            maxLength={200}
          />
        </div>
      </div>

      <div className={row}>
        <label className={label} htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          className={input}
          rows={6}
          value={form.bio ?? ""}
          onChange={(e) => update("bio", e.target.value)}
          maxLength={2000}
        />
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <label className={label}>Links</label>
          <button type="button" onClick={addLink} className="text-sm px-2 py-1 border rounded-lg">+ Add link</button>
        </div>

        {(form.links ?? []).map((lnk, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={input}
              placeholder="Label (e.g., Twitter)"
              value={lnk.label ?? ""}
              onChange={(e) => updateLink(i, "label", e.target.value)}
              maxLength={60}
            />
            <div className="flex gap-2">
              <input
                className={input}
                placeholder="https://…"
                value={lnk.url ?? ""}
                onChange={(e) => updateLink(i, "url", e.target.value)}
                maxLength={300}
              />
              <button type="button" onClick={() => removeLink(i)} className="px-3 py-2 border rounded-lg">×</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </div>
  );
}
