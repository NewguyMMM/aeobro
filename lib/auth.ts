// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";
import { compare } from "bcryptjs"; // or your password verifier

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // 1) Email (magic-link)
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
      // You may already have additional options here (maxAge, etc.)
    }),

    // 2) Credentials with Turnstile inside `authorize`
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Not strictly required to declare, but harmless:
        // "cf-turnstile-response": { label: "Turnstile", type: "text" },
      },
      async authorize(credentials, req) {
        // ---- Turnstile verification ----
        let token: string | undefined;

        // Prefer: try to read token from the posted form (works in App Router)
        try {
          // @ts-expect-error - `req` in App Router has formData()
          const form = await req?.formData?.();
          token = (form?.get?.("cf-turnstile-response") as string | undefined) ?? undefined;
        } catch {
          // Fallback: read from declared credentials if present
          token = (credentials as any)?.["cf-turnstile-response"] as string | undefined;
        }

        const { ok } = await verifyTurnstileToken(token);
        if (!ok) {
          throw new Error("CAPTCHA verification failed");
        }

        // ---- Your normal credential check below ----
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // Replace with your real hash check:
        if (!user.passwordHash) return null;
        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
  ],

  callbacks: {
    // Keep your existing callbacks if you already had them.
    // We do NOT try to read `req` here anymore, to avoid the compile error.
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
    // Keep your custom pages if defined
    // signIn: "/signin",
  },
};
