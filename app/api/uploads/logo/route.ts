// app/api/uploads/logo/route.ts
// ✅ Node runtime (needed for @vercel/blob server SDK)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(req: Request) {
  // Optional: require auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse multipart/form-data
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  // Create a stable, per-user filename prefix
  const ext =
    file.type === "image/png" ? ".png" :
    file.type === "image/jpeg" ? ".jpg" :
    file.type === "image/webp" ? ".webp" :
    ".svg";

  const key = `logos/${session.user.id}/${Date.now()}${ext}`;

  // Upload to Vercel Blob (public URL)
  const { url } = await put(key, file, { access: "public", addRandomSuffix: false });

  return NextResponse.json({ url });
}
