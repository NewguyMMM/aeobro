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
 * - If you plan to support Credentials login, add a string column like `passwordHash` to your User model.
 *   Until then, this code treats it as optional and will reject credential logins when missing.
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // 1) Email (magic link)
    EmailProvider({
      server: process.env.EMAIL_SERVER!, // SMTP URL
      from: process.env.EMAIL_FROM!,     // e.g., hello@aeobro.com
    }),

    // 2) Credentials with Turnstile in authorize()
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
          // In App Router, NextAuth's `req` has formData() at runtime
          // @ts-expect-error - types don't show it, but it's available
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

        // Treat passwordHash as optional in your current schema
        const passwordHash = (user as any)?.passwordHash as string | undefined | null;
        if (!passwordHash || typeof passwordHash !== "string" || passwordHash.length < 8) {
          // No stored password → reject credential login gracefully
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
    // signIn: "/signin", // keep if you have a custom page
  },
};
