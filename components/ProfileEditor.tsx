// components/ProfileEditor.tsx
"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

// Helper UI components
import EntityTypeHelp from "@/components/EntityTypeHelp";
import LogoUploader from "@/components/LogoUploader";
import LinkTypeSelect from "@/components/LinkTypeSelect";
import PublicUrlReadonly from "@/components/PublicUrlReadonly";

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

type PlanTitle = "Lite" | "Pro" | "Business";

type Profile = {
  // server identity
  id?: string | null;

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

  // public slug (server-generated)
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

/** -------- Component -------- */
export default function ProfileEditor({ initial }: { initial: Profile | null }) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";
  const toast = useToast();

  // ---- Server identifiers
  const [profileId, setProfileId] = React.useState<string | null>(initial?.id ?? null);
  const [serverSlug, setServerSlug] = React.useState<string | null>(initial?.slug ?? null);

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
  const [savedSlug, setSavedSlug] = React.useState<string | null>(null); // for Copy URL + redirect
  const prefilledRef = React.useRef(false); // ensure we prefill only once

  // ---- Dirty tracking
  const lastSavedRef = React.useRef<string>(""); // JSON string of last-saved payload
  const [dirty, setDirty] = React.useState<boolean>(false);

  // ---- Unsaved changes modal
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // ---- Plan/Tier (best-effort; hides if endpoint not present)
  const [plan, setPlan] = React.useState<PlanTitle | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const candidates = ["/api/account", "/api/me", "/api/user", "/api/plan"];
      for (const path of candidates) {
        try {
          const r = await fetch(path, { cache: "no-store" });
          if (!r.ok) continue;
          const j = await r.json();
          const p = (j?.plan || j?.tier || j?.data?.plan) as PlanTitle | undefined;
          if (p && ["Lite", "Pro", "Business"].includes(p) && !cancelled) {
            setPlan(p);
            break;
          }
        } catch {
          // ignore and try next
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** ---- Build a normalized payload (used for save + dirty detection) ---- */
  const buildPayload = React.useCallback((): Profile => {
    return {
      // identity
      displayName: (displayName || "").trim(),
      legalName: (legalName || "").trim() || null,
      entityType: (entityType as EntityType) || null,

      // story
      tagline: (tagline || "").trim() || null,
      bio: (bio || "").trim() || null,

      // anchors
      website: website ? normalizeUrl(website) : null,
      location: (location || "").trim() || null,
      serviceArea: fromCsv(serviceArea),

      // trust
      foundedYear: toNum(foundedYear) ?? null,
      teamSize: toNum(teamSize) ?? null,
      languages: fromCsv(languages),
      pricingModel: (pricingModel as any) || null,
      hours: (hours || "").trim() || null,

      certifications: (certifications || "").trim() || null,
      press: press.length
        ? press.map((p) => ({ title: (p.title || "").trim(), url: normalizeUrl(p.url || "") }))
        : null,

      // branding
      logoUrl: logoUrl ? normalizeUrl(logoUrl) : null,
      imageUrls: imageUrls.filter(Boolean).map(normalizeUrl),

      // platforms & links
      handles,
      links:
        links.length
          ? links.map((l) => ({
              label: (l.label || "").trim(),
              url: normalizeUrl(l.url || ""),
            }))
          : null,

      // NOTE: No client-side 'slug'—server generates & de-conflicts it.
    };
  }, [
    displayName,
    legalName,
    entityType,
    tagline,
    bio,
    website,
    location,
    serviceArea,
    foundedYear,
    teamSize,
    languages,
    pricingModel,
    hours,
    certifications,
    press,
    logoUrl,
    imageUrls,
    handles,
    links,
  ]);

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

        // IDs
        if (data.id) setProfileId(data.id);

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
        if (data.pricingModel) setPricingModel(data.pricingModel as any);
        if (data.hours != null) setHours(data.hours || "");

        if (data.certifications != null) setCertifications(data.certifications || "");
        if (data.press) setPress(data.press);

        // Branding
        if (data.logoUrl != null) setLogoUrl(data.logoUrl || "");
        if (data.imageUrls && data.imageUrls.length) setImageUrls(data.imageUrls);

        // Platforms & links
        if (data.handles) setHandles(data.handles);
        if (data.links) setLinks(data.links || []);

        // Slug from server (for public URL display / navigation)
        setServerSlug(data.slug || null);

        // Initialize lastSaved snapshot for dirty tracking
        const snapshot = JSON.stringify(buildPayload());
        lastSavedRef.current = snapshot;
        setDirty(false);
      } catch {
        // silent fail is fine for prefill
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ---- Dirty detection on any change ---- */
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

      // Server returns either the profile or { ok, profile }
      const finalSlug: string | undefined = json?.profile?.slug || json?.slug || undefined;
      const finalId: string | undefined = json?.profile?.id || json?.id || profileId || undefined;

      if (finalId) setProfileId(finalId);
      if (finalSlug) {
        setSavedSlug(finalSlug);
        setServerSlug(finalSlug);
      }

      // Update dirty baseline to current payload
      lastSavedRef.current = JSON.stringify(payload);
      setDirty(false);

      // Copy to clipboard, toast, then auto-redirect to public page (current behavior)
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

  /** ---- Copy URL (after save) ---- */
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

  /** ---- View public profile with guard if dirty ---- */
  function handleViewPublic() {
    if (dirty) setConfirmOpen(true);
    else openPublic();
  }

  function openPublic() {
    const path = getPublicPath();
    if (!path) {
      toast("Not yet published — please Save & Publish first.", "error");
      return;
    }
    window.open(path, "_blank", "noopener,noreferrer");
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
      {/* Title + plan */}
      <div className="flex items-start justify-between">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold">Your AI Ready Profile</h2>
          <p className="text-sm text-gray-600">
            Only <span className="font-medium">Display name</span> is required to publish.
            Add more when you’re ready — the more details you include, the better your AI visibility.
          </p>
        </div>
        {plan && (
          <span
            className="inline-flex items-center rounded-full bg-gray-50 text-gray-800 border border-gray-200 px-3 py-1 text-xs font-medium"
            title="Your current AEOBRO plan"
          >
            {plan} plan
          </span>
        )}
      </div>

      {/* Toolbar: left = account email pill; right = status + guarded View link */}
      <div className="flex items-center justify-between">
        {/* Signed-in email pill with hover note */}
        {email ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700">
              <svg
                aria-hidden="true"
               
