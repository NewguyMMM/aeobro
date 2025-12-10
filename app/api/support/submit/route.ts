// app/api/support/submit/route.ts
// 📅 Added: 2025-12-10 06:12 ET
// Creates a SupportTicket and (optionally) emails AEOBRO support.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend =
  process.env.RESEND_API_KEY && new Resend(process.env.RESEND_API_KEY);

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@aeobro.com";

// Allowed enums must match prisma.schema
const ALLOWED_CATEGORIES = ["BILLING", "VERIFICATION", "TECHNICAL", "OTHER"] as const;
type SupportCategory = (typeof ALLOWED_CATEGORIES)[number];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email =
    (body.email as string | undefined)?.trim() ||
    (session?.user?.email ?? "").trim();
  const subject = (body.subject as string | undefined)?.trim() || "";
  const message = (body.message as string | undefined)?.trim() || "";
  const rawCategory =
    (body.category as string | undefined)?.toUpperCase().trim() || "OTHER";

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Email is required" },
      { status: 400 }
    );
  }
  if (!subject) {
    return NextResponse.json(
      { ok: false, error: "Subject is required" },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Message is required" },
      { status: 400 }
    );
  }

  const category: SupportCategory = ALLOWED_CATEGORIES.includes(
    rawCategory as SupportCategory
  )
    ? (rawCategory as SupportCategory)
    : "OTHER";

  const userId = (session?.user as any)?.id ?? null;

  const userAgent = req.headers.get("user-agent") ?? undefined;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ipHash = ip
    ? crypto.createHash("sha256").update(ip).digest("hex")
    : undefined;

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        email,
        subject,
        message,
        category,
        status: "OPEN",
        userId,
        userAgent,
        ipHash,
      },
    });

    // Fire-and-forget email to support (if configured)
    if (resend && SUPPORT_EMAIL) {
      const previewId = ticket.id.slice(0, 8);
      const planLabel = (session?.user as any)?.plan ?? "UNKNOWN";

      // Don't throw if email fails – ticket is already stored.
      resend.emails
        .send({
          from: "AEOBRO Support <no-reply@aeobro.com>",
          to: [SUPPORT_EMAIL],
          subject: `[AEOBRO Support] #${previewId} – ${subject}`,
          html: `
            <h2>New AEOBRO support ticket</h2>
            <p><strong>ID:</strong> ${ticket.id}</p>
            <p><strong>Created:</strong> ${new Date(
              ticket.createdAt
            ).toISOString()}</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Status:</strong> ${ticket.status}</p>
            <p><strong>User:</strong> ${
              userId || "anonymous"
            } (plan: ${planLabel})</p>
            <p><strong>Email:</strong> ${email}</p>
            <hr />
            <p><strong>Subject:</strong> ${subject}</p>
            <pre style="white-space:pre-wrap;font-family:system-ui, -apple-system, sans-serif;">
${message}
            </pre>
          `.trim(),
        })
        .catch((err) => {
          console.error("[support-email] Failed to send support email", err);
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[support-ticket] Error creating ticket", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create support ticket" },
      { status: 500 }
    );
  }
}
