import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const endpoints = [
    "/api/auth/providers",
    "/api/auth/csrf",
    "/api/auth/session",
  ];

  const results: Array<{
    path: string;
    status: number;
    contentType: string;
    ok: boolean;
    bodyPreview: string;
    error?: string;
  }> = [];

  for (const path of endpoints) {
    const url = origin + path;
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();

      results.push({
        path,
        status: res.status,
        contentType,
        ok: res.ok && contentType.includes("application/json"),
        bodyPreview: text.slice(0, 250),
      });
    } catch (err: any) {
      results.push({
        path,
        status: 0,
        contentType: "",
        ok: false,
        bodyPreview: "",
        error: err?.message || String(err),
      });
    }
  }

  const allOk = results.every(r => r.ok);

  return NextResponse.json(
    { ok: allOk, origin, results },
    { status: allOk ? 200 : 503 }
  );
}
