// app/api/support/submit/route.ts
// 📅 Updated: 2025-12-16 01:09 PM ET
// Single endpoint for Support + Contact.
// Creates SupportTicket first, then sends routed email via Resend (awaited), returns requestId for traceability.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// IMPORTANT: set this to a sender verified in Resend.
// Example: "AEOBRO <login@aeobro.com>" or "AEOBRO Support <login@aeobro.com>"
const SUPPORT_FROM = process.env.SUPPORT_FROM || "AEOBRO Support <login@aeobro.com>";

// Optional: backstop copy during launch week (your personal inbox)
const SUPPORT_BCC = process.env.SUPPORT_BCC || "";

// Fallback / default inbox
const DEFAULT_SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@aeobro.com";

// Allowed enums must match prisma.schema (SupportCategory)
const ALLOWED_CATEGORIES = ["BILLING", "VERIFICATION", "TECHNICAL", "OTHER"] as const;
type SupportCategory = (typeof ALLOWED_CATEGORIES)[number];

// Map category → destination inbox
const CATEGORY_TO_ADDRESS: Record<SupportCategory, string> = {
  TECHNICAL: "support@aeobro.com",
  BILLING: "billing@aeobro.com",
  VERIFICATION: "support@aeobro.com",
  OTHER: "contact@aeobro.com",
};

// Human-readable labels
const CATEGORY_LABEL: Record<SupportCategory, string> = {
  TECHNICAL: "Technical issue",
  BILLING: "Billing / subscription",
  VERIFICATION: "Verification / domain / platform",
  OTHER: "General / contact",
};

function safeTrim(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeCategory(raw: string): SupportCategory {
  const up = (raw || "").toUpperCase().trim();
  return ALLOWED_CATEGORIES.includes(up as SupportCategory) ? (up as SupportCategory) : "OTHER";
}

function makeRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

export async function POST(req: Request) {
  const requestId = makeRequestId();
  const session = await getServerSession(authOptions);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, requestId, error: "Invalid JSON body" }, { status: 400 });
  }

  // Support form fields (existing)
  const emailFromBody = safeTrim(body.email);
  const subjectFromBody = safeTrim(body.subject);
  const messageFromBody = safeTrim(body.message);
  const rawCategory = safeTrim(body.category) || "OTHER";

  // Contact-form-style optional fields (new)
  const name = safeTrim(body.name);
  const company = safeTrim(body.company);
  const pageUrl = safeTrim(body.pageUrl);

  const email = emailFromBody || safeTrim(session?.user?.email);
  const category = normalizeCategory(rawCategory);

  // If contact form doesn’t include a subject, synthesize one
  const subject =
    subjectFromBody ||
    (category === "OTHER" ? "Contact form submission" : `${CATEGORY_LABEL[category]} submission`);

  const message = messageFromBody;

  if (!email) {
    return NextResponse.json({ ok: false, requestId, error: "Email is required" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, requestId, error: "Message is required" }, { status: 400 });
  }

  const userId = (session?.user as any)?.id ?? null;

  const userAgent = req.headers.get("user-agent") ?? undefined;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    undefined;

  const ipHash = ip ? crypto.createHash("sha256").update(ip).digest("hex") : undefined;

  // Route inbox
  const toAddress = CATEGORY_TO_ADDRESS[category] || DEFAULT_SUPPORT_EMAIL;
  const catLabel = CATEGORY_LABEL[category];
  const planLabel = (session?.user as any)?.plan ?? "UNKNOWN";

  try {
    // 1) Store ticket first (never lose the lead)
    const ticket = await prisma.supportTicket.create({
      data: {
        email,
        subject: subject.slice(0, 200),
        message,
        category,
        status: "OPEN",
        userId,
        userAgent,
        ipHash,
      },
    });

    const previewId = ticket.id.slice(0, 8);
    const safeSubject = subject.slice(0, 200);

    const extraContextLines = [
      `Request ID: ${requestId}`,
      `Ticket ID: ${ticket.id}`,
      `Created: ${new Date(ticket.createdAt).toISOString()}`,
      `Category: ${catLabel} (${category})`,
      `Status: ${ticket.status}`,
      `User: ${userId || "anonymous"} (plan: ${planLabel})`,
      `From email: ${email}`,
      `Routed to inbox: ${toAddress}`,
      name ? `Name: ${name}` : "",
      company ? `Company: ${company}` : "",
      pageUrl ? `Page: ${pageUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // 2) Send email (awaited; no silent failures)
    if (!resend) {
      console.error("[support-email] Resend not configured (missing RESEND_API_KEY)", { requestId });
      return NextResponse.json(
        { ok: true, requestId, note: "Ticket saved; email not sent (Resend not configured)." },
        { status: 200 }
      );
    }

    const sendResult = await resend.emails.send({
      from: SUPPORT_FROM,
      to: [toAddress],
      bcc: SUPPORT_BCC ? [SUPPORT_BCC] : undefined,
      replyTo: email, // NOTE: replyTo is correct for current Resend SDK
      subject: `[${catLabel}] #${previewId} – ${safeSubject}`,
      html: `
        <h2>New AEOBRO message</h2>
        <pre style="white-space:pre-wrap;font-family:system-ui,-apple-system,sans-serif;">${escapeHtml(
          extraContextLines
        )}</pre>
        <hr />
        <p><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p>
        <pre style="white-space:pre-wrap;font-family:system-ui,-apple-system,sans-serif;">${escapeHtml(
          message
        )}</pre>
      `.trim(),
    });

    // Log provider response to Vercel logs for easy debugging
    console.log("[support-email] sent", {
      requestId,
      ticketId: ticket.id,
      toAddress,
      resendId: (sendResult as any)?.data?.id || null,
    });

    return NextResponse.json({ ok: true, requestId });
  } catch (err: any) {
    console.error("[support-submit] error", { requestId, err });
    return NextResponse.json(
      { ok: false, requestId, error: err?.message || "Failed to create support ticket" },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Explicit empty export so TypeScript treats this as a module in all configs
export {};
