// lib/email.ts
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

/**
 * From-addresses for different email types.
 * You can override with env vars if you want separate mailboxes.
 */
export const FROM = {
  login: process.env.EMAIL_FROM_LOGIN || "AEOBRO <login@aeobro.com>",
  welcome: process.env.EMAIL_FROM_WELCOME || "AEOBRO <welcome@aeobro.com>",
  updates: process.env.EMAIL_FROM_UPDATES || "AEOBRO <updates@aeobro.com>",
};

/**
 * Authentication (magic-link) email HTML
 */
export function authEmailHtml({
  url,
  host,
}: {
  url: string;
  host: string;
}) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size:16px; line-height:1.5;">
      <h2>Sign in to ${host}</h2>
      <p>Click the button below to sign in. This link expires in 15 minutes.</p>
      <p>
        <a href="${url}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#10b981;color:#fff;text-decoration:none;">
          Sign in
        </a>
      </p>
      <p>If the button doesn't work, paste this URL into your browser:</p>
      <p style="word-break:break-all;color:#555">${url}</p>
      <hr />
      <p style="font-size:12px;color:#888">If you didn’t request this email, you can ignore it.</p>
    </div>
  `;
}

/**
 * Welcome email HTML
 * - Defaults to /login (NextAuth entry).
 * - If you prefer dropping users into the app, change cta to /dashboard.
 */
export function welcomeHtml() {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const cta = `${base}/login`;
  // Alternative:
  // const cta = `${base}/dashboard`;

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size:16px; line-height:1.6;">
      <h2>Welcome to AEOBRO</h2>
      <p>You're in. Create your AI Profile and help AI find you.</p>
      <p>
        <a href="${cta}"
           style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111;color:#fff;text-decoration:none;">
           Go to Dashboard
        </a>
      </p>
      <p style="color:#666">Tip: Keep your brand facts current to maximize AI visibility.</p>
    </div>
  `;
}
