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

  // ---- Dirty tracking
  const lastSavedRef = React.useRef<string>(""); // JSON string of last-saved payload
  const [dirty, setDirty] = React.useState<boolean>(false);

  // ---- Modal for viewing with unsaved changes
  const [confirmOpen, setConfirmOpen] = React.useState(false);

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

      // NEW: public slug (server will validate & ensure uniqueness anyway)
      slug: toKebab(slug),
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
    slug,
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

        // Slug
        const effective = toKebab(data.slug || data.displayName || data.legalName || "");
        if (!userTouchedSlug.current) setSlug(effective);
        setServerSlug(data.slug || null);

        // Initialize lastSaved snapshot for dirty tracking
        const snapshot = JSON.stringify({
          ...(buildPayload() as any),
          // ensure slug snapshot uses the server/effective value
          slug: effective,
        });
        lastSavedRef.current = snapshot;
        setDirty(false);
      } catch {
        // silent fail is fine for prefill
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ---- Auto-suggest slug from displayName/legalName unless user edits manually ---- */
  React.useEffect(() => {
    if (userTouchedSlug.current) return;
    const suggestion = toKebab(displayName || legalName || "");
    if (suggestion) setSlug(suggestion);
  }, [displayName, legalName]);

  /** ---- Debounced availability check (keeps your existing endpoint) ---- */
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
      const finalSlug: string | undefined =
        json?.profile?.slug || json?.slug || payload.slug || toKebab(displayName || legalName || "");
      const finalId: string | undefined = json?.profile?.id || json?.id || profileId || undefined;

      if (finalId) setProfileId(finalId);
      if (finalSlug) {
        setSavedSlug(finalSlug);
        setServerSlug(finalSlug);
      }

      // Update dirty baseline to current payload
      lastSavedRef.current = JSON.stringify({ ...payload, slug: finalSlug || payload.slug });
      setDirty(false);

      // Copy to clipboard, toast, then auto-redirect to public page (current behavior)
      const publicUrl = `${window.l
