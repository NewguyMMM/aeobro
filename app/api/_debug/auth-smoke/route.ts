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

  const results: any[] = [];

  for (const path of endpoints) {
    const url = origin + path;
    try {
      const res = await fetch(url, { headers: { "accept": "application/json" } });
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();

      results.push({
        path,
        status: res.status,
        contentType: ct,
        bodyPreview: text.slice(0, 250), // safe preview
        ok: res.ok && ct.includes("application/json"),
      });
    } catch (err: any) {
      results.push({
        path,
        status: 0,
        contentType: "",
        bodyPreview: "",
        ok: false,
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
