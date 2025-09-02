import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import type { NextAuthOptions } from "next-auth";
import { resend, FROM, authEmailHtml, welcomeHtml } from "@/lib/email";

// If you use Prisma or another Adapter, import & add it here.
// import { PrismaAdapter } from "@next-auth/prisma-adapter";
// import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      async sendVerificationRequest({ identifier, url }) {
        const { host } = new URL(url);
        await resend.emails.send({
          from: FROM.login,               // 👈 login@aeobro.com
          to: identifier,
          subject: `Sign in to ${host}`,
          html: authEmailHtml(url, host),
          text: `Sign in to ${host}\n${url}\n`,
          headers: {
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "List-Unsubscribe": "<mailto:unsubscribe@aeobro.com>",
          },
        });
      },
      maxAge: 15 * 60, // 15 minutes
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",   // keep if you have a custom sign-in page
  },
  // Send welcome email on first user creation
  events: {
    async createUser({ user }) {
      if (!user?.email) return;
      await resend.emails.send({
        from: FROM.welcome,              // 👈 welcome@aeobro.com
        to: user.email,
        subject: "Welcome to AEOBRO",
        html: welcomeHtml(),
        text: "Welcome to AEOBRO! Open your dashboard: https://aeobro.vercel.app/dashboard",
      });
    },
  },
  // (Optional) tighten security or enrich tokens here
  // callbacks: {...},
  theme: { colorScheme: "light" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
