// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const LinkItem = z.object({
  label: z.string().max(60).optional().default(""),
  url: z.string().url().max(300).optional().or(z.literal("")).default(""),
});

const ProfileSchema = z.object({
  displayName: z.string().max(120).optional().nullable(),
  tagline: z.string().max(160).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  website: z.string().url().max(200).optional().nullable().or(z.literal("")),
  bio: z.string().max(2000).optional().nullable(),
  links: z.array(LinkItem).max(10).optional().default([]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  return NextResponse.json(profile ?? { userId: user.id, links: [] });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }

  const payload = parsed.data;

  const saved = await prisma.profile.upsert({
    where: { userId: user.id },
    update: payload,
    create: { userId: user.id, ...payload },
  });

  return NextResponse.json(saved);
}
