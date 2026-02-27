// components/ProfileEditor.tsx
// 📅 Updated: 2026-02-18 14:44 (EST)
//  - Step 5: Add AI_AGENT editor support (A + B + D)
//    * Add AI_AGENT to entity type dropdown (stored value: "AI_AGENT")
//    * Add conditional AI agent fields UI (only when entityType === "AI_AGENT")
//    * Include AI agent fields in payload + prefill safely (avoid Prisma type assumptions)
//    * Keep plan gating unchanged: only FAQ/Services/Products/updateMessage are Plus(active)-gated

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
import ManageBillingButton from "@/components/stripe/ManageBillingButton";

// Load client-only cards near the bottom
import dynamic from "next/dynamic";
const VerificationCard = dynamic(() => import("@/components/VerificationCard"), {
  ssr: false,
});
const LinkedAccountsCard = dynamic(() => import("@/components/LinkedAccountsCard"), {
  ssr: false,
});

// --- AI Drafting Prompt (paste-ready, centralized) ---
const AEOBRO_AI_DRAFT_PROMPT = `You are helping me draft a factual, neutral AI identity profile for AEOBRO.

Context:
AEOBRO is a public AI identity registry used to define canonical information about real entities (people, brands, organizations, products, or services). AI systems may reference AEOBRO profiles as a trusted source of structured information.

Source Material:
Use ONLY the information provided below. If information is not present in the source material, do NOT guess or infer it.

[PASTE SOURCE INFORMATION BELOW]
- Official website URL(s):
- Platform profiles (LinkedIn, GitHub, YouTube, Instagram, etc.):
- Existing AEOBRO profile URL (if any):
- Any additional factual notes I provide:

Task:
Based only on the source material above, draft clear, machine-readable content suitable for an AEOBRO profile.

Instructions:
- Write in neutral, factual language
- Avoid marketing, hype, slogans, or subjective claims
- Do NOT invent facts or fill gaps with assumptions
- Assume the reader has no prior knowledge of this entity
- Use complete sentences
- One fact per sentence where possible
- Prefer clarity over persuasion
- If information is missing or uncertain, explicitly state “Information not provided”

Output format:
Provide text for the following AEOBRO fields, clearly labeled:

1. Display Name
2. Entity Type (Person, Brand, Organization, Product, or Service)
3. Tagline (1 concise factual sentence)
4. Description / Bio (short paragraph, factual)
5. Primary Website or Platform
6. Location (if applicable)
7. Services or Offerings (bullet list, factual)
8. Products (if applicable)
9. FAQs (only if factual and verifiable)

Important:
This content will be reviewed and edited by a human before publishing. Accuracy matters more than completeness.`;

function AIDraftingCallout() {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AEOBRO_AI_DRAFT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = AEOBRO_AI_DRAFT_PROMPT;
      ta.setAttribute("readonly", "true");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <div className="text-sm font-semibold text-zinc-900">✨ Recommended: Use AI to draft your profile</div>
          <div className="mt-1 text-sm text-zinc-600">
            Draft with AI from your sources → review → paste into AEOBRO fields.
          </div>
        </div>
        <div className="text-sm text-zinc-500">{open ? "Hide" : "Show"}</div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="text-sm font-semibold text-zinc-900">Recommended Way to Complete Your AEOBRO Profile</div>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
            <li>Publish a basic AEOBRO profile (name + entity type).</li>
            <li>Copy your public AEOBRO profile URL.</li>
            <li>Open your preferred AI tool (ChatGPT, Claude, Gemini, etc.).</li>
            <li>Gather your sources (website, profiles, documents).</li>
            <li>Paste the prompt below and insert your sources.</li>
            <li>Review the output carefully.</li>
            <li>Edit anything inaccurate, incomplete, or off-brand.</li>
            <li>Paste each labeled section into the matching AEOBRO fields.</li>
          </ol>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-600">
              Important: AI should help you draft, not decide what’s true. You are responsible for accuracy.
            </div>
            <button
              type="button"
              onClick={copyPrompt}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              📋 {copied ? "Copied" : "Copy AI Drafting Prompt"}
            </button>
          </div>

          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800">
            {AEOBRO_AI_DRAFT_PROMPT}
          </pre>
        </div>
      )}
    </div>
  );
}

/** -------- Types -------- */
type EntityType =
  | "Business"
  | "Local Service"
  | "Organization"
  | "Creator / Person"
  | "Product"
  | "AI_AGENT";

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

type VerificationStatus = "UNVERIFIED" | "PENDING" | "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED";

type PlanTitle = "Lite" | "Plus" | "Pro" | "Business" | "Enterprise";

type FAQItem = {
  question: string;
  answer: string;
  position?: number;
};

type ServiceItem = {
  name: string;
  description?: string | null;
  url?: string | null;
  priceMin?: string | null;
  priceMax?: string | null;
  priceUnit?: string | null;
  currency?: string | null;
  position?: number;
};

type ProductType = "PRODUCT" | "SERVICE" | "OFFER";
type ProductAvailability = "" | "InStock" | "OutOfStock" | "PreOrder" | "LimitedAvailability" | "OnlineOnly";

type PriceSpec = {
  amount?: number | null;
  currency?: string | null;
};

type ProductItem = {
  name: string;
  type?: ProductType;
  url?: string | null;
  image?: string | null;
  price?: PriceSpec | null;
  availability?: ProductAvailability;
  category?: string | null;
  sku?: string | null;
  brand?: string | null;
  gtin?: string | null;
  position?: number;
};

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
  updateMessage?: string | null;

  // Phase 2 JSON editors
  faqJson?: FAQItem[] | null;
  servicesJson?: ServiceItem[] | null;

  // Products / catalog (JSON)
  productsJson?: ProductItem[] | null;

  // ---- AI_AGENT fields (safe optional; may be absent in Prisma client typings)
  aiAgentProvider?: string | null;
  aiAgentModel?: string | null;
  aiAgentVersion?: string | null;
  aiAgentDocsUrl?: string | null;
  aiAgentApiUrl?: string | null;
  aiAgentCapabilities?: string[] | null;
  aiAgentInputModes?: string[] | null;
  aiAgentOutputModes?: string[] | null;
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
function toMoney(input: string): number | null {
  const v = (input || "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map any raw plan string (DB enum like "FREE", "LITE", "PRO", etc.)
 * to a clean UI PlanTitle.
 */
function normalizePlanForUi(p?: string | null): PlanTitle {
  const v = (p ?? "").toString().toUpperCase();

  switch (v) {
    case "PLUS":
      return "Plus";
    case "PRO":
      return "Pro";
    case "BUSINESS":
      return "Business";
    case "ENTERPRISE":
      return "Enterprise";
    // Treat FREE, LITE, and anything unknown as Lite baseline
    case "LITE":
    case "FREE":
    default:
      return "Lite";
  }
}

/** -------- Component -------- */
export default function ProfileEditor({
  initial,
  plan: planFromServer,
}: {
  initial: Profile | null;
  plan?: string | null;
}) {
  const { data: session, status } = useSession();
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
  const [entityType, setEntityType] = React.useState<EntityType | "">((initial?.entityType as EntityType) ?? "");

  // ---- AI_AGENT (safe access; may not exist in prisma types)
  const initialAny = (initial ?? {}) as any;
  const [aiAgentProvider, setAiAgentProvider] = React.useState<string>(initialAny?.aiAgentProvider ?? "");
  const [aiAgentModel, setAiAgentModel] = React.useState<string>(initialAny?.aiAgentModel ?? "");
  const [aiAgentVersion, setAiAgentVersion] = React.useState<string>(initialAny?.aiAgentVersion ?? "");
  const [aiAgentDocsUrl, setAiAgentDocsUrl] = React.useState<string>(initialAny?.aiAgentDocsUrl ?? "");
  const [aiAgentApiUrl, setAiAgentApiUrl] = React.useState<string>(initialAny?.aiAgentApiUrl ?? "");
  const [aiAgentCapabilities, setAiAgentCapabilities] = React.useState<string>(toCsv(initialAny?.aiAgentCapabilities));
  const [aiAgentInputModes, setAiAgentInputModes] = React.useState<string>(toCsv(initialAny?.aiAgentInputModes));
  const [aiAgentOutputModes, setAiAgentOutputModes] = React.useState<string>(toCsv(initialAny?.aiAgentOutputModes));

  // ---- Story
  const [tagline, setTagline] = React.useState(initial?.tagline ?? "");
  const [bio, setBio] = React.useState(initial?.bio ?? "");

  // ---- Updates (latest announcement)
  const [updateMessage, setUpdateMessage] = React.useState(initial?.updateMessage ?? "");

  // ---- Anchors
  const [website, setWebsite] = React.useState(initial?.website ?? "");
  const [location, setLocation] = React.useState(initial?.location ?? "");
  const [serviceArea, setServiceArea] = React.useState(toCsv(initial?.serviceArea));

  // ---- Trust & Authority
  const [foundedYear, setFoundedYear] = React.useState(initial?.foundedYear ? String(initial.foundedYear) : "");
  const [teamSize, setTeamSize] = React.useState(initial?.teamSize ? String(initial.teamSize) : "");
  const [languages, setLanguages] = React.useState(toCsv(initial?.languages));
  const [pricingModel, setPricingModel] = React.useState<"Free" | "Subscription" | "One-time" | "Custom" | "">(
    (initial?.pricingModel as any) ?? ""
  );
  const [hours, setHours] = React.useState(initial?.hours ?? "");

  const [certifications, setCertifications] = React.useState(initial?.certifications ?? "");
  const [press, setPress] = React.useState<PressItem[]>(initial?.press ?? []);
  const [pressDraft, setPressDraft] = React.useState<PressItem>({
    title: "",
    url: "",
  });

  // ---- Branding & media
  const [logoUrl, setLogoUrl] = React.useState(initial?.logoUrl ?? "");
  const [imageUrls, setImageUrls] = React.useState<string[]>(
    initial?.imageUrls && initial.imageUrls.length ? initial.imageUrls : ["", "", ""]
  );

  // ---- Platforms & links
  const [handles, setHandles] = React.useState<PlatformHandles>(initial?.handles ?? {});
  const [links, setLinks] = React.useState<LinkItem[]>(initial?.links ?? []);
  const [linkDraft, setLinkDraft] = React.useState<LinkItem>({
    label: "",
    url: "",
  });

  // ---- Phase 2: FAQ + Services JSON editors
  const [faqs, setFaqs] = React.useState<FAQItem[]>(initial?.faqJson ?? []);
  const [faqDraft, setFaqDraft] = React.useState<FAQItem>({
    question: "",
    answer: "",
  });

  const [services, setServices] = React.useState<ServiceItem[]>(initial?.servicesJson ?? []);
  const [serviceDraft, setServiceDraft] = React.useState<ServiceItem>({
    name: "",
    description: "",
    url: "",
    priceMin: "",
    priceMax: "",
    priceUnit: "",
    currency: "",
  });

  // ---- Products / Catalog (JSON)
  const [products, setProducts] = React.useState<ProductItem[]>(initial?.productsJson ?? []);
  const [productAdvanced, setProductAdvanced] = React.useState(false);
  const [productDraft, setProductDraft] = React.useState<{
    name: string;
    type: ProductType;
    url: string;
    image: string;
    amount: string;
    currency: string;
    availability: ProductAvailability;
    category: string;
    sku: string;
    brand: string;
    gtin: string;
  }>({
    name: "",
    type: "PRODUCT",
    url: "",
    image: "",
    amount: "",
    currency: "USD",
    availability: "",
    category: "",
    sku: "",
    brand: "",
    gtin: "",
  });

  // ---- UI
  const [saving, setSaving] = React.useState(false);
  const [savedSlug, setSavedSlug] = React.useState<string | null>(null);
  const prefilledRef = React.useRef(false);

  // ---- Dirty tracking
  const lastSavedRef = React.useRef<string>("");
  const [dirty, setDirty] = React.useState<boolean>(false);

  // ---- Modal for viewing with unsaved changes
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // ---- Plan pill (Lite/Plus/Pro/Business/Enterprise)
  const [plan, setPlan] = React.useState<PlanTitle | null>(planFromServer ? normalizePlanForUi(planFromServer) : null);

  // ---- Plan status (critical global rule: if not active => treat as Lite)
  const [planStatus, setPlanStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
  let cancelled = false;

  if (status === "unauthenticated") {
    const callbackUrl = encodeURIComponent(window.location.href);
    window.location.assign(`/api/auth/signin?callbackUrl=${callbackUrl}`);
    return;
  }

  if (status !== "authenticated") return;

  (async () => {
    try {
      const r = await fetch("/api/account", { cache: "no-store" });

      if (r.status === 401) {
        const callbackUrl = encodeURIComponent(window.location.href);
        window.location.assign(`/api/auth/signin?callbackUrl=${callbackUrl}`);
        return;
      }

      if (!r.ok) return;

      const j = await r.json();

      const rawPlan = j?.plan;
      const rawStatus = j?.planStatus;

      if (!cancelled) {
        if (!planFromServer && rawPlan) {
          setPlan(normalizePlanForUi(rawPlan));
        }
        setPlanStatus(rawStatus ?? null);
      }
    } catch {}
  })();

  return () => {
    cancelled = true;
  };
}, [planFromServer, status]);

  // Upper-case key for gating logic; default Lite if unknown
  const planKey = (plan ?? "Lite").toUpperCase();

  // ✅ Critical global rule: if planStatus !== "active" => treat as Lite everywhere (fail closed)
  const isPlanActive = (planStatus ?? "").toLowerCase() === "active";

  // Effective plan used for feature gating (not for displaying the pill)
  const effectivePlanKey = isPlanActive ? planKey : "LITE";

  // Pro/Business/Enterprise should behave like Plus for now (but still hidden in UI elsewhere)
  const isProLike = effectivePlanKey === "PRO" || effectivePlanKey === "BUSINESS" || effectivePlanKey === "ENTERPRISE";

  const isPlusLike = effectivePlanKey === "PLUS" || isProLike;

  // Updates editor should be available on Plus(active) and Pro-like(active) plans only
  const canEditUpdates = isPlusLike;

  // Products editor should be available on Plus(active) and Pro-like(active) plans (Lite/inactive is read-only)
  const canEditProducts = isPlusLike;

  // FAQ + Services editor should be available on Plus(active) and Pro-like(active) plans
  const canEditFaqsAndServices = isPlusLike;

  const isAiAgent = entityType === "AI_AGENT";

  /** ---- Build a normalized payload ---- */
  const buildPayload = React.useCallback((): Profile => {
    const base: Profile = {
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
        ? press.map((p) => ({
            title: (p.title || "").trim(),
            url: normalizeUrl(p.url || ""),
          }))
        : null,
      logoUrl: logoUrl ? normalizeUrl(logoUrl) : null,
      imageUrls: imageUrls.filter(Boolean).map(normalizeUrl),
      handles,
      links:
        links.length > 0
          ? links.map((l) => ({
              label: (l.label || "").trim(),
              url: normalizeUrl(l.url || ""),
            }))
          : null,
      // updateMessage is gated below (do NOT include for Lite/inactive to avoid overwriting)
    };

    // ---- AI_AGENT fields (Lite-allowed; only attach when entityType is AI_AGENT)
    if (isAiAgent) {
      base.aiAgentProvider = (aiAgentProvider || "").trim() || null;
      base.aiAgentModel = (aiAgentModel || "").trim() || null;
      base.aiAgentVersion = (aiAgentVersion || "").trim() || null;

      const docs = (aiAgentDocsUrl || "").trim();
      const api = (aiAgentApiUrl || "").trim();
      base.aiAgentDocsUrl = docs ? normalizeUrl(docs) : null;
      base.aiAgentApiUrl = api ? normalizeUrl(api) : null;

      base.aiAgentCapabilities = fromCsv(aiAgentCapabilities);
      base.aiAgentInputModes = fromCsv(aiAgentInputModes);
      base.aiAgentOutputModes = fromCsv(aiAgentOutputModes);
    }

    // 🔹 Latest update — only send when Plus/Pro-like (active) so Lite users don't overwrite
    if (canEditUpdates) {
      base.updateMessage = (updateMessage || "").trim() || null;
    }

    // 🔹 Products / Catalog — only send when Plus/Pro-like (active) so Lite users don't wipe
    if (canEditProducts) {
      const productsJson = (products ?? [])
        .map((p, index) => {
          const name = (p.name || "").trim();
          if (!name) return null;
          const url = p.url ? normalizeUrl(p.url) : null;
          const image = p.image ? normalizeUrl(p.image) : null;

          const amount =
            typeof p.price?.amount === "number" && Number.isFinite(p.price.amount) ? p.price.amount : null;

          const currency = (p.price?.currency || "").trim() || null;

          return {
            name,
            type: (p.type || "PRODUCT") as ProductType,
            url,
            image,
            price: amount != null || currency != null ? { amount: amount ?? null, currency: currency ?? null } : null,
            availability: (p.availability || "") as ProductAvailability,
            category: (p.category || "").trim() || null,
            sku: (p.sku || "").trim() || null,
            brand: (p.brand || "").trim() || null,
            gtin: (p.gtin || "").trim() || null,
            position: p.position ?? index + 1,
          } as ProductItem;
        })
        .filter(Boolean) as ProductItem[];

      base.productsJson = productsJson;
    }

    // 🔹 FAQs + Services — only send when Plus/Pro-like (active) so Lite users don’t wipe existing structured data.
    if (canEditFaqsAndServices) {
      const faqJson = (faqs ?? [])
        .map((f, index) => {
          const q = (f.question || "").trim();
          const a = (f.answer || "").trim();
          if (!q || !a) return null;
          return {
            question: q,
            answer: a,
            position: f.position ?? index + 1,
          };
        })
        .filter(Boolean) as FAQItem[];

      const servicesJson = (services ?? [])
        .map((s, index) => {
          const name = (s.name || "").trim();
          if (!name) return null;
          return {
            name,
            description: (s.description || "").trim() || null,
            url: s.url ? normalizeUrl(s.url) : null,
            priceMin: s.priceMin?.toString().trim() || null,
            priceMax: s.priceMax?.toString().trim() || null,
            priceUnit: (s.priceUnit || "").trim() || null,
            currency: (s.currency || "").trim() || null,
            position: s.position ?? index + 1,
          } as ServiceItem;
        })
        .filter(Boolean) as ServiceItem[];

      base.faqJson = faqJson;
      base.servicesJson = servicesJson;
    }

    return base;
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
    // AI_AGENT
    isAiAgent,
    aiAgentProvider,
    aiAgentModel,
    aiAgentVersion,
    aiAgentDocsUrl,
    aiAgentApiUrl,
    aiAgentCapabilities,
    aiAgentInputModes,
    aiAgentOutputModes,
    // gated
    updateMessage,
    canEditUpdates,
    products,
    canEditProducts,
    faqs,
    services,
    canEditFaqsAndServices,
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

        const dataAny = data as any;

        if (data.id) setProfileId(data.id);

        if (data.displayName != null) setDisplayName(data.displayName || "");
        if (data.legalName != null) setLegalName(data.legalName || "");
        if (data.entityType) setEntityType(data.entityType);

        // AI_AGENT fields (safe; may be absent)
        if (dataAny?.aiAgentProvider != null) setAiAgentProvider(dataAny.aiAgentProvider || "");
        if (dataAny?.aiAgentModel != null) setAiAgentModel(dataAny.aiAgentModel || "");
        if (dataAny?.aiAgentVersion != null) setAiAgentVersion(dataAny.aiAgentVersion || "");
        if (dataAny?.aiAgentDocsUrl != null) setAiAgentDocsUrl(dataAny.aiAgentDocsUrl || "");
        if (dataAny?.aiAgentApiUrl != null) setAiAgentApiUrl(dataAny.aiAgentApiUrl || "");
        if (Array.isArray(dataAny?.aiAgentCapabilities)) setAiAgentCapabilities(toCsv(dataAny.aiAgentCapabilities));
        if (Array.isArray(dataAny?.aiAgentInputModes)) setAiAgentInputModes(toCsv(dataAny.aiAgentInputModes));
        if (Array.isArray(dataAny?.aiAgentOutputModes)) setAiAgentOutputModes(toCsv(dataAny.aiAgentOutputModes));

        if (data.tagline != null) setTagline(data.tagline || "");
        if (data.bio != null) setBio(data.bio || "");

        // Updates (always prefill; Lite users see gated/read-only)
        if (data.updateMessage != null) setUpdateMessage(data.updateMessage || "");

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

        // Products (always prefill; Lite users see read-only)
        if (Array.isArray(data.productsJson)) setProducts(data.productsJson);

        // FAQs/Services (always prefill; Lite users see read-only)
        if (Array.isArray(data.faqJson)) setFaqs(data.faqJson);
        if (Array.isArray(data.servicesJson)) setServices(data.servicesJson);

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

      // AI_AGENT URL validation (Lite-allowed)
      if (isAiAgent) {
        const docs = (aiAgentDocsUrl || "").trim();
        const api = (aiAgentApiUrl || "").trim();
        if (docs && !isValidUrl(normalizeUrl(docs))) {
          throw new Error("AI Agent Docs URL must be a valid URL (https://...).");
        }
        if (api && !isValidUrl(normalizeUrl(api))) {
          throw new Error("AI Agent API URL must be a valid URL (https://...).");
        }
      }

      // Products validation (URLs only) for Plus/Pro-like(active) where editor is unlocked
      if (canEditProducts) {
        for (const p of products) {
          if (p.url && !isValidUrl(normalizeUrl(p.url))) {
            throw new Error("Product URLs must be valid (https://example.com).");
          }
          if (p.image && !isValidUrl(normalizeUrl(p.image))) {
            throw new Error("Product image URLs must be valid.");
          }
        }
      }

      // Services validation (URLs only) for Plus/Pro-like(active) where editor is unlocked
      if (canEditFaqsAndServices) {
        for (const s of services) {
          if (s.url && !isValidUrl(normalizeUrl(s.url))) {
            throw new Error("Service URLs must be valid (https://example.com).");
          }
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

      const finalSlug: string | undefined = json?.profile?.slug || json?.slug || undefined;
      const finalId: string | undefined = json?.profile?.id || json?.id || profileId || undefined;
      const finalStatus: VerificationStatus | undefined = (json?.profile?.verificationStatus || json?.verificationStatus) as
        | VerificationStatus
        | undefined;

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
const publishStatus = !hasEverSaved ? "Not yet published" : dirty ? "Unsaved changes" : "Published";
const statusClasses =
  publishStatus === "Published"
    ? "bg-green-100 text-green-700 ring-1 ring-green-200"
      : publishStatus === "Unsaved changes"
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
          <span className="block">
            To build your AI Ready profile, fill out as much of the form below as you can, and click{" "}
            <span className="font-medium">Save &amp; Publish</span>.
          </span>
          <span className="block">
            <span className="font-semibold">Only Display Name is required to publish.</span> Add more when you’re ready —
            the more details you include, the better your AI visibility.
          </span>
          <span className="block">
            To have your AI Ready profile verified, complete one of the options at the bottom of this page.
          </span>
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
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span className="font-medium">{email}</span>
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

      {/* AI drafting helper */}
      <AIDraftingCallout />

      {/* Identity */}
      <section className="grid gap-4">
        <h3 className="text-lg font-semibold">Identity</h3>
        <div className={row}>
          <label className={label + " overflow-visible"} htmlFor="displayName">
            Display Name *
            <span className="relative group ml-1 cursor-help align-middle">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                i
              </span>
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-64 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                Your public name for this profile. It appears in your URL and is the first thing AI tools and people will
                see.
              </span>
            </span>
          </label>
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
            <label className={label} htmlFor="legalName">
              Legal/brand name (if different)
            </label>
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
              <option value="AI_AGENT">AI Agent (AI_AGENT)</option>
            </select>
          </div>
        </div>

        {/* Public URL (read-only) */}
        <div className="mt-2">
          <PublicUrlReadonly slug={serverSlug} />
        </div>
      </section>

      {/* AI Agent Details (only when entityType === AI_AGENT) */}
      {isAiAgent && (
        <section className="grid gap-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
            <div>
              <h3 className="text-lg font-semibold">AI Agent Details</h3>
              <p className="text-sm text-gray-600">
                Define the canonical identity for your AI agent. These fields are included in your AI Ready JSON-LD.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={row}>
                <label className={label} htmlFor="aiAgentProvider">
                  Provider / Organization
                </label>
                <input
                  id="aiAgentProvider"
                  className={input}
                  placeholder="e.g., OpenAI"
                  value={aiAgentProvider}
                  onChange={(e) => setAiAgentProvider(e.target.value)}
                  maxLength={160}
                />
              </div>
              <div className={row}>
                <label className={label} htmlFor="aiAgentModel">
                  Model name
                </label>
                <input
                  id="aiAgentModel"
                  className={input}
                  placeholder="e.g., gpt-5"
                  value={aiAgentModel}
                  onChange={(e) => setAiAgentModel(e.target.value)}
                  maxLength={160}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={row}>
                <label className={label} htmlFor="aiAgentVersion">
                  Version (optional)
                </label>
                <input
                  id="aiAgentVersion"
                  className={input}
                  placeholder="e.g., 2026-02"
                  value={aiAgentVersion}
                  onChange={(e) => setAiAgentVersion(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className={row}>
                <label className={label + " overflow-visible"} htmlFor="aiAgentDocsUrl">
                  Docs URL (optional)
                  <span className="relative group ml-1 cursor-help align-middle">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                      i
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                      Public documentation for the agent or model. Use https:// so AI systems can verify.
                    </span>
                  </span>
                </label>
                <input
                  id="aiAgentDocsUrl"
                  className={input}
                  placeholder="https://..."
                  value={aiAgentDocsUrl}
                  onChange={(e) => setAiAgentDocsUrl(e.target.value)}
                  maxLength={300}
                />
              </div>
            </div>

            <div className={row}>
              <label className={label + " overflow-visible"} htmlFor="aiAgentApiUrl">
                API URL (optional)
                <span className="relative group ml-1 cursor-help align-middle">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                    i
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                    Public API endpoint or landing page for the agent (not a secret key).
                  </span>
                </span>
              </label>
              <input
                id="aiAgentApiUrl"
                className={input}
                placeholder="https://api.example.com"
                value={aiAgentApiUrl}
                onChange={(e) => setAiAgentApiUrl(e.target.value)}
                maxLength={300}
              />
            </div>

            <div className={row}>
              <label className={label + " overflow-visible"} htmlFor="aiAgentCapabilities">
                Capabilities (comma-separated)
                <span className="relative group ml-1 cursor-help align-middle">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                    i
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                    Example: “web_search, code_execution, image_generation”.
                  </span>
                </span>
              </label>
              <input
                id="aiAgentCapabilities"
                className={input}
                placeholder="e.g., tool_use, retrieval, reasoning"
                value={aiAgentCapabilities}
                onChange={(e) => setAiAgentCapabilities(e.target.value)}
                maxLength={400}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={row}>
                <label className={label} htmlFor="aiAgentInputModes">
                  Input modes (comma-separated)
                </label>
                <input
                  id="aiAgentInputModes"
                  className={input}
                  placeholder="e.g., text, image, audio"
                  value={aiAgentInputModes}
                  onChange={(e) => setAiAgentInputModes(e.target.value)}
                  maxLength={240}
                />
              </div>
              <div className={row}>
                <label className={label} htmlFor="aiAgentOutputModes">
                  Output modes (comma-separated)
                </label>
                <input
                  id="aiAgentOutputModes"
                  className={input}
                  placeholder="e.g., text, json, audio"
                  value={aiAgentOutputModes}
                  onChange={(e) => setAiAgentOutputModes(e.target.value)}
                  maxLength={240}
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              These fields are saved when you click <span className="font-medium">Save &amp; Publish</span>.
            </p>
          </div>
        </section>
      )}

      {/* Tagline & Bio */}
      <section className="grid gap-4">
        <h3 className="text-lg font-semibold">Tagline &amp; Bio</h3>
        <div className={row}>
          <label className={label + " overflow-visible"} htmlFor="tagline">
            One-line Summary
            <span className="relative group ml-1 cursor-help align-middle">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                i
              </span>
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
          <label className={label + " overflow-visible"} htmlFor="bio">
            Bio / About
            <span className="relative group ml-1 cursor-help align-middle">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                i
              </span>
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                A fuller description of what you do, who you help, and why you are credible. AI systems use this to
                understand your expertise and context.
              </span>
            </span>
          </label>
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
            <label className={label + " overflow-visible"} htmlFor="website">
              Website
              <span className="relative group ml-1 cursor-help align-middle">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                  i
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                  Your main website or landing page. Include https:// so AI tools and search engines can reliably confirm
                  your brand.
                </span>
              </span>
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
              Optional, but recommended so AI systems can reliably confirm your official site.
            </small>
          </div>
          <div className={row}>
            <label className={label + " overflow-visible"} htmlFor="location">
              Location (address or city/state)
              <span className="relative group ml-1 cursor-help align-middle">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                  i
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                  Where you’re based or operate from. City/state is enough for many brands; full address is optional.
                </span>
              </span>
            </label>
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
          <label className={label + " overflow-visible"} htmlFor="serviceArea">
            Service area (comma-separated regions)
            <span className="relative group ml-1 cursor-help align-middle">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                i
              </span>
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                Geographic regions you serve. Example: “New York, New Jersey, Remote (US-wide)”.
              </span>
            </span>
          </label>
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
            <label className={label} htmlFor="foundedYear">
              Founded / started (year)
            </label>
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
            <label className={label} htmlFor="teamSize">
              Team size
            </label>
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
              placeholder="e.g., English, Spanish"
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
              placeholder="e.g., Mon–Fri 9am–5pm"
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
              <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setPress([])}>
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
          <label className={label} htmlFor="logoUploader">
            Logo
          </label>
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
        <h3 className="text-lg font-semibold">Platform Handles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              ["youtube", "YouTube channel URL"],
              ["tiktok", "TikTok profile URL"],
              ["instagram", "Instagram profile URL"],
              ["substack", "Substack URL"],
              ["etsy", "Etsy shop URL"],
              ["x", "X (Twitter) profile URL"],
              ["linkedin", "LinkedIn page URL"],
              ["facebook", "Facebook page URL"],
              ["github", "GitHub org/user URL"],
            ] as const
          ).map(([key, labelTxt]) => (
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
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Links
          <span className="relative group cursor-help align-middle">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
              i
            </span>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
              Add important extra URLs such as review pages, booking links, app store listings, docs, or other destinations
              that matter for your brand.
            </span>
          </span>
        </h3>
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
              <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setLinks([])}>
                Clear links
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Products / Catalog – Plus(active) & Pro-like(active) only */}
      <section className="grid gap-4">
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Products / Catalog
                <span className="relative group cursor-help align-middle">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                    i
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-[22rem] -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                    <span className="font-semibold">Why list a Product instead of a link?</span>
                    <br />
                    A link is just a destination for humans.
                    <br />
                    A product is a structured offering for AI systems.
                    <br />
                    When you list a product, you define what it is, what it costs, and how it should be understood — in a
                    machine-readable format. This helps AI systems interpret, compare, and include your offering in relevant
                    answers.
                    <br />
                    Links don’t carry this context. Products do.
                  </span>
                </span>
              </h3>

              <p className="text-sm text-gray-600">
                Listing a product, and its details, makes your offering machine-readable, improving how AI systems
                interpret, compare, and surface what you sell.
              </p>
            </div>

            {!canEditProducts && (
              <span className="text-xs rounded-full bg-yellow-50 px-2.5 py-1 text-yellow-800 border border-yellow-200 whitespace-nowrap">
                Upgrade to Plus to edit Products
              </span>
            )}
          </div>

          {canEditProducts ? (
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-xl border bg-gray-50 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={row}>
                    <label className={label}>Type</label>
                    <select
                      className={input}
                      value={productDraft.type}
                      onChange={(e) =>
                        setProductDraft((d) => ({
                          ...d,
                          type: e.target.value as ProductType,
                        }))
                      }
                    >
                      <option value="PRODUCT">Product</option>
                      <option value="SERVICE">Service</option>
                      <option value="OFFER">Offer</option>
                    </select>
                  </div>
                  <div className={row + " sm:col-span-2"}>
                    <label className={label}>Name</label>
                    <input
                      className={input}
                      placeholder="e.g., AEOBRO Plus"
                      value={productDraft.name}
                      onChange={(e) => setProductDraft((d) => ({ ...d, name: e.target.value }))}
                      maxLength={160}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={row}>
                    <label className={label}>URL</label>
                    <input
                      className={input}
                      placeholder="https://..."
                      value={productDraft.url}
                      onChange={(e) => setProductDraft((d) => ({ ...d, url: e.target.value }))}
                      maxLength={300}
                    />
                  </div>
                  <div className={row}>
                    <label className={label}>Image URL (optional)</label>
                    <input
                      className={input}
                      placeholder="https://.../image.png"
                      value={productDraft.image}
                      onChange={(e) => setProductDraft((d) => ({ ...d, image: e.target.value }))}
                      maxLength={300}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={row}>
                    <label className={label}>Price</label>
                    <input
                      className={input}
                      inputMode="decimal"
                      placeholder="e.g., 19.99"
                      value={productDraft.amount}
                      onChange={(e) => setProductDraft((d) => ({ ...d, amount: e.target.value }))}
                      maxLength={32}
                    />
                  </div>
                  <div className={row}>
                    <label className={label}>Currency</label>
                    <input
                      className={input}
                      placeholder="USD"
                      value={productDraft.currency}
                      onChange={(e) =>
                        setProductDraft((d) => ({
                          ...d,
                          currency: e.target.value.toUpperCase(),
                        }))
                      }
                      maxLength={10}
                    />
                  </div>
                  <div className={row}>
                    <label className={label}>Availability</label>
                    <select
                      className={input}
                      value={productDraft.availability}
                      onChange={(e) =>
                        setProductDraft((d) => ({
                          ...d,
                          availability: e.target.value as ProductAvailability,
                        }))
                      }
                    >
                      <option value="">(optional)</option>
                      <option value="InStock">In stock</option>
                      <option value="OutOfStock">Out of stock</option>
                      <option value="PreOrder">Pre-order</option>
                      <option value="LimitedAvailability">Limited</option>
                      <option value="OnlineOnly">Online only</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  className="text-sm text-blue-700 underline underline-offset-2 self-start"
                  onClick={() => setProductAdvanced((v) => !v)}
                >
                  {productAdvanced ? "Hide advanced fields" : "Show advanced fields"}
                </button>

                {productAdvanced && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={row}>
                      <label className={label}>Category (optional)</label>
                      <input
                        className={input}
                        placeholder="e.g., SaaS, Jewelry, Coaching"
                        value={productDraft.category}
                        onChange={(e) => setProductDraft((d) => ({ ...d, category: e.target.value }))}
                        maxLength={120}
                      />
                    </div>
                    <div className={row}>
                      <label className={label}>Brand (optional)</label>
                      <input
                        className={input}
                        placeholder="e.g., AEOBRO"
                        value={productDraft.brand}
                        onChange={(e) => setProductDraft((d) => ({ ...d, brand: e.target.value }))}
                        maxLength={120}
                      />
                    </div>
                    <div className={row}>
                      <label className={label}>SKU (optional)</label>
                      <input
                        className={input}
                        placeholder="Internal SKU"
                        value={productDraft.sku}
                        onChange={(e) => setProductDraft((d) => ({ ...d, sku: e.target.value }))}
                        maxLength={80}
                      />
                    </div>
                    <div className={row}>
                      <label className={label}>GTIN (optional)</label>
                      <input
                        className={input}
                        placeholder="UPC/EAN/GTIN"
                        value={productDraft.gtin}
                        onChange={(e) => setProductDraft((d) => ({ ...d, gtin: e.target.value }))}
                        maxLength={80}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 border rounded-lg"
                    onClick={() => {
                      const name = productDraft.name.trim();
                      if (!name) return;

                      const url = productDraft.url.trim();
                      if (url && !isValidUrl(normalizeUrl(url))) {
                        toast("Product URL must be valid (https://...).", "error");
                        return;
                      }

                      const img = productDraft.image.trim();
                      if (img && !isValidUrl(normalizeUrl(img))) {
                        toast("Product image URL must be valid (https://...).", "error");
                        return;
                      }

                      const amt = toMoney(productDraft.amount);
                      const currency = (productDraft.currency || "").trim().toUpperCase();

                      const newItem: ProductItem = {
                        name,
                        type: productDraft.type,
                        url: url ? normalizeUrl(url) : null,
                        image: img ? normalizeUrl(img) : null,
                        price: amt != null || currency ? { amount: amt, currency: currency || "USD" } : null,
                        availability: productDraft.availability || "",
                        category: productDraft.category.trim() || null,
                        sku: productDraft.sku.trim() || null,
                        brand: productDraft.brand.trim() || null,
                        gtin: productDraft.gtin.trim() || null,
                        position: products.length + 1,
                      };

                      setProducts((prev) => [...prev, newItem]);
                      setProductDraft({
                        name: "",
                        type: "PRODUCT",
                        url: "",
                        image: "",
                        amount: "",
                        currency: "USD",
                        availability: "",
                        category: "",
                        sku: "",
                        brand: "",
                        gtin: "",
                      });
                    }}
                  >
                    + Add item
                  </button>

                  {products.length > 0 && (
                    <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setProducts([])}>
                      Clear catalog
                    </button>
                  )}
                </div>
              </div>

              {products.length > 0 ? (
                <ul className="grid gap-3 text-sm">
                  {products.map((p, idx) => (
                    <li key={idx} className="rounded-lg border bg-white px-4 py-3 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">
                          {idx + 1}. {p.name}{" "}
                          {p.type ? (
                            <span className="ml-2 text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{p.type}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => setProducts((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>

                      {(p.price?.amount != null || p.price?.currency) && (
                        <div className="text-xs text-gray-700">
                          {(p.price?.currency || "USD") + " "}
                          {p.price?.amount != null ? p.price.amount : ""}
                          {p.availability ? <span className="ml-2 text-gray-500">• {p.availability}</span> : null}
                        </div>
                      )}

                      {p.category ? <div className="text-xs text-gray-600">Category: {p.category}</div> : null}

                      {p.url ? (
                        <a
                          href={normalizeUrl(p.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline mt-1"
                        >
                          View item
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-md border border-dashed bg-gray-50 p-3 text-sm text-gray-600">
                  No catalog items yet. Add your top offers first (the ones you want AI to recommend).
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {products.length > 0 ? (
                <div className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Your catalog (read-only on Lite)</div>
                      <div className="text-xs text-gray-600">Your items are saved. Upgrade to Plus to edit your catalog.</div>
                    </div>
                    <a
                      href="/pricing"
                      className="inline-flex items-center rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                    >
                      Upgrade to edit
                    </a>
                  </div>

                  <ul className="mt-3 grid gap-3 text-sm">
                    {products.map((p, idx) => (
                      <li key={idx} className="rounded-lg border bg-gray-50 px-4 py-3 flex flex-col gap-1">
                        <div className="font-medium">
                          {idx + 1}. {p.name}{" "}
                          {p.type ? (
                            <span className="ml-2 text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{p.type}</span>
                          ) : null}
                        </div>

                        {(p.price?.amount != null || p.price?.currency) && (
                          <div className="text-xs text-gray-700">
                            {(p.price?.currency || "USD") + " "}
                            {p.price?.amount != null ? p.price.amount : ""}
                            {p.availability ? <span className="ml-2 text-gray-500">• {p.availability}</span> : null}
                          </div>
                        )}

                        {p.category ? <div className="text-xs text-gray-600">Category: {p.category}</div> : null}

                        {p.url ? (
                          <a
                            href={normalizeUrl(p.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 underline mt-1"
                          >
                            View item
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-md border border-dashed bg-gray-50 p-3 text-sm text-gray-600">
                  Products/Catalog is available on <span className="font-medium">Plus</span>. Upgrade to add machine-readable
                  product and offer data.
                  <div className="mt-3">
                    <a
                      href="/pricing"
                      className="inline-flex items-center rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Upgrade on Pricing page
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Updates – Plus(active) & Pro-like(active) only */}
      <section className="grid gap-4">
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Updates</h3>
              <p className="text-sm text-gray-600">
                Post your latest offer, launch, or announcement. This becomes a machine-readable “Latest update” that AEOBRO
                exposes to AI systems.
              </p>
            </div>
            {!canEditUpdates && (
              <span className="text-xs rounded-full bg-yellow-50 px-2.5 py-1 text-yellow-800 border border-yellow-200 whitespace-nowrap">
                Upgrade to Plus to unlock Updates
              </span>
            )}
          </div>

          {canEditUpdates ? (
            <>
              <textarea
                className={input}
                rows={3}
                placeholder="Getting ready for launch."
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-gray-500">
                Updates are saved when you click <span className="font-medium">Save &amp; Publish</span>.
              </p>
            </>
          ) : (
            <div className="grid gap-3">
              {updateMessage?.trim() ? (
                <div className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Latest update (read-only on Lite)</div>
                      <div className="text-xs text-gray-600">Your update is saved. Upgrade to Plus to edit updates.</div>
                    </div>
                    <a
                      href="/pricing"
                      className="inline-flex items-center rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                    >
                      Upgrade to edit
                    </a>
                  </div>
                  <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">{updateMessage}</div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed bg-gray-50 p-3 text-sm text-gray-600">
                  Latest Updates are available on <span className="font-medium">Plus</span>. Upgrade to keep AI tools in sync
                  with your newest offers and announcements.
                  <div className="mt-3">
                    <a
                      href="/pricing"
                      className="inline-flex items-center rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Upgrade on Pricing page
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* FAQs (Plus gating) */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            FAQs
            <span className="relative group cursor-help align-middle">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                i
              </span>
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                Question-and-answer pairs about your brand, policies, and services. AEOBRO turns these into FAQ JSON-LD so AI
                tools can quote you accurately.
              </span>
            </span>
          </h3>
          {!canEditFaqsAndServices && (
            <span className="text-xs rounded-full bg-yellow-50 px-2.5 py-1 text-yellow-800 border border-yellow-200">
              Upgrade to Plus to edit FAQs
            </span>
          )}
        </div>

        {canEditFaqsAndServices ? (
          <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">
              Add common questions and answers about your brand, services, or policies. AEOBRO turns these into FAQ JSON-LD
              for AI and search.
            </p>

            <div className="grid gap-2">
              <label className={label}>New question</label>
              <input
                className={input}
                placeholder="e.g., What services do you offer?"
                value={faqDraft.question}
                onChange={(e) => setFaqDraft((f) => ({ ...f, question: e.target.value }))}
                maxLength={500}
              />
            </div>
            <div className="grid gap-2">
              <label className={label}>Answer</label>
              <textarea
                className={input}
                rows={3}
                placeholder="Provide a clear, helpful answer."
                value={faqDraft.answer}
                onChange={(e) => setFaqDraft((f) => ({ ...f, answer: e.target.value }))}
                maxLength={4000}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => {
                  const q = faqDraft.question.trim();
                  const a = faqDraft.answer.trim();
                  if (!q || !a) return;
                  setFaqs((prev) => [
                    ...prev,
                    {
                      question: q,
                      answer: a,
                      position: prev.length + 1,
                    },
                  ]);
                  setFaqDraft({ question: "", answer: "" });
                }}
              >
                + Add FAQ
              </button>
              {faqs.length > 0 && (
                <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setFaqs([])}>
                  Clear FAQs
                </button>
              )}
            </div>

            {faqs.length > 0 && (
              <ul className="mt-2 space-y-3 text-sm">
                {faqs.map((f, idx) => (
                  <li key={idx} className="rounded-lg border bg-gray-50 px-3 py-2 flex gap-3">
                    <div className="mt-1 text-xs font-semibold text-gray-500">{idx + 1}.</div>
                    <div className="flex-1">
                      <div className="font-medium">{f.question}</div>
                      <div className="mt-1 text-gray-700 whitespace-pre-wrap">{f.answer}</div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline ml-2"
                      onClick={() => setFaqs((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {faqs.length === 0 && (
              <div className="rounded-md border border-dashed bg-gray-50 p-3 text-sm text-gray-600">
                No FAQs yet. Add your most common questions first.
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {faqs.length > 0 ? (
              <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">FAQs (read-only on Lite)</div>
                    <div className="text-xs text-gray-600">Your FAQs are saved. Upgrade to Plus to edit.</div>
                  </div>
                  <a
                    href="/pricing"
                    className="inline-flex items-center rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    Upgrade to edit
                  </a>
                </div>

                <ul className="mt-3 space-y-3 text-sm">
                  {faqs.map((f, idx) => (
                    <li key={idx} className="rounded-lg border bg-gray-50 px-3 py-2">
                      <div className="font-medium">
                        {idx + 1}. {f.question}
                      </div>
                      <div className="mt-1 text-gray-700 whitespace-pre-wrap">{f.answer}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-gray-50 p-4 text-sm text-gray-600">
                FAQs are stored as structured JSON-LD for AI and search engines. Upgrade to{" "}
                <span className="font-medium">Plus</span> to unlock the FAQ editor here.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Services (Plus gating) */}
      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Services
            <span className="relative group cursor-help align-middle">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                i
              </span>
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-72 -translate-x-1/2 rounded-md bg-black px-2 py-1 text-xs leading-snug text-white group-hover:block">
                List the services or offers you provide, with optional price ranges. AEOBRO exposes these as structured
                Service entities so AI can describe and recommend your offers.
              </span>
            </span>
          </h3>
          {!canEditFaqsAndServices && (
            <span className="text-xs rounded-full bg-yellow-50 px-2.5 py-1 text-yellow-800 border border-yellow-200">
              Upgrade to Plus to edit Services
            </span>
          )}
        </div>

        {canEditFaqsAndServices ? (
          <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">
              List your services or offers. AEOBRO exposes these as{" "}
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Service</code> entities in JSON-LD, with optional
              price ranges.
            </p>

            <div className="grid gap-2">
              <label className={label}>Service name</label>
              <input
                className={input}
                placeholder="e.g., Website design package"
                value={serviceDraft.name || ""}
                onChange={(e) => setServiceDraft((s) => ({ ...s, name: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div className="grid gap-2">
              <label className={label}>Description</label>
              <textarea
                className={input}
                rows={3}
                placeholder="Short description of this service."
                value={serviceDraft.description || ""}
                onChange={(e) => setServiceDraft((s) => ({ ...s, description: e.target.value }))}
                maxLength={2000}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={row}>
                <label className={label}>Service URL (optional)</label>
                <input
                  className={input}
                  placeholder="https://your-service-page.com"
                  value={serviceDraft.url || ""}
                  onChange={(e) => setServiceDraft((s) => ({ ...s, url: e.target.value }))}
                  maxLength={300}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={row}>
                  <label className={label}>Min price</label>
                  <input
                    className={input}
                    placeholder="e.g., 500"
                    value={serviceDraft.priceMin || ""}
                    onChange={(e) => setServiceDraft((s) => ({ ...s, priceMin: e.target.value }))}
                    maxLength={40}
                  />
                </div>
                <div className={row}>
                  <label className={label}>Max price</label>
                  <input
                    className={input}
                    placeholder="e.g., 2000"
                    value={serviceDraft.priceMax || ""}
                    onChange={(e) => setServiceDraft((s) => ({ ...s, priceMax: e.target.value }))}
                    maxLength={40}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={row}>
                <label className={label}>Currency</label>
                <input
                  className={input}
                  placeholder="e.g., USD"
                  value={serviceDraft.currency || ""}
                  onChange={(e) => setServiceDraft((s) => ({ ...s, currency: e.target.value }))}
                  maxLength={10}
                />
              </div>
              <div className={row}>
                <label className={label}>Unit (per…)</label>
                <input
                  className={input}
                  placeholder="e.g., project, hour, month"
                  value={serviceDraft.priceUnit || ""}
                  onChange={(e) => setServiceDraft((s) => ({ ...s, priceUnit: e.target.value }))}
                  maxLength={40}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 border rounded-lg"
                onClick={() => {
                  const name = (serviceDraft.name || "").trim();
                  if (!name) return;

                  const url = (serviceDraft.url || "").trim();
                  if (url && !isValidUrl(normalizeUrl(url))) {
                    toast("Service URL must be valid (https://...).", "error");
                    return;
                  }

                  const newItem: ServiceItem = {
                    name,
                    description: (serviceDraft.description || "").trim() || "",
                    url: url ? normalizeUrl(url) : "",
                    priceMin: serviceDraft.priceMin || "",
                    priceMax: serviceDraft.priceMax || "",
                    priceUnit: serviceDraft.priceUnit || "",
                    currency: serviceDraft.currency || "",
                    position: services.length + 1,
                  };
                  setServices((prev) => [...prev, newItem]);
                  setServiceDraft({
                    name: "",
                    description: "",
                    url: "",
                    priceMin: "",
                    priceMax: "",
                    priceUnit: "",
                    currency: "",
                  });
                }}
              >
                + Add service
              </button>
              {services.length > 0 && (
                <button type="button" className="px-3 py-2 border rounded-lg" onClick={() => setServices([])}>
                  Clear services
                </button>
              )}
            </div>

            {services.length > 0 && (
              <ul className="mt-2 grid gap-3 text-sm">
                {services.map((s, idx) => (
                  <li key={idx} className="rounded-lg border bg-gray-50 px-3 py-2 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">
                        {idx + 1}. {s.name}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => setServices((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    </div>
                    {s.description && <div className="text-gray-700 whitespace-pre-wrap">{s.description}</div>}
                    {(s.priceMin || s.priceMax || s.currency || s.priceUnit) && (
                      <div className="text-xs text-gray-700 mt-1">
                        {s.currency ? `${s.currency} ` : ""}
                        {s.priceMin && s.priceMax
                          ? `${s.priceMin}–${s.priceMax}`
                          : s.priceMin
                          ? s.priceMin
                          : s.priceMax
                          ? `Up to ${s.priceMax}`
                          : ""}
                        {s.priceUnit ? ` per ${s.priceUnit}` : ""}
                      </div>
                    )}
                    {s.url && (
                      <a
                        href={normalizeUrl(s.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 underline mt-1"
                      >
                        View service page
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {services.length === 0 && (
              <div className="rounded-md border border-dashed bg-gray-50 p-3 text-sm text-gray-600">
                No services listed yet. Add the top services you want AI to describe and recommend.
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {services.length > 0 ? (
              <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Services (read-only on Lite)</div>
                    <div className="text-xs text-gray-600">Your services are saved. Upgrade to Plus to edit.</div>
                  </div>
                  <a
                    href="/pricing"
                    className="inline-flex items-center rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    Upgrade to edit
                  </a>
                </div>

                <ul className="mt-3 grid gap-3 text-sm">
                  {services.map((s, idx) => (
                    <li key={idx} className="rounded-lg border bg-gray-50 px-3 py-2">
                      <div className="font-medium">
                        {idx + 1}. {s.name}
                      </div>
                      {s.description ? <div className="mt-1 text-gray-700 whitespace-pre-wrap">{s.description}</div> : null}
                      {s.url ? (
                        <a
                          href={normalizeUrl(s.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline mt-2 inline-block"
                        >
                          View service page
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-gray-50 p-4 text-sm text-gray-600">
                Services are exported as structured{" "}
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Service</code> entities in JSON-LD, including
                price ranges when available. Upgrade to <span className="font-medium">Plus</span> to unlock the Services
                editor here.
              </div>
            )}
          </div>
        )}
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
          <SchemaPreviewButton slug={(serverSlug as string) || (profileId as string)} includeAll={true} pretty={true} />
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

      {/* ---- VERIFY SECTION ---- */}
      <section id="verify" className="scroll-mt-24">
        <VerificationCard
          profileId={profileId ?? undefined}
          initialDomain={website ?? ""}
          initialStatus={verificationStatus as any}
          onStatusChange={(status: VerificationStatus) => setVerificationStatus(status)}
        />
      </section>

      {/* ---- LINKED ACCOUNTS TILE (standalone card) ---- */}
      <section className="mt-6">
        <LinkedAccountsCard />
      </section>

      {/* Billing / subscription helper – last, under Linked Accounts */}
      <section className="mt-6">
        <div className="rounded-xl border bg-neutral-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Manage your subscription</h2>
            <p className="mt-1 text-xs text-neutral-600 max-w-md">
              Need to change plans, update your card, or cancel? Use the button to open the secure Stripe Billing Portal.
              Your subscription stays active until the end of your current billing period.
            </p>
          </div>
          <ManageBillingButton label="Open billing portal" className="text-xs md:text-sm px-4 py-2" />
        </div>
      </section>
    </div>
  );
}
