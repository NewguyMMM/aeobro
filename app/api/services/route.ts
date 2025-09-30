// app/api/services/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logChange } from "@/lib/changeLog";
import { ChangeAction, ChangeEntity } from "@prisma/client";
// ✅ Use enforcePlan (1 arg)
import { enforcePlan } from "@/lib/entitlements";

const decimal = z
  .union([z.number(), z.string()])
  .transform((v) => (v === "" || v === null ? undefined : v));

const upsertSchema = z.object({
  profileId: z.string().cuid(),
  items: z.array(
    z.object({
      id: z.string().cuid().optional(),
      position: z.number().int().min(0).default(0),
      name: z.string().min(2),
      description: z.string().optional(),
      url: z.string().url().optional(),
      priceMin: decimal.optional(),
      priceMax: decimal.optional(),
      priceUnit: z.string().optional(),
      currency: z.string().length(3).optional(),
      isPublic: z.boolean().optional().default(true),
    })
  ),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");
  if (!profileId)
    return NextResponse.json({ ok: false, message: "profileId required" }, { status: 400 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, user: { email: session.user.email } },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const items = await prisma.serviceItem.findMany({
    where: { profileId },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  // Gate writes at PRO+
  await enforcePlan("PRO");

  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = upsertSchema.parse(body);

  const owner = await prisma.profile.findFirst({
    where: { id: data.profileId, user: { email: session.user.email } },
    select: { id: true, userId: true },
  });
  if (!owner) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const before = await prisma.serviceItem.findMany({
    where: { profileId: data.profileId },
  });

  await prisma.$transaction([
    prisma.serviceItem.deleteMany({ where: { profileId: data.profileId } }),
    prisma.serviceItem.createMany({
      data: data.items.map((it, idx) => ({
        id: it.id ?? undefined,
        profileId: data.profileId,
        position: it.position ?? idx,
        name: it.name,
        description: it.description,
        url: it.url,
        priceMin: it.priceMin as any,
        priceMax: it.priceMax as any,
        priceUnit: it.priceUnit,
        currency: it.currency,
        isPublic: it.isPublic ?? true,
      })),
    }),
  ]);

  const after = await prisma.serviceItem.findMany({
    where: { profileId: data.profileId },
  });

  await logChange({
    userId: owner.userId,
    profileId: data.profileId,
    entity: ChangeEntity.SERVICE,
    entityId: null,
    action: ChangeAction.UPDATE,
    field: "ServiceItem[]",
    before,
    after,
  });

  return NextResponse.json({ ok: true });
}
