import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The user has just signed in with Google (via a client flow) and we have their identity in the session.
  // Pull the provider account info from your existing account linking table if you use the NextAuth Adapter.
  // If you're not using the Adapter, you can accept a payload with the provider's external id.

  const { provider, externalId, handle, url } = await req.json();
  if (!provider || !externalId) return NextResponse.json({ error: "Missing provider/externalId" }, { status: 400 });

  const pa = await prisma.platformAccount.upsert({
    where: { provider_externalId: { provider, externalId } },
    create: {
      userId: session.user.id,
      provider,
      externalId,
      handle: handle || null,
      url: url || null,
      status: "VERIFIED",
      verifiedAt: new Date(),
    },
    update: {
      userId: session.user.id,
      handle: handle || null,
      url: url || null,
      status: "VERIFIED",
      verifiedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, id: pa.id });
}
