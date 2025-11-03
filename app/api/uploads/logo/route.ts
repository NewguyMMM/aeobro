// app/api/uploads/logo/route.ts
// ✅ Updated: 2025-11-03 — robust errors, session-aware key, matches client MIME/types
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = new Set<`${string}/${string}`>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    // Try to get a session; if it fails or is absent, we’ll still allow upload
    // so we can debug 500s. Once confirmed working, flip `allowAnon` to false.
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = session?.user?.id || "anon"; // <-- set to "anon" for now

    // Parse multipart/form-data
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError("Unable to parse form data", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("Missing file", 400);
    }

    const type = file.type || "";
    if (!ALLOWED.has(type)) {
      return jsonError(
        `Unsupported file type (${type || "unknown"}). Use PNG, JPEG, WebP, or SVG.`,
        415
      );
    }

    if (file.size > MAX_BYTES) {
      return jsonError(`File too large (> ${MAX_BYTES / (1024 * 1024)} MB)`, 413);
    }

    // Extension by content-type
    const ext =
      type === "image/png"
        ? ".png"
        : type === "image/jpeg"
        ? ".jpg"
        : type === "image/webp"
        ? ".webp"
        : ".svg";

    // Stable per-user (or anon) path
    const key = `logos/${userId}/${Date.now()}${ext}`;

    // Upload to Vercel Blob (public URL)
    const { url } = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch (err: any) {
    // Surface the actual error message to help diagnose 500s
    console.error("[logo-upload] server error:", err);
    return NextResponse.json(
      { error: err?.message || "Upload failed on server" },
      { status: 500 }
    );
  }
}

// Optional: make non-POSTs explicit
export async function GET() {
  return jsonError("Method not allowed", 405);
}
