// components/ProfileEditor.tsx
"use client";

import * as React from "react";
import { toKebab } from "@/lib/slug";
import { useToast } from "@/components/Toast";

/** -------- Types -------- */
type EntityType = "Business" | "Local Service" | "Organization" | "Creator / Person";

type PlatformHandles = {
  youtube?: string;
  tiktok?: string;
  instagram?: string;
  substack?: string;
  etsy?: string;
  x?: string; // Twitter / X
  linkedin?: string;
  facebook?: string;
  github?: string;
};

type LinkItem = { label: string; url: string };
type PressItem = { title: string; url: string };

type Profile = {
  // original fields
  displayName?: string | null;
  tagline?: string | null;
  location?: string | null;
  website?: string | null;
  bio?: string | null;
  links?: LinkItem[] | null;

  // new fields
  legalName?: string | null;
  entityType?: EntityType | null;

  serviceArea?: string[] | null;
  foundedYear?: number | null;
  teamSize?: number | null;
  languages?: string[] | null;
  pricingModel?: "Free" | "Subscription" | "One-time" | "Custom" | null;
  hours?: string | null;

  certifications?: string | null;
  press?: PressItem[] | null;

  logoUrl?: string | null;
  imageUrls?: string[] | null;

  handles?: PlatformHandles | null;

  // NEW: public slug
  slug?: string | null;
};

/** -------- Utils -------- */
function normalizeUrl(value: string): string {
  const v = (value || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
function isValidUrl(u: string): boolean {
  if (!u) return true; // allow empty
  try {
    const url = new URL(u);
    return !!url.protocol && !!url.host;
  } catch {
    return false;
  }
}
function toCsv(arr?: string[] | null): string {
  return (arr ?? []).join(", ");
}
function fromCsv(s: string): string[] {
  const parts = (s || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}
function toNum(input: string): number | undefined {
  if (!input) return undefined;
  const n = parseInt(input, 10);
  return Number.isFinite(n) ? n : undefined;
}
function debounce<T extends (...args: any[]) => any>(fn: T, ms = 400) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** -------- Component -------- */
export default function ProfileEditor({ initial }: { initial: Profile | null }) {
  const toast = useToast();

  // ---- Core identity
  const [displayName, setDisplayName] = React.useState(initial?.displayName ?? "");
  const [legalName, setLegalName] = React.useState(initial?.legalName ?? "");
  const [entityType, setEntityType] = React.useState<EntityType | "">(
    (initial?.entityType as EntityType) ?? ""
  );

  // ---- Story
  const [tagline, setTagline] = React.useState(initial?.tagline ?? "");
  const [bio, setBio] = React.useState(initial?.bio ?? "");

  // ---- Anchors
  const [website, setWebsite] = React.useState(initial?.website ?? "");
  const [location, setLocation] = React.useState(initial?.location ?? "");
  const [serviceArea, setServiceArea] = React.useState(toCsv(initial?.serviceArea));

  // ---- Trust & Authority
  const [foundedYear, setFoundedYear] = React.useState(
    initial?.foundedYear ? String(initial.foundedYear) : ""
  );
  const [teamSize, setTeamSize] = React.useState(
    initial?.teamSize ? String(initial.teamSize) : ""
  );
  const [languages, setLanguages] = React.useState(toCsv(initial?.languages));
  const [pricingModel, setPricingModel] = React.useState<
    "Free" | "Subscription" | "One-time" | "Custom" | ""
  >((initial?.pricingModel as any) ?? "");
  const [hours, setHours] = React.useState(initial?.hours ?? "");

  const [certifications, setCertifications] = React.useState(initial?.certifications ?? "");
  const [press, setPress] = React.useState<PressItem[]>(initial?.press ?? []);
  const [pressDraft, setPressDraft] = React.useState<PressItem>({ title: "", url: "" });

  // ---- Branding & media
  const [logoUrl, setLogoUrl] = React.useState(initial?.logoUrl ?? "");
  const [imageUrls, setImageUrls] = React.useState<string[]>(
    initial?.imageUrls && initial.imageUrls.length ? initial.imageUrls : ["", "", ""]
  );

  // ---- Platforms & links
  const [handles, setHandles] = React.useState<PlatformHandles>(initial?.handles ?? {});
  const [links, setLinks] = React.useState<LinkItem[]>(initial?.links ?? []);
  const [linkDraft, setLinkDraft] = React.useState<LinkItem>({ label: "", url: "" });

  // ---- NEW: Slug UX
  const [slug, setSlug] = React.useState<string>(
    toKebab(initial?.slug || initial?.displayName || initial?.legalName || "")
  );
  const [slugAvail, setSlugAvail] = React.useState<"idle" | "checking" | "ok" | "taken">("idle");
  const userTouchedSlug = React.useRef(false);

  // ---- UI
  const [saving, setSaving] = React.useState(false);
  const [savedSlug, setSavedSlug] = React.useState<string | null>(null); // for Copy URL + redirect
  const prefilledRef = React.useRef(false); // ensure we prefill only once

  /** ---- Prefill from API on mount (does not overwrite user typing) ---- */
  React.useEffect(() => {
    if (prefilledRef.current) return;
    prefilledRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data: Profile | null = await res.json();
        if (!data) return;

        // Identity
        if (data.displayName != null) setDisplayName(data.displayName || "");
        if (data.legalName != null) setLegalName(data.legalName || "");
        if (data.entityType) setEntityType(data.entityType);

        // Story
        if (data.tagline != null) setTagline(data.tagline || "");
        if (data.bio != null) setBio(data.bio || "");

        // Anchors
        if (data.website != null) setWebsite(data.website || "");
        if (data.location != null) setLocation(data.location || "");
        if (data.serviceArea) setServiceArea(toCsv(data.serviceArea));

        // Trust & authority
        if (data.foundedYear != null) setFoundedYear(String(data.foundedYear || ""));
        if (data.teamSize != null) setTeamSize(String(data.teamSize || ""));
        if (data.languages) setLanguages(toCsv(data.languages));
        if (data.pricingModel) setPricingModel(data.pricingModel);
        if (data.hours != null) setHours(data.hours || "");

        if (data.certifications != null) setCertifications(data.certifications || "");
        if (data.press) setPress(data.press);

        // Branding
        if (data.logoUrl != null) setLogoUrl(data.logoUrl || "");
        if (data.imageUrls && data.imageUrls.length) setImageUrls(data.imageUrls);

        // Platforms & links
        if (data.handles) setHandles(data.handles);
        if (data.links) setLinks(data.links);

        // Slug
        if (data.slug != null && !userTouchedSlug.current) {
          setSlug(toKebab(data.slug || data.displayName || data.legalName || ""));
        }
      } catch {
        // silent fail is fine for prefill
      }
    })();
  }, []);

  /** ---- Auto-suggest slug from displayName/legalName unless user edits manually ---- */
  React.useEffect(() => {
    if (userTouchedSlug.current) return;
    const suggestion = toKebab(displayName || legalName || "");
    if (suggestion) setSlug(suggestion);
  }, [displayName, legalName]);

  /** ---- Debounced availability check ---- */
  const debouncedCheckSlug = React.useMemo(
    () =>
      debounce(async (candidate: string) => {
        if (!candidate) {
          setSlugAvail("idle");
          return;
        }
        try {
          setSlugAvail("checking");
          const res = await fetch("/api/profile/ensure-unique-slug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base: candidate }),
          });
          const json = await res.json();
          if (json?.slug && json.slug === candidate) setSlugAvail("ok");
          else setSlugAvail("taken");
        } catch {
          setSlugAvail("idle");
        }
      }, 400),
    []
  );

  React.useEffect(() => {
    if (slug) debouncedCheckSlug(slug);
  }, [slug, debouncedCheckSlug]);

  /** ---- Save ---- */
  async function save() {
    setSaving(true);
    setSavedSlug(null);
    try {
      if (!displayName.trim()) throw new Error("Display name is required.");

      // Website optional, but validate if present
      if (website && !isValidUrl(normalizeUrl(website))) {
        throw new Error("Website must be a valid URL (https://example.com).");
      }
      if (logoUrl && !isValidUrl(normalizeUrl(logoUrl))) {
        throw new Error("Logo URL must be a valid URL.");
      }
      for (const u of imageUrls) {
        if (u && !isValidUrl(normalizeUrl(u))) {
          throw new Error("Every image URL must be valid.");
        }
      }
      for (const p of press) {
        if (p.url && !isValidUrl(normalizeUrl(p.url))) {
          throw new Error("Press links must be valid URLs.");
        }
      }
      for (const l of links) {
        if (l.url && !isValidUrl(normalizeUrl(l.url))) {
          throw new Error("Extra links must be valid URLs.");
        }
      }

      const payload: Profile = {
        // identity
        displayName: displayName.trim(),
        legalName: legalName.trim() || null,
        entityType: (entityType as EntityType) || null,

        // story
        tagline: tagline.trim() || null,
        bio: bio.trim() || null,

        // anchors
        website: website ? normalizeUrl(website) : null,
        location: location.trim() || null,
        serviceArea: fromCsv(serviceArea),

        // trust
        foundedYear: toNum(foundedYear) ?? null,
        teamSize: toNum(teamSize) ?? null,
        languages: fromCsv(languages),
        pricingModel: (pricingModel as any) || null,
        hours: hours.trim() || null,

        certifications: certifications.trim() || null,
        press: press.length
          ? press.map((p) => ({ title: p.title.trim(), url: normalizeUrl(p.url) }))
          : null,

        // branding
        logoUrl: logoUrl ? normalizeUrl(logoUrl) : null,
        imageUrls: imageUrls.filter(Boolean).map(normalizeUrl),

        // platforms & links
        handles,
        links:
          links.length ? links.map((l) => ({ label: (l.label || "").trim(), url: normalizeUrl(l.url || "") })) : null,

        // NEW: public slug (server will validate & ensure uniqueness anyway)
        slug: toKebab(slug),
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const text = (json && (json.error || json.message)) || `Save failed (HTTP ${res.status}).`;
        throw new Error(text);
      }

      // Server returns either the profile or { ok, profile }
      const finalSlug: string | undefined =
        json?.profile?.slug || json?.slug || payload.slug || toKebab(displayName || legalName || "");

      if (!finalSlug) {
        toast("Saved ✓", "success");
        return;
      }

      setSavedSlug(finalSlug);

      // Copy to clipboard, toast, then auto-redirect
      const publicUrl = `${window.location.origin}/p/${finalSlug}`;
      try {
        await navigator.clipboard.writeText(publicUrl);
        toast("Saved ✓ — URL copied. Redirecting…", "success");
      } catch {
        toast("Saved ✓ — Redirecting…", "success");
      }

      setTimeout(() => {
        window.location.assign(publicUrl);
      }, 1200);
    } catch (e: any) {
      toast(e?.message || "Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function copyUrl() {
    if (!savedSlug) return;
    const url = `${window.location.origin}/p/${savedSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("URL copied to clipboard.", "success");
    } catch {
      toast("Could not copy URL.", "error");
    }
  }

  /** ---- Small UI helpers ---- */
  const input = "w-full border rounded-lg px-3 py-2";
  const label = "text-sm font-medium text-gray-700";
  const row = "grid gap-2";

  return (
    <div className="max-w-2xl grid gap-8">
      {/* Identity */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Identity</h2>

        <div className={row}>
          <label className={label} htmlFor="displayName">
            Display name *
          </label>
          <input
            id="displayName"
            className={input}
            placeholder="Kings Anesthesia"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={row}>
            <label className={label} htmlFor="legalName">
              Legal/brand name (if different)
            </label>
            <input
              id="legalName"
              className={input}
              placeholder="Kings Anesthesia LLC"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              maxLength={160}
            />
          </div>
          <div className={row}>
            <label className={label} htmlFor="entityType">
              Entity type
            </label>
            <select
              id="entityType"
              className={input}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as EntityType)}
            >
              <option value="">Select…</option>
              <option>Business</option>
              <option>Local Service</option>
              <option>Organization</option>
              <option>Creator / Person</option>
            </select>
          </div>
        </div>

        {/* NEW: Slug */}
        <div className={row}>
          <label className={label} htmlFor="slug">
            Public URL slug
          </label>
          <div className="flex items-center gap-2">
            <input
              id="slug"
              className={input + " font-mono"}
              placeholder="kings-anesthesia"
              value={slug}
              onChange={(e) => {
                userTouchedSlug.current = true;
                setSlug(toKebab(e.target.value));
              }}
              maxLength={80}
            />
            <span
              className={
                slugAvail === "ok"
                  ? "text-green-600 text-sm"
                  : slugAvail === "taken"
                  ? "text-red-600 text-sm"
                  : "text-gray-500 text-sm"
              }
            >
              {slugAvail === "ok"
                ? "✓ available"
                : slugAvail === "taken"
                ? "× taken"
                : slugAvail === "checking"
                ? "…"
                : ""}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Public page will be <code>/p/{slug || "your-slug"}</code>
          </p>
        </div>
      </section>

      {/* Tagline & Bio */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Tagline & Bio</h2>

        <div className={row}>
          <label className={label} htmlFor="tagline">
            Tagline
          </label>
          <input
            id="tagline"
            className={input}
            placeholder="Ambulatory anesthesia in New Jersey."
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={160}
          />
        </div>

        <div className={row}>
          <label className={label} htmlFor="bio">
            Bio / About
          </label>
          <textarea
            id="bio"
            className={input}
            rows={6}
            placeholder="2–3 sentences describing what you do, who you serve, and what makes you credible."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
          />
        </div>
      </section>

      {/* Website, Location, Service area */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Website, Location & Reach</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={row}>
            <label className={label} htmlFor="website">
              Website
            </label>
            <input
              id="website"
              className={input}
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={200}
            />
            <small className="text-xs text-gray-500">
              Optional, but strongly recommended for better AI ranking.
            </small>
          </div>

          <div className={row}>
            <label className={label} htmlFor="location">
              Location (address or city/state)
            </label>
            <input
              id="location"
              className={input}
              placeholder="Wyckoff, NJ"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
            />
          </div>
        </div>

        <div className={row}>
          <label className={label} htmlFor="serviceArea">
            Service area (comma-separated regions)
          </label>
          <input
            id="serviceArea"
            className={input}
            placeholder="NJ, NY, PA"
            value={serviceArea}
            onChange={(e) => setServiceArea(e.target.value)}
            maxLength={240}
          />
        </div>
      </section>

      {/* Trust & Authority */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Trust & Authority</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={row}>
            <label className={label} htmlFor="foundedYear">
              Founded / started (year)
            </label>
            <input
              id="foundedYear"
              className={input}
              inputMode="numeric"
              placeholder="2020"
              value={foundedYear}
              onChange={(e) => setFoundedYear(e.target.value)}
              maxLength={4}
            />
          </div>
          <div className={row}>
            <label className={label} htmlFor="teamSize">
              Team size
            </label>
            <input
              id="teamSize"
              className={input}
              inputMode="numeric"
              placeholder="5"
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              maxLength={6}
            />
          </div>
          <div className={row}>
            <label className={label} htmlFor="pricingModel">
              Pricing model
            </label>
            <select
              id="pricingModel"
              className={input}
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value as any)}
            >
              <option value="">Select…</option>
              <option>Free</option>
              <option>Subscription</option>
              <option>One-time</option>
              <option>Custom</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={row}>
            <label className={label} htmlFor="languages">
              Languages served (comma-separated)
            </label>
            <input
              id="languages"
              className={input}
              placeholder="English, Spanish"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className={row}>
            <label className={label} htmlFor="hours">
              Hours of operation
            </label>
            <input
              id="hours"
              className={input}
              placeholder="Mon–Fri 9am–5pm"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              maxLength={160}
            />
          </div>
        </div>

        <div className={row}>
          <label className={label} htmlFor="certs">
            Certifications / licenses / awards (optional)
          </label>
          <textarea
            id="certs"
            className={input}
            rows={3}
            placeholder="e.g., Board-certified anesthesiologist; AAAHC accredited facility."
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            maxLength={2000}
          />
        </div>

        {/* Press */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <span className={label}>Press & directory mentions</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={input}
              placeholder="Title (e.g., NJ.com feature)"
              value={pressDraft.title}
              onChange={(e) => setPressDraft({ ...pressDraft, title: e.target.value })}
              maxLength={120}
            />
            <input
              className={input}
              placeholder="https://link-to-article.com"
              value={pressDraft.url}
              onChange={(e) => setPressDraft({ ...pressDraft, url: e.target.value })}
              maxLength={300}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-2 border rounded-lg"
              onClick={() => {
                if (!pressDraft.title || !pressDraft.url) return;
                setPress((p) => [...p, pressDraft]);
                setPressDraft({ title: "", url: "" });
              }}
            >
              + Add press link
            </button>
            {press.length > 0 && (
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => setPress([])}
              >
                Clear
              </button>
            )}
          </div>
          {press.length > 0 && (
            <ul className="list-disc pl-6 text-sm">
              {press.map((p, i) => (
                <li key={i}>
                  <span className="font-medium">{p.title}</span> — {p.url}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Branding & Media */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Branding & Media</h2>

        <div className={row}>
          <label className={label} htmlFor="logoUrl">
            Logo URL
          </label>
          <input
            id="logoUrl"
            className={input}
            placeholder="https://cdn.example.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            maxLength={300}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {imageUrls.map((u, i) => (
            <div className={row} key={i}>
              <label className={label} htmlFor={`img${i}`}>
                Image {i + 1} URL
              </label>
              <input
                id={`img${i}`}
                className={input}
                placeholder="https://cdn.example.com/photo.jpg"
                value={u}
                onChange={(e) => {
                  const copy = [...imageUrls];
                  copy[i] = e.target.value;
                  setImageUrls(copy);
                }}
                maxLength={300}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Platform Handles */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Platform Handles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ["youtube", "YouTube channel URL"],
            ["tiktok", "TikTok profile URL"],
            ["instagram", "Instagram profile URL"],
            ["substack", "Substack URL"],
            ["etsy", "Etsy shop URL"],
            ["x", "X (Twitter) profile URL"],
            ["linkedin", "LinkedIn page URL"],
            ["facebook", "Facebook page URL"],
            ["github", "GitHub org/user URL"],
          ] as const).map(([key, label]) => (
            <div className={row} key={key}>
              <label className={label}>{label}</label>
              <input
                className={input}
                placeholder="https://..."
                value={(handles as any)[key] || ""}
                onChange={(e) => setHandles((h) => ({ ...h, [key]: e.target.value }))}
                maxLength={300}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Links</h2>

        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className={input}
              placeholder="Label (e.g., Reviews)"
              value={linkDraft.label}
              onChange={(e) => setLinkDraft({ ...linkDraft, label: e.target.value })}
              maxLength={60}
            />
            <div className="flex gap-2">
              <input
                className={input}
                placeholder="https://link.com"
                value={linkDraft.url}
                onChange={(e) => setLinkDraft({ ...linkDraft, url: e.target.value })}
                maxLength={300}
              />
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => {
                  if (!linkDraft.label || !linkDraft.url) return;
                  setLinks((l) => [...l, linkDraft]);
                  setLinkDraft({ label: "", url: "" });
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {links.length > 0 && (
            <ul className="list-disc pl-6 text-sm">
              {links.map((l, i) => (
                <li key={i}>
                  <span className="font-medium">{l.label}</span> — {l.url}
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <div>
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => setLinks([])}
              >
                Clear links
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900 transition-colors duration-200 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>

        {/* Copy URL appears after successful save */}
        {savedSlug ? (
          <button
            type="button"
            onClick={copyUrl}
            className="px-3 py-2 border rounded-lg"
          >
            Copy URL
          </button>
        ) : null}
      </div>

      {/* NOTE: No legal/footer links are rendered here.
          The only footer row lives in app/layout.tsx */}
    </div>
  );
}
