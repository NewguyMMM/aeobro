import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mode = process.env.PAYWALL_MODE ?? "(unset)";
  const publicMode = process.env.NEXT_PUBLIC_PAYWALL_MODE ?? "(unset)";
  const list = (process.env.BETA_ALLOWLIST ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  return NextResponse.json({
    mode,
    NEXT_PUBLIC_PAYWALL_MODE: publicMode,
    allowlistCount: list.length,
    allowlistSample: list.slice(0, 5),
  });
}
