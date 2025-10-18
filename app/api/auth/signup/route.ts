import { NextResponse } from "next/server";
import { extractAndVerifyFromRequest } from "@/lib/verifyTurnstile";

export async function POST(req: Request) {
  const { ok } = await extractAndVerifyFromRequest(req);
  if (!ok) return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });

  const form = await req.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  // TODO: create user, hash password, etc.
  return NextResponse.json({ ok: true });
}
