// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";

import { Resend } from "resend";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";
import { compare } from "bcryptjs";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * NextAuth configuration
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // Magic-link via Resend API (no SMTP)
    EmailProvider({
      from: process.env.EMAIL_FROM, // e.g., 'AEOBRO <login@aeobro.com>'
      async sendVerificationRequest({ identifier, url }) {
        // Polished AEOBRO-branded HTML
        const html = `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;padding:24px 0;text-align:center">
    <tr>
      <td>
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 24px;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222;text-align:left;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
          <div style="text-align:center;margin-bottom:16px">
            <span style="font-size:22px;font-weight:600;color:#111;">AEOBRO</span>
          </div>
          <p style="font-size:16px;margin-bottom:24px">Click below to securely sign in:</p>
          <p style="text-align:center;margin-bottom:32px">
            <a href="${url}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;font-weight:500;border-radius:8px;text-decoration:none;">
              Sign in to AEOBRO
            </a>
          </p>
          <p style="font-size:13px;color:#777;line-height:1.4">
            If you didn’t request this, you can safely ignore this email.<br />
            This link will expire shortly for your security.
          </p>
        </div>
        <p style="font-size:12px;color:#aaa;margin-top:16px">© ${new Date().getFullYear()} AEOBRO</p>
      </td>
    </tr>
  </table>
        `.trim();

        // Plain-text fallback (better spam deliverability and accessibility)
        const text = `Sign in to AEOBRO

Use the link below to sign in:
${url}

If you did not request this, you can safely ignore this email.`;

        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: identifier,
          subject: "Your AEOBRO sign-in link",
          html,
          text,
        });

        if (error) {
          throw new Error(`Resend error: ${error.message || String(error)}`);
        }
      },
    }),

    // Credentials login with Turnstile enforcement
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // --- Turnstile verification ---
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

        // --- Credential validation ---
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordHash = (user as any)?.passwordHash as string | undefined | null;
        if (!passwordHash || typeof passwordHash !== "string" || passwordHash.length < 8) {
          return null;
        }

        const isValid = await compare(password, passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.sub) (session.user as any).id = token.sub;
      return session;
    },
  },

  pages: {
    signIn: "/signin",
  },
};
