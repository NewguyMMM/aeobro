// components/ProfileEditor.tsx
"use client";

import * as React from "react";
import { toKebab } from "@/lib/slug";
import { useToast } from "@/components/Toast";

// NEW: helper UI components
import EntityTypeHelp from "@/components/EntityTypeHelp";
import LogoUploader from "@/components/LogoUploader";
import LinkTypeSelect from "@/components/LinkTypeSelect";

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
  return (s || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
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

  // Server identifiers
  const [profileId, setProfileId] = React.useState<string | null>(initial?.id ?? null);
  const [serverSlug, setServerSlug] = React.useState<string | null>(initial?.slug ?? null);

  // Core identity
  const [displayName, setDisplayName] = React.useState(initial?.displayName ?? "");
  const [legalName, setLegalName] = React.useState(initial?.legalName ?? "");
  const [entityType, setEntityType] = React.useState<EntityType | "">(
    (initial?.entityType as EntityType) ?? ""
  );

  // Story
  const [tagline, setTagline] = React.useState(initial?.tagline ?? "");
  const [bio, setBio] = React.useState(initial?.bio ?? "");

  // Anchors
  const [website, setWebsite] = React.useState(initial?.website ?? "");
  const [location, setLocation] = React.useState(initial?.location ?? "");
  const [serviceArea, setServiceArea] = React.useState(toCsv(initial?.serviceArea));

  // Trust
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

  // Branding
  const [logoUrl, setLogoUrl] = React.useState(initial?.logoUrl ?? "");
  const [imageUrls, setImageUrls] = React.useState<string[]>(
    initial?.imageUrls && initial.imageUrls.length ? initial.imageUrls : ["", "", ""]
  );

  // Platforms
  const [handles, setHandles] = React.useState<PlatformHandles>(initial?.handles ?? {});
  const [links, setLinks] = React.useState<LinkItem[]>(initial?.links ?? []);
  const [linkDraft, setLinkDraft] = React.useState<LinkItem>({ label: "", url: "" });

  // Slug
  const [slug, setSlug] = React.useState<string>(
    toKebab(initial?.slug || initial?.displayName || initial?.legalName || "")
  );
  const [slugAvail, setSlugAvail] = React.useState<"idle" | "checking" | "ok" | "taken">("idle");
  const userTouchedSlug = React.useRef(false);

  // UI
  const [saving, setSaving] = React.useState(false);
  const [savedSlug, setSavedSlug] = React.useState<string | null>(null);
  const prefilledRef = React.useRef(false);

  // Dirty tracking
  const lastSavedRef = React.useRef<string>("");
  const [dirty, setDirty] = React.useState<boolean>(false);

  // Modal
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Payload builder
  const buildPayload = React.useCallback((): Profile => ({
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
    links: links.length
      ? links.map((l) => ({
          label: (l.label || "").trim(),
          url: normalizeUrl(l.url || ""),
        }))
      : null,
    slug: toKebab(slug),
  }), [
    displayName, legalName, entityType, tagline, bio, website, location,
    serviceArea, foundedYear, teamSize, languages, pricingModel, hours,
    certifications, press, logoUrl, imageUrls, handles, links, slug
  ]);

  // Prefill from API
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
        const effective = toKebab(data.slug || data.displayName || data.legalName || "");
        if (!userTouchedSlug.current) setSlug(effective);
        setServerSlug(data.slug || null);
        const snapshot = JSON.stringify({ ...(buildPayload() as any), slug: effective });
        lastSavedRef.current = snapshot;
        setDirty(false);
      } catch {}
    })();
  }, [buildPayload]);

  // Slug suggest
  React.useEffect(() => {
    if (userTouchedSlug.current) return;
    const suggestion = toKebab(displayName || legalName || "");
    if (suggestion) setSlug(suggestion);
  }, [displayName, legalName]);

  // Slug availability
  const debouncedCheckSlug = React.useMemo(
    () => debounce(async (candidate: string) => {
      if (!candidate) { setSlugAvail("idle"); return; }
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
  React.useEffect(() => { if (slug) debouncedCheckSlug(slug); }, [slug, debouncedCheckSlug]);

  // Dirty detection
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
      const payload = buildPayload();
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && (json.error || json.message)) || "Save failed.");
      const finalSlug: string | undefined =
        json?.profile?.slug || json?.slug || payload.slug || toKebab(displayName || legalName || "");
      const finalId: string | undefined = json?.profile?.id || json?.id || profileId || undefined;
      if (finalId) setProfileId(finalId);
      if (finalSlug) { setSavedSlug(finalSlug); setServerSlug(finalSlug); }
      lastSavedRef.current = JSON.stringify({ ...payload, slug: finalSlug || payload.slug });
      setDirty(false);
      const publicUrl = `${window.location.origin}/p/${finalSlug || finalId}`;
      try {
        await navigator.clipboard.writeText(publicUrl);
        toast("Saved ✓ — URL copied. Redirecting…", "success");
      } catch {
        toast("Saved ✓ — Redirecting…", "success");
      }
      setTimeout(() => { window.location.assign(publicUrl); }, 1200);
    } catch (e: any) {
      toast(e?.message || "Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  function getPublicPath(): string | null {
    const liveSlug = savedSlug || serverSlug || toKebab(slug || "");
    const idFallback = profileId || null;
    if (liveSlug) return `/p/${liveSlug}`;
    if (idFallback) return `/p/${idFallback}`;
    return null;
  }
  function openPublic() {
    const path = getPublicPath();
    if (!path) {
      toast("Not yet published — please Save & Publish first.", "error");
      return;
    }
    window.open(path, "_blank", "noopener,noreferrer");
  }
  function handleViewPublic() { if (dirty) setConfirmOpen(true); else openPublic(); }

  const hasEverSaved = Boolean(serverSlug || profileId);
  const status = !hasEverSaved ? "Not yet published" : dirty ? "Unsaved changes" : "Published";
  const statusClasses =
    status === "Published"
      ? "bg-green-100 text-green-700 ring-1 ring-green-200"
      : status === "Unsaved changes"
      ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200"
      : "bg-gray-100 text-gray-700 ring-1 ring-gray-200";

  const input = "w-full border rounded-lg px-3 py-2";
  const label = "text-sm font-medium text-gray-700";
  const row = "grid gap-2";

  return (
    <div className="max-w-2xl grid gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your AI Profile</h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full ${statusClasses}`}>{status}</span>
          <button
            type="button"
            onClick={handleViewPublic}
            className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            View public profile
          </button>
        </div>
      </div>

      {/* … keep rest of form unchanged … */}

      {/* Save */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-900 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save & Publish"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Your changes go live immediately when you <span className="font-medium">Save &amp; Publish</span>.
        </p>
      </div>

      {/* Unsaved changes modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="bg-white rounded-xl shadow-lg p-5 w-[min(92vw,480px)]">
            <h4 className="text-base font-semibold mb-2">You have unsaved changes</h4>
            <p className="text-sm text-gray-600 mb-4">
              The public profile you’re about to view shows the <span className="font-medium">last published</span> version.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="px-3 py-2 border rounded-lg" onClick={openPublic}>
                View Anyway
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-black text-white"
                onClick={async () => { setConfirmOpen(false); await save(); }}
              >
                Save &amp; View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
