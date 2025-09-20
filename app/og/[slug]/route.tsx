// app/og/[slug]/route.tsx
import { ImageResponse } from "next/og";
import { getBaseUrl } from "@/lib/getBaseUrl";

/**
 * Open Graph image for public profiles at /og/<slug>
 * - Edge runtime (fast; no Prisma)
 * - Pulls data from /api/profile/<slug>/schema (JSON-LD)
 * - ISR 1h to keep costs low; revalidate on save
 */
export const runtime = "edge";
export const revalidate = 3600;

export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

type Ctx = { params: { slug: string } };

function pick(obj: Record<string, any>) {
  const type = Array.isArray(obj["@type"]) ? obj["@type"][0] : obj["@type"];
  const isPerson = type === "Person";
  const isOrg = type === "Organization" || type === "LocalBusiness";

  const name =
    (isPerson ? obj.name : undefined) ??
    (isOrg ? obj.name : undefined) ??
    obj.alternateName ??
    obj.legalName ??
    "";

  const tagline =
    obj.description ??
    obj.slogan ??
    obj.tagline ??
    "";

  const logo =
    (obj.logo && (typeof obj.logo === "string" ? obj.logo : obj.logo?.url)) ||
    (obj.image && (typeof obj.image === "string" ? obj.image : obj.image?.url)) ||
    null;

  return { name, tagline, logo };
}

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = params;
  const base = getBaseUrl();

  // Fetch JSON-LD for this profile; cache it at the edge too
  const schemaUrl = `${base}/api/profile/${encodeURIComponent(slug)}/schema`;
  const res = await fetch(schemaUrl, {
    next: { revalidate: 3600, tags: [`profile:${slug}:schema`] },
  });

  if (!res.ok) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0b1220",
            color: "white",
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          Profile not found
        </div>
      ),
      { ...size }
    );
  }

  const schema = await res.json();
  const { name, tagline, logo } = pick(schema);

  const bg = "linear-gradient(135deg, #0b1220 0%, #0e203a 60%, #123d5a 100%)";
  const accent = "#58a6ff";
  const muted = "rgba(255,255,255,0.7)";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundImage: bg,
          padding: 64,
        }}
      >
        {/* Left: text block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            width: "70%",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "white",
              letterSpacing: -1,
              lineHeight: 1.1,
            }}
          >
            {name || slug}
          </div>
          {tagline ? (
            <div
              style={{
                fontSize: 36,
                color: muted,
                lineHeight: 1.35,
                maxWidth: 900,
              }}
            >
              {tagline}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              fontSize: 28,
              color: accent,
            }}
          >
            <div
              style={{
                height: 8,
                width: 8,
                borderRadius: 999,
                background: accent,
              }}
            />
            aeobro.com/p/{slug}
          </div>
        </div>

        {/* Right: logo/avatar if available */}
        <div
          style={{
            display: "flex",
            width: "25%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {logo ? (
            <img
              src={logo}
              alt="logo"
              width={280}
              height={280}
              style={{
                borderRadius: 28,
                objectFit: "cover",
                boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              }}
            />
          ) : null}
        </div>
      </div>
    ),
    { ...size }
  );
}
