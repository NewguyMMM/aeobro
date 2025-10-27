// lib/auth.ts
// Updated: 2025-10-27 12:38 ET
import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { Resend } from "resend";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";
import { compare } from "bcryptjs";

const resend = new Resend(process.env.RESEND_API_KEY);

// Hard-coded brand blue to match site sign-in button
const BRAND_BLUE = "#2563EB"; // Tailwind blue-600

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // --- Email magic link via Resend ---
    EmailProvider({
      from: process.env.EMAIL_FROM, // e.g., 'AEOBRO <login@aeobro.com>'
      maxAge: 10 * 60, // 10 minutes; tokens are single-use by NextAuth
      async sendVerificationRequest({ identifier, url }) {
        const year = new Date().getFullYear();

        // Optional device/IP hints (best-effort, safe to fail silently)
        let ip = "Unknown IP";
        let ua = "Unknown device";
        try {
          const { headers } = await import("next/headers");
          ip = headers().get("x-forwarded-for") || ip;
          ua = headers().get("user-agent") || ua;
        } catch {
          // noop for build/edge differences
        }

        const html = `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;padding:24px 0;text-align:center">
  <tr>
    <td>
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 24px;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222;text-align:left;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <div style="text-align:center;margin-bottom:16px;line-height:1">
          <span style="font-size:22px;font-weight:700;color:#111;letter-spacing:0.2px;">AEO</span><span style="font-size:22px;font-weight:700;letter-spacing:0.2px;color:${BRAND_BLUE};">BRO</span>
        </div>

        <p style="font-size:16px;margin:0 0 24px">Click below to securely sign in:</p>

        <p style="text-align:center;margin:0 0 32px">
          <a href="${url}" style="display:inline-block;padding:12px 24px;background:${BRAND_BLUE};color:#ffffff !important;font-weight:600;border-radius:10px;text-decoration:none;border:1px solid ${BRAND_BLUE}">
            Sign in to AEOBRO
          </a>
        </p>

        <p style="font-size:13px;color:#777;line-height:1.5;margin:0">
          This link expires in <strong>10 minutes</strong> and can only be used once.<br/>
          If you didn’t request this, you can safely ignore this email.
        </p>
        <p style="font-size:11px;color:#9aa3b2;line-height:1.4;margin-top:10px">
          Request from: ${ip} — ${ua}
        </p>
      </div>

      <p style="font-size:12px;color:#aaa;margin:16px 0 0">© ${year} AEOBRO</p>
    </td>
  </tr>
</table>
        `.trim();

        const text = `Sign in to AEOBRO

Use the link below to sign in (expires in 10 minutes, single-use):
${url}

If you did not request this, you can safely ignore this email.`;

        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: identifier,
          subject: "Your AEOBRO sign-in link",
          html,
          text,
        });

        if (error) throw new Error(`Resend error: ${error.message || String(error)}`);
      },
    }),

    // --- Credentials (with Cloudflare Turnstile) ---
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        let token: string | undefined;
        try {
          // @ts-expect-error: App Router runtime provides formData()
          const form = await req?.formData?.();
          token = (form?.get?.("cf-turnstile-response") as string | undefined) ?? undefined;
        } catch {
          token = (credentials as any)?.["cf-turnstile-response"] as string | undefined;
        }
        const { ok } = await verifyTurnstileToken(token);
        if (!ok) throw new Error("CAPTCHA verification failed");

        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordHash = (user as any)?.passwordHash as string | undefined | null;
        if (!passwordHash || typeof passwordHash !== "string" || passwordHash.length < 8) return null;

        const isValid = await compare(password, passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),

    // --- Google OAuth (for Platform Verification: YouTube) ---
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
          prompt: "consent",
          access_type: "offline",
        },
      },
    }),
  ],

  callbacks: {
    // Persist user id and capture Google tokens
    async jwt({ token, user, account }) {
      if (user?.id) token.sub = user.id;

      // On initial Google sign-in, store access/refresh in the JWT
      if (account?.provider === "google") {
        if (account.access_token) token.googleAccessToken = account.access_token;
        if (account.refresh_token) token.googleRefreshToken = account.refresh_token;
        if (typeof account.expires_at === "number") token.googleExpiresAt = account.expires_at;
      }

      return token;
    },

    // Expose Google access token on the session for API routes to use
    async session({ session, token }) {
      if (token?.sub) (session.user as any).id = token.sub;
      if (token?.googleAccessToken) (session as any).googleAccessToken = token.googleAccessToken;
      if (token?.googleRefreshToken) (session as any).googleRefreshToken = token.googleRefreshToken;
      if (token?.googleExpiresAt) (session as any).googleExpiresAt = token.googleExpiresAt;
      return session;
    },

    // (Optional) you could restrict Google sign-ins here if needed
    async signIn({ account }) {
      // Allow all providers; verification flow is handled post-login.
      return true;
    },
  },

  // Auto-stamp emailVerified on first successful sign-in (magic-link)
  events: {
    async signIn({ user }) {
      try {
        if (!user?.id) return;

        // Read from Prisma to avoid TS issues and needless writes
        const existing = await prisma.user.findUnique({
          where: { id: user.id },
          select: { emailVerified: true },
        });

        if (!existing?.emailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          });
        }
      } catch {
        // non-fatal
      }
    },
  },

  pages: {
    signIn: "/signin",
  },
};
