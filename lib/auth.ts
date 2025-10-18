// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";

import { verifyTurnstileToken } from "@/lib/verifyTurnstile";
import { compare } from "bcryptjs";

/**
 * NOTE:
 * - Ensure your User model includes a `passwordHash` string field if you use Credentials.
 * - Your login form that posts to `/api/auth/callback/credentials` MUST include the
 *   Cloudflare Turnstile widget so the hidden `cf-turnstile-response` input is present.
 */

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // 1) Email (magic link) sign-in
    EmailProvider({
      server: process.env.EMAIL_SERVER!, // e.g., SMTP URL
      from: process.env.EMAIL_FROM!,     // e.g., hello@ytilt.com or hello@aeobro.com
      // You may add `maxAge`, `normalizeIdentifier`, etc. if you already use them
    }),

    // 2) Credentials sign-in with Turnstile enforcement inside `authorize`
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // --- Turnstile verification (App Router friendly) ---
        let token: string | undefined;

        try {
          // In the App Router, `req` has formData()
          // @ts-expect-error - NextAuth's type here is looser; formData exists at runtime
          const form = await req?.formData?.();
          token = (form?.get?.("cf-turnstile-response") as string | undefined) ?? undefined;
        } catch {
          // Fallback to posted credentials if present
          token = (credentials as any)?.["cf-turnstile-response"] as string | undefined;
        }

        const { ok } = await verifyTurnstileToken(token);
        if (!ok) {
          throw new Error("CAPTCHA verification failed");
        }

        // --- Your normal credential validation ---
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // Ensure your User model has `passwordHash` (string)
        if (!user.passwordHash) return null;

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        // Return the minimal user object for NextAuth
        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
  ],

  callbacks: {
    // Keep basic JWT/session wiring
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
    // If you have a custom sign-in page, keep it here. Otherwise comment out.
    // signIn: "/signin",
  },
};
