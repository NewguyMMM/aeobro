// app/api/profile/ensure-unique-slug/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toKebab, isSlugAllowed } from "@/lib/slug";

type Body = { base?: string; excludeId?: string | null };

export async function POST(req: Request) {
  const { base, excludeId }: Body = await req.json();
  const start = toKebab(base || "");
  if (!start) {
    return NextResponse.json({ error: "Missing base" }, { status: 400 });
  }

  let candidate = start;
  for (let i = 0; i < 200; i++) {
    const slug = i === 0 ? candidate : `${start}-${i + 1}`;
    if (!isSlugAllowed(slug)) continue;
    const existing = await prisma.profile.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ slug });
    }
  }
  return NextResponse.json({ error: "No available slug variants" }, { status: 409 });
}
