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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // --- Email magic-link via Resend API (not SMTP) ---
    EmailProvider({
      from: process.env.EMAIL_FROM, // e.g. "AEOBRO <login@aeobro.com>"
      async sendVerificationRequest({ identifier, url }) {
        const html = `
          <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
            <h2>Sign in to AEOBRO</h2>
            <p>Click the button to sign in:</p>
            <p>
              <a href="${url}" style="display:inline-block;padding:10px 16px;background:#000;color:#fff;text-decoration:none;border-radius:6px">
                Sign in
              </a>
            </p>
            <p style="color:#666;font-size:12px;margin-top:16px">
              If you didn’t request this, you can safely ignore this email.
            </p>
          </div>
        `;

        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: identifier,
          subject: "Your AEOBRO sign-in link",
          html,
        });

        if (error) {
          throw new Error(`Resend error: ${error.message || String(error)}`);
        }
      },
    }),

    // --- Credentials login with Turnstile enforcement ---
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // Turnstile verification
        let token: string | undefined;
        try {
          // @ts-expect-error App Router runtime provides formData()
          const form = await req?.formData?.();
          token = (form?.get?.("cf-turnstile-response") as string | undefined) ?? undefined;
        } catch {
          token = (credentials as any)?.["cf-turnstile-response"] as string | undefined;
        }
        const { ok } = await verifyTurnstileToken(token);
        if (!ok) throw new Error("CAPTCHA verification failed");

        // Credential validation
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
    signIn: "/signin", // use your custom sign-in page
  },
};
