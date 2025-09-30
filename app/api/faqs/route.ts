// app/api/faqs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logChange } from "@/lib/changeLog";
import { ChangeAction, ChangeEntity } from "@prisma/client";
// ✅ Use enforcePlan (1 arg) instead of requirePlan
import { enforcePlan } from "@/lib/entitlements";

const upsertSchema = z.object({
  profileId: z.string().cuid(),
  items: z.array(
    z.object({
      id: z.string().cuid().optional(),
      position: z.number().int().min(0).default(0),
      question: z.string().min(3),
      answer: z.string().min(1),
      isPublic: z.boolean().optional().default(true),
    })
  ),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ ok: false, message: "profileId required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, user: { email: session.user.email } },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  const items = await prisma.fAQItem.findMany({
    where: { profileId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  // Gate writes at PRO+
  await enforcePlan("PRO");

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data = upsertSchema.parse(body);

  const owner = await prisma.profile.findFirst({
    where: { id: data.profileId, user: { email: session.user.email } },
    select: { id: true, userId: true },
  });
  if (!owner) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  // Replace-all semantics (simplifies ordering)
  const before = await prisma.fAQItem.findMany({ where: { profileId: data.profileId } });

  await prisma.$transaction([
    prisma.fAQItem.deleteMany({ where: { profileId: data.profileId } }),
    prisma.fAQItem.createMany({
      data: data.items.map((it, idx) => ({
        id: it.id ?? undefined,
        profileId: data.profileId,
        position: it.position ?? idx,
        question: it.question,
        answer: it.answer,
        isPublic: it.isPublic ?? true,
      })),
    }),
  ]);

  const after = await prisma.fAQItem.findMany({ where: { profileId: data.profileId } });

  await logChange({
    userId: owner.userId,
    profileId: data.profileId,
    entity: ChangeEntity.FAQ,
    entityId: null,
    action: ChangeAction.UPDATE,
    field: "FAQItem[]",
    before,
    after,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await enforcePlan("PRO");

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, message: "id required" }, { status: 400 });
  }

  const item = await prisma.fAQItem.findUnique({
    where: { id },
    include: { profile: { include: { user: true } } },
  });
  if (!item || item.profile.user.email !== session.user.email) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  await prisma.fAQItem.delete({ where: { id } });

  await logChange({
    userId: item.profile.userId,
    profileId: item.profileId,
    entity: ChangeEntity.FAQ,
    entityId: id,
    action: ChangeAction.DELETE,
    before: item,
    after: null,
  });

  return NextResponse.json({ ok: true });
}
