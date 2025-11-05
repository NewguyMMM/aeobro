// components/ProfileEditor.tsx
// 📅 Updated: 2025-11-05 06:00 ET
"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

// Helper UI components
import EntityTypeHelp from "@/components/EntityTypeHelp";
import LogoUploader from "@/components/LogoUploader";
import LinkTypeSelect from "@/components/LinkTypeSelect";
import PublicUrlReadonly from "@/components/PublicUrlReadonly";
import SchemaPreviewButton from "@/components/SchemaPreviewButton";

// Load the verification UI purely on the client (single source of truth at bottom)
import dynamic from "next/dynamic";
const VerificationCard = dynamic(() => import("@/components/VerificationCard"), { ssr: false });

/** -------- Types -------- */
type EntityType =
  | "Business"
  | "Local Service"
  | "Organization"
  | "Creator / Person"
  | "Product";

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

type VerificationStatus = "UNVERIFIED" | "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED";

type Profile = {
  id?: string | null;
  displayName?: string | null;
  tagline?: string | null;
  location?: string | null;
  website?: string | null;
  bio?: string | null;
  links?: LinkItem[] | null;
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
  slug?: string | null;
  verificationStatus?: VerificationStatus | null;
};

/** -------- Utils -------- */
function normalizeUrl(value: string): string {
  const v = (value || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
function isValidUrl(u: string): boolean {
  if (!u) return true;
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

/** -------- Component -------- */
export default function ProfileEditor({ initial }: { initial: Profile | null }) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const toast = useToast();

  // ---- Server identifiers
  const [profileId, setProfileId] = React.useState<string | null>(initial?.id ?? null);
  const [serverSlug, setServerSlug] = React.useState<string | null>(initial?.slug ?? null);

  // ---- Verification status
  const [verificationStatus, setVerificationStatus] = React.useState<VerificationStatus>(
    (initial?.verificationStatus as VerificationStatus) ?? "UNVERIFIED"
  );

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

  // ---- UI
  const [saving, setSaving] = React.useState(false);
  const [savedSlug, setSavedSlug] = React.useState<string | null>(null);
  const prefilledRef = React.useRef(false);

  // ---- Dirty tracking
  const lastSavedRef = React.useRef<string>("");
  const [dirty, setDirty] = React.useState<boolean>(false);

  // ---- Modal for viewing with unsaved changes
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // ---- Plan pill (Lite/Pro/Business)
  type PlanTitle = "Lite" | "Pro" | "Business";
  const [plan, setPlan] = React.useState<PlanTitle | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/account", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const p = j?.plan as PlanTitle | undefined;
        if (!cancelled && (p === "Lite" || p === "Pro" || p === "Business")) {
          setPlan(p);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** ---- Build a normalized payload ---- */
  const buildPayload = React.useCallback((): Profile => {
    return {
      displayName: (displayName || "").trim(),
      legalName: (legalName || "").trim() || null,
      entityType: (entityType as EntityType) || null,
      tagline: (tagline || "").trim() || null,
      bio: (bio || "").trim() || null,
      website: website ? normalizeUrl(website) : null,
      location: (location || "").trim() || null,
      serviceArea: fromCsv(serviceArea),
      foundedYear: toNum(foundedYear) ?? null,
      teamSize: toNum(teamSize) ?? null,
      languages: fromCsv(languages),
      pricingModel: (pricingModel as any) || null,
      hours: (hours || "").trim() || null,
      certifications: (certifications || "").trim() || null,
      press: press.length
        ? press.map((p) => ({ title: (p.title || "").trim(), url: normalizeUrl(p.url || "") }))
        : null,
      logoUrl: logoUrl ? normalizeUrl(logoUrl) : null,
      imageUrls: imageUrls.filter(Boolean).map(normalizeUrl),
      handles,
      links:
        links.length
          ? links.map((l) => ({ label: (l.label || "").trim(), url: normalizeUrl(l.url || "") }))
          : null,
    };
  }, [
    displayName, legalName, entityType, tagline, bio, website, location, serviceArea,
    foundedYear, teamSize, languages, pricingModel, hours, certifications, press,
    logoUrl, imageUrls, handles, links,
  ]);

  /** ---- Prefill from API on mount ---- */
  React.useEffect(() => {
    if (prefilledRef.current) return;
    prefilledRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data: Profile | null = await res.json();
        if (!data) return;

        if (data.id) setProfileId(data.id);

        if (data.displayName != null) setDisplayName(data.displayName || "");
        if (data.legalName != null) setLegalName(data.legalName || "");
        if (data.entityType) setEntityType(data.entityType);

        if (data.tagline != null) setTagline(data.tagline || "");
        if (data.bio != null) setBio(data.bio || "");

        if (data.website != null) setWebsite(data.website || "");
        if (data.location != null) setLocation(data.location || "");
        if (data.serviceArea) setServiceArea(toCsv(data.serviceArea));

        if (data.foundedYear != null) setFoundedYear(String(data.foundedYear || ""));
        if (data.teamSize != null) setTeamSize(String(data.teamSize || ""));
        if (data.languages) setLanguages(toCsv(data.languages));
        if (data.pricingModel) setPricingModel(data.pricingModel as any);
        if (data.hours != null) setHours(data.hours || "");

        if (data.certifications != null) setCertifications(data.certifications || "");
        if (data.press) setPress(data.press);

        if (data.logoUrl != null) setLogoUrl(data.logoUrl || "");
        if (data.imageUrls && data.imageUrls.length) setImageUrls(data.imageUrls);

        if (data.handles) setHandles(data.handles);
        if (data.links) setLinks(data.links || []);

        setServerSlug(data.slug || null);
        setVerificationStatus((data.verificationStatus as VerificationStatus) ?? "UNVERIFIED");

        const snapshot = JSON.stringify(buildPayload());
        lastSavedRef.current = snapshot;
        setDirty(false);
      } catch {
        /* silent */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ---- Dirty detection ---- */
  React.useEffect(() => {
    const current = JSON.stringify(buildPayload());
    setDirty(current !== lastSavedRef.current);
  }, [buildPayload]);

  /** ---- Save & Publish ---- */
  async function save() {
    setSaving(true);
    setSavedSlug(null);
    try {
      if (!displayName.trim()) throw new Error("Display name is required.");

      if (website && !isValidUrl(normalizeUrl(website))) {
        throw new Error("Website must be a valid URL (https://example.com).");
      }
      if (logoUrl && !isValidUrl(normalizeUrl(logoUrl))) {
        throw new Error("Logo URL must be a valid URL.");
      }
      for (const u of imageUrls) {
        if (u && !isValidUrl(normalizeUrl(u))) throw new Error("Every image URL must be valid.");
      }
      for (const p of press) {
        if (p.url && !isValidUrl(normalizeUrl(p.url))) throw new Error("Press links must be valid URLs.");
      }
      for (const l of links) {
        if (l.url && !isValidUrl(normalizeUrl(l.url))) throw new Error("Extra links must be valid URLs.");
      }

      const payload = buildPayload();

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

      const finalSlug: string | undefined = json?.profile?.slug || json?.slug || undefined;
      const finalId: string | undefined = json?.profile?.id || json?.id || profileId || undefined;
      const finalStatus: VerificationStatus | undefined =
        (json?.profile?.verificationStatus || json?.verificationStatus) as VerificationStatus | undefined;

      if (finalId) setProfileId(finalId);
      if (finalSlug) {
        setSavedSlug(finalSlug);
        setServerSlug(finalSlug);
      }
      if (finalStatus) setVerificationStatus(finalStatus);

      lastSavedRef.current = JSON.stringify(payload);
      setDirty(false);

      const publicUrl = `${window.location.origin}/p/${finalSlug || finalId}`;
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

  /** ---- Copy URL ---- */
  async function copyUrl() {
    const target = getPublicPath();
    if (!target) return;
    const url = `${window.location.origin}${target}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("URL copied to clipboard.", "success");
    } catch {
      toast("Could not copy URL.", "error");
    }
  }

  /** ---- Public path resolver ---- */
  function getPublicPath(): string | null {
    const liveSlug = savedSlug || serverSlug || null;
    const idFallback = profileId || null;
    if (liveSlug) return `/p/${liveSlug}`;
    if (idFallback) return `/p/${idFallback}`;
    return null;
  }

  /** ---- Status pill ---- */
  const hasEverSaved = Boolean(serverSlug || profileId);
  const status = !hasEverSaved ? "Not yet published" : dirty ? "Unsaved changes" : "Published";
  const statusClasses =
    status === "Published"
      ? "bg-green-100 text-green-700 ring-1 ring-green-200"
      : status === "Unsaved changes"
      ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200"
      : "bg-gray-100 text-gray-700 ring-1 ring-gray-200";

  /** ---- Small UI helpers ---- */
  const input = "w-full border rounded-lg px-3 py-2";
  const label = "text-sm font-medium text-gray-700";
  const row = "grid gap-2";

  return (
    <div className="max-w-2xl grid gap-8">
      {/* Top note + plan pill */}
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-600">
          Only <span className="font-medium">Display name</span> is required to publish.
          Add more when you’re ready — the more details you include, the better your AI visibility.
        </p>
        {plan && (
          <span
            className="inline-flex items-center rounded-full bg-gray-50 text-gray-800 border border-gray-200 px-3 py-1 text-xs font-medium"
            title="Your current AEOBRO plan"
          >
            {plan} plan
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {email ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span className="font-medium">{email}</span>
              <span
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700"
                title="This email is private and is NOT shown on your public profile. Only information you enter below appears publicly."
                aria-label="This email is private and not shown on your public profile."
              >
                i
              </span>
            </span>
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full ${statusClasses}`}>{status}</span>
          <button
            type="button"
            onClick={() => {
              if (dirty) setConfirmOpen(true);
              else {
                const path = getPublicPath();
                if (!path) {
                  toast("Not yet published — please Save & Publish first.", "error");
                  return;
                }
                window.open(path, "_blank", "noopener,noreferrer");
              }
            }}
            className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            View public profile
          </button>
        </div>
      </div>

      {/* Identity */}
      <section className="grid gap-4">
        <h3 className="text-lg font-semibold">Identity</h3>
        <div className={row}>
          <label className={label} htmlFor="displayName">Display name *</label>
          <input
            id="displayName"
            className={input}
            placeholder="Your public display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={row}>
            <label className={label} htmlFor="legalName">Legal/brand name (if different)</label>
            <input
              id="legalName"
              className={input}
              placeholder="Legal or brand name (optional)"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              maxLength={160}
            />
          </div>
          <div className={row}>
            <label className={label} htmlFor="entityType">
              Entity type <EntityTypeHelp />
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
              <option>Product</option>
            </select>
          </div>
        </div>

        {/* Public URL (read-only) */}
        <div className="mt-2">
          <PublicUrlReadonly slug={serverSlug} />
        </div>
      </section>

      {/* Tagline & Bio */}
      <section className="grid gap-4">
        <h3 className="text-lg font-semibold">Tagline & Bio</h3>
        <div className={row}>
          <label className={label + " overflow-visible"} htmlFor="tagline">
            One-line Summary
            <span className="relative group ml-1 cursor-help align-middle">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">i</span>
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-64 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                A one-line summary of your brand or work. Example: “Handmade jewelry for everyday wear”.
              </span>
            </span>
          </label>
          <input
            id="tagline"
            className={input}
            placeholder="e.g., AI tools for small businesses"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={160}
          />
        </div>
        <div className={row}>
          <label className={label} htmlFor="bio">Bio / About</label>
          <textarea
            id="bio"
            className={input}
            rows={6}
            placeholder="Tell people what you do, who you serve, and what makes you credible."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
          />
        </div>
      </section>

      {/* Website, Location, Service area */}
      <section className="grid gap-4">
        <h3 className="text-lg font-semibold">Website, Location & Reach</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={row}>
            <label className={label} htmlFor="website">Website</label>
            <input
              id="website"
              className={input}
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={200}
            />
            <small className="text-xs text-gray-500">Optional, but recommended for better AI ranking.</small>
          </div>
          <div className={row}>
            <label className={label} htmlFor="location">Location (address or city/state)</label>
            <input
              id="location"
              className={input}
              placeholder="City, state (or address)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
            />
          </div>
        </div>
        <div className={row}>
          <label className={label} htmlFor="serviceArea">Service area (comma-separated regions)</label>
          <input
            id="serviceArea"
            className={input}
            placeholder="Regions you serve (comma-separated)"
            value={serviceArea}
            onChange={(e) => setServiceArea(e.target.value)}
            maxLength={240}
          />
        </div>
      </section>

      {/* Trust & Authority */}
      <section className="grid gap-4">
        <h3 className="text-lg font-semibold">Trust & Authority</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={row}>
            <label className={label} htmlFor="foundedYear">Founded / started (year)</label>
            <input
              id="foundedYear"
              className={input}
              inputMode="numeric"
              placeholder="e.g., 2020"
              value={foundedYear}
              onChange={(e) => setFoundedYear(e.target.value)}
              maxLength={4}
            />
          </div>
          <div className={row}>
            <label className={label} htmlFor="teamSize">Team size</label>
            <input
              id="teamSize"
              className={input}
              inputMode="numeric"
              placeholder="e.g., 5"
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              maxLength={6}
            />
          </div>
          <div className={row}>
            <label className={label} htmlFor="pricingModel">Pricing model</label>
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
            <label className={label} htmlFor="languages">Languages served (comma-separated)</label>
            <input
              id="languages"
              className={input}
              placeholder="e.g., English, Spanish"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className={row}>
            <label className={label} htmlFor="hours">Hours of operation</label>
            <input
              id="hours"
              className={input}
              placeholder="e.g., Mon–Fri 9am–5pm"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              maxLength={160}
            />
          </div>
        </div>
        <div className={row}>
          <label className={label} htmlFor="certs">Certifications / licenses / awards (optional)</label>
          <textarea
            id="certs"
            className={input}
            rows={3}
            placeholder="e.g., Board-certified; industry accreditations; notable awards."
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
              placeholder="Title of mention or article"
              value={pressDraft.title}
              onChange={(e) => setPressDraft({ ...pressDraft, title: e.target.value })}
              maxLength={120}
            />
            <input
              className={input}
              placeholder="https://your-article-or-listing.com"
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
        <h3 className="text-lg font-semibold">Branding & Media</h3>
        <div className={row}>
          <label className={label} htmlFor="logoUploader">Logo</label>
          <LogoUploader value={logoUrl} onChange={(url) => setLogoUrl(url)} />
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Or paste a logo URL</label>
            <input
              id="logoUrl"
              className={input}
              placeholder="https://cdn.example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              maxLength={300}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {imageUrls.map((u, i) => (
            <div className={row} key={i}>
              <label className={label} htmlFor={`img${i}`}>Image {i + 1} URL</label>
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
        <h3 className="text-lg font-semibold">Platform Handles</h3>
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
          ] as const).map(([key, labelTxt]) => (
            <div className={row} key={key}>
              <label className={label}>{labelTxt}</label>
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
        <h3 className="text-lg font-semibold">Links</h3>
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-3 items-start">
            <div className="grid gap-2">
              <label className={label}>Label</label>
              <div className="flex gap-2">
                <input
                  className={input}
                  placeholder="Link label (e.g., Reviews)"
                  value={linkDraft.label}
                  onChange={(e) => setLinkDraft({ ...linkDraft, label: e.target.value })}
                  maxLength={60}
                />
                <LinkTypeSelect onPick={(lbl) => setLinkDraft((d) => ({ ...d, label: lbl }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <label className={label}>URL</label>
              <input
                className={input}
                placeholder="https://your-link.com"
                value={linkDraft.url}
                onChange={(e) => setLinkDraft({ ...linkDraft, url: e.target.value })}
                maxLength={300}
              />
            </div>
            <div className="grid gap-2">
              <label className="opacity-0 select-none">Add</label>
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

      {/* Save / Publish */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900 transition-colors duration-200 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save & Publish"}
          </button>

          {getPublicPath() ? (
            <button type="button" onClick={copyUrl} className="px-3 py-2 border rounded-lg">
              Copy URL
            </button>
          ) : null}

          <a href="#verify" className="ml-auto text-sm text-blue-600 underline hover:text-blue-700">
            Go to Verify ↓
          </a>
        </div>
        <p className="text-xs text-gray-500">
          Your changes go live immediately when you <span className="font-medium">Save &amp; Publish</span>.
        </p>
      </div>

      {/* JSON-LD Preview */}
      <div className="mt-4">
        {serverSlug || profileId ? (
          <SchemaPreviewButton
            slug={(serverSlug as string) || (profileId as string)}
            includeAll={true}
            pretty={true}
          />
        ) : (
          <button
            className="px-3 py-2 border rounded-lg opacity-60 cursor-not-allowed"
            title="Save & Publish first to enable JSON-LD preview"
            disabled
          >
            Preview &amp; Copy JSON-LD
          </button>
        )}
      </div>

      {/* Unsaved changes modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="bg-white rounded-xl shadow-lg p-5 w-[min(92vw,480px)]">
            <h4 className="text-base font-semibold mb-2">You have unsaved changes</h4>
            <p className="text-sm text-gray-600 mb-4">
              The public profile you’re about to view shows the <span className="font-medium">last published</span> version.
              To include your edits, click <span className="font-medium">Save &amp; View</span>.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => {
                  const path = getPublicPath();
                  if (!path) {
                    toast("Not yet published — please Save & Publish first.", "error");
                    return;
                  }
                  window.open(path, "_blank", "noopener,noreferrer");
                }}
              >
                View Anyway
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-black text-white hover:bg-gray-900"
                onClick={async () => {
                  setConfirmOpen(false);
                  await save();
                }}
              >
                Save &amp; View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- SINGLE VERIFY SECTION (always at bottom) ---- */}
      <section id="verify" className="scroll-mt-24">
        <VerificationCard
          profileId={profileId ?? undefined}
          initialDomain={website ?? ""}
          initialStatus={verificationStatus as any}
        />
      </section>
    </div>
  );
}
