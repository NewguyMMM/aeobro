// app/api/uploads/logo/route.ts
// ✅ Production: Node runtime, auth required, strict types, quiet errors.
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

export async function POST(req: Request) {
  try {
    // Require a signed-in user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // Parse multipart/form-data
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // Validate
    const type = file.type || "";
    if (!ALLOWED.has(type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    // Pick extension from MIME
    const ext =
      type === "image/png" ? ".png" :
      type === "image/jpeg" ? ".jpg" :
      type === "image/webp" ? ".webp" : ".svg";

    // Stable per-user path; add timestamp to avoid collisions
    const key = `logos/${userId}/${Date.now()}${ext}`;

    // Upload to Vercel Blob (no extra config needed on Vercel)
    const { url } = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    // Keep user-facing response minimal; log details server-side.
    console.error("[logo-upload] fatal:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

// Disallow other methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
