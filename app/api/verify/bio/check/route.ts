import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { fetchText } from "@/lib/verify";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const bc = await prisma.bioCode.findUnique({ where: { id } });
  if (!bc || bc.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const html = await fetchText(bc.profileUrl);
    const ok = html.includes(bc.code);

    const updated = await prisma.bioCode.update({
      where: { id: bc.id },
      data: {
        status: ok ? "VERIFIED" : "PENDING",
        verifiedAt: ok ? new Date() : null,
      },
    });

    return NextResponse.json({ verified: ok, status: updated.status });
  } catch (e) {
    return NextResponse.json({ verified: false, error: "FETCH_FAILED" }, { status: 502 });
  }
}
