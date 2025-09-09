// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { resend, FROM, authEmailHtml, welcomeHtml } from "@/lib/email";

/** Ensure the magic-link host/protocol match NEXTAUTH_URL */
function forceAppOrigin(inputUrl: string): string {
  const appBase = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    const fixed = new URL(inputUrl);
    const base = new URL(appBase);
    fixed.protocol = base.protocol;
    fixed.host = base.host;
    return fixed.toString();
  } catch {
    return inputUrl;
  }
}

/** tiny logger */
const log = (level: "info" | "warn" | "error", msg: string, meta?: unknown) => {
  const payload = { level, msg, ...(meta ? { meta } : {}) };
  try {
    (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(
      JSON.stringify(payload)
    );
  } catch {
    console.log(level.toUpperCase(), msg, meta ?? "");
  }
};

/** send magic-link with resilience (Resend SDK v3: { data, error }) */
async function sendMagicLinkEmail(identifier: string, url: string) {
  const fixedUrl = forceAppOrigin(url);
  const { host } = new URL(fixedUrl);

  const sendOnce = async (tag: string) => {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || FROM.login || "AEOBRO <noreply@aeobro.com>",
      to: identifier,
      subject: `Sign in to ${host}`,
      html: authEmailHtml({ url: fixedUrl, host }),
      text: `Sign in to ${host}\n${fixedUrl}\n`,
      headers: { "X-Entity-Ref-ID": `auth-${tag}-${Date.now()}` },
    });
    if (error) throw new Error(error.message ?? String(error));
    return data?.id;
  };

  try {
    const id = await sendOnce("primary");
    log("info", "Auth email sent", { to: identifier, id });
  } catch (err: any) {
    log("error", "Auth email failed, retrying", { to: identifier, err: err?.message ?? String(err) });
    try {
      const id = await sendOnce("retry");
      log("warn", "Auth email retry success", { to: identifier, id });
    } catch (retryErr: any) {
      log("error", "Auth email retry failed", { to: identifier, err: retryErr?.message ?? String(retryErr) });
    }
  }
}

/** send welcome once after emailVerified using DB flag */
async function sendWelcomeIfFirstTime(userId: string, email?: string | null) {
  if (!email) return;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerified: true, welcomeSentAt: true },
    });
    if (!user) return;
    if (!user.emailVerified) return;
    if (user.welcomeSentAt) return;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || FROM.welcome || "AEOBRO <noreply@aeobro.com>",
      to: email,
      subject: "Welcome to AEOBRO 👋",
      html: welcomeHtml(),
      text: "Welcome to AEOBRO!",
      headers: { "X-Entity-Ref-ID": `welcome-${userId}-${Date.now()}` },
    });
    if (error) throw new Error(error.message ?? String(error));

    await prisma.user.update({
      where: { id: userId },
      data: { welcomeSentAt: new Date() },
      select: { id: true },
    });
  } catch (err: any) {
    log("error", "Welcome send/mark failed", { userId, err: err?.message ?? String(err) });
  }
}

const scopes =
  process.env.GOOGLE_AUTH_SCOPES ??
  "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    EmailProvider({
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url }) {
        await sendMagicLinkEmail(identifier, url);
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { scope: scopes, prompt: "consent" },
      },
      checks: ["pkce", "state"],
    }),
  ],

  pages: { signIn: "/login" },

  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        // @ts-expect-error augment at runtime
        session.user.id = token.sub;
      }
      return session;
    },
    async signIn({ user }) {
      // fire-and-forget; do not block login
      sendWelcomeIfFirstTime(user.id, user.email);
      return true;
    },
  },

  events: {
    async createUser({ user }) {
      sendWelcomeIfFirstTime(user.id, user.email);
    },
  },

  debug: process.env.NODE_ENV !== "production",
};
