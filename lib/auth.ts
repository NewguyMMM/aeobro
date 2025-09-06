// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.EMAIL_FROM!;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      async sendVerificationRequest({ identifier, url }) {
        const { host } = new URL(url);
        await resend.emails.send({
          from: FROM,
          to: identifier,
          subject: `Sign in to ${host}`,
          html: `<p>Click to sign in:</p><p><a href="${url}">Sign in</a></p>`,
          text: `Sign in to ${host}\n${url}`,
        });
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email as string;
      return session;
    },
  },
};
