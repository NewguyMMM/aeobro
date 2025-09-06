// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";

// Uses your existing email util
import { resend, FROM, authEmailHtml } from "@/lib/email";

// If you later switch to Prisma Adapter, uncomment and wire it up:
// import { PrismaAdapter } from "@next-auth/prisma-adapter";
// import { prisma } from "@/lib/prisma";

const scopes =
  process.env.GOOGLE_AUTH_SCOPES ??
  "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // Magic link sign-in via Resend
    EmailProvider({
      async sendVerificationRequest({ identifier, url }) {
        const { host } = new URL(url);
        await resend.emails.send({
          from: FROM,
          to: identifier,
          subject: `Sign in to ${host}`,
          html: authEmailHtml({ url, host }),
        });
      },
    }),

    // Google OAuth (used for Platform Verification / Lite)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: scopes,
          prompt: "consent", // ensures we can fetch profile info reliably
        },
      },
      checks: ["pkce", "state"],
    }),
  ],

  // Make the user id available in the session object
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        // @ts-expect-error - augment at runtime
        session.user.id = token.sub;
      }
      return session;
    },
  },

  // IMPORTANT: Ensure NEXTAUTH_URL and NEXTAUTH_SECRET are set in Vercel env.
  // NEXTAUTH_URL should be your deployed URL, e.g. https://aeobro.vercel.app
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
