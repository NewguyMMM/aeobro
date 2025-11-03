// app/api/uploads/logo/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED: Set<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const type = file.type || "";
    if (!ALLOWED.has(type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });

    const ext =
      type === "image/png" ? ".png" :
      type === "image/jpeg" ? ".jpg" :
      type === "image/webp" ? ".webp" : ".svg";

    const key = `logos/${session.user.id}/${Date.now()}${ext}`;

    const { url } = await put(key, file, { access: "public", addRandomSuffix: false });
    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    console.error("[logo-upload] fatal:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
