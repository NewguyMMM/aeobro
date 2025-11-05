// app/api/profile/logo/route.ts
// 📅 Created: 2025-11-05 06:49 ET
// 📅 Updated: 2025-11-05 06:57 ET
// Handles logo upload and safely replaces the previous blob.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { storePublicImage, removePublicImage } from "@/lib/storage";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Type not allowed" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Too large" }, { status: 413 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true, logoUrl: true }, // ← no `plan` here
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Name by timestamp; deterministic enough for single-logo flow.
    const ext = extFromType(file.type);
    const path = `logos/${userId}/${Date.now()}.${ext}`;

    // Upload through storage adapter (Vercel Blob today; R2/S3 later).
    const saved = await storePublicImage(path, file);

    // Persist new URL
    await prisma.profile.update({
      where: { userId },
      data: { logoUrl: saved.url },
    });

    // Fire-and-forget delete of the previous blob if different
    if (profile.logoUrl && profile.logoUrl !== saved.url) {
      removePublicImage(profile.logoUrl).catch(() => {});
    }

    return NextResponse.json({ ok: true, url: saved.url });
  } catch (err) {
    console.error("Logo upload failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function extFromType(t: string) {
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  return "jpg"; // default
}
