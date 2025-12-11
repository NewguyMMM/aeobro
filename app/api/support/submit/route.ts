// app/api/support/submit/route.ts
// 📅 Updated: 2025-12-11 15:22 ET
// Creates a SupportTicket and emails AEOBRO to the correct inbox based on category.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend =
  process.env.RESEND_API_KEY && new Resend(process.env.RESEND_API_KEY);

// Fallback / default support email (used only as a last resort)
const DEFAULT_SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@aeobro.com";

// Allowed enums must match prisma.schema (SupportCategory)
const ALLOWED_CATEGORIES = [
  "BILLING",
  "VERIFICATION",
  "TECHNICAL",
  "OTHER",
] as const;

type SupportCategory = (typeof ALLOWED_CATEGORIES)[number];

// Map category → destination inbox
const CATEGORY_TO_ADDRESS: Record<SupportCategory, string> = {
  TECHNICAL: "support@aeobro.com",
  BILLING: "billing@aeobro.com",
  VERIFICATION: "support@aeobro.com",
  OTHER: "contact@aeobro.com",
};

// Human-readable labels for email subject/body
const CATEGORY_LABEL: Record<SupportCategory, string> = {
  TECHNICAL: "Technical issue",
  BILLING: "Billing / subscription",
  VERIFICATION: "Verification / domain / platform",
  OTHER: "Other",
};

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

    // Decide which inbox to send to
    const toAddress =
      CATEGORY_TO_ADDRESS[category] || DEFAULT_SUPPORT_EMAIL;
    const catLabel = CATEGORY_LABEL[category];
    const previewId = ticket.id.slice(0, 8);
    const planLabel = (session?.user as any)?.plan ?? "UNKNOWN";
    const safeSubject = subject.slice(0, 200);

    // Fire-and-forget email to the appropriate AEOBRO inbox (if configured)
    if (resend && toAddress) {
      resend.emails
        .send({
          from: "AEOBRO Support <no-reply@aeobro.com>",
          to: [toAddress],
          // Resend v2 uses snake_case for reply-to
          reply_to: email,
          subject: `[${catLabel}] #${previewId} – ${safeSubject}`,
          html: `
            <h2>New AEOBRO support ticket</h2>
            <p><strong>ID:</strong> ${ticket.id}</p>
            <p><strong>Created:</strong> ${new Date(
              ticket.createdAt
            ).toISOString()}</p>
            <p><strong>Category:</strong> ${catLabel} (${category})</p>
            <p><strong>Status:</strong> ${ticket.status}</p>
            <p><strong>User:</strong> ${
              userId || "anonymous"
            } (plan: ${planLabel})</p>
            <p><strong>From email:</strong> ${email}</p>
            <p><strong>Routed to inbox:</strong> ${toAddress}</p>
            <hr />
            <p><strong>Subject:</strong> ${safeSubject}</p>
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

// Explicit empty export so TypeScript treats this as a module in all configs
export {};
