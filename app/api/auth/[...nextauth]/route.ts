import NextAuth, { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { resend, FROM, authEmailHtml, welcomeHtml } from "@/lib/email";

/**
 * Utility: robust logger that always prints in prod and dev
 */
const log = (level: "info" | "warn" | "error", msg: string, meta?: unknown) => {
  const entry = { level, msg, ...(meta ? { meta } : {}) };
  try {
    // Prefer Vercel/log drains if present
    console[level === "error" ? "error" : level](JSON.stringify(entry));
  } catch {
    // Fallback
    console.log(level.toUpperCase(), msg, meta ?? "");
  }
};

/**
 * Send magic-link (verification) through Resend with hardening
 */
async function sendMagicLinkEmail(identifier: string, url: string) {
  const { host } = new URL(url);
  try {
    const resp = await resend.emails.send({
      from: FROM.login, // e.g. "login@aeobro.com"
      to: identifier,
      subject: `Sign in to ${host}`,
      html: authEmailHtml(url, host),
      text: `Sign in to ${host}\n${url}\n`,
      headers: {
        "X-Entity-Ref-ID": `auth-${Date.now()}`,
      },
    });

    log("info", "Auth email sent via Resend", { to: identifier, id: resp?.id });
    return resp;
  } catch (err: any) {
    // Don’t throw — NextAuth will surface a generic error; we want specifics in logs.
    log("error", "Failed to send auth email via Resend", {
      to: identifier,
      err: err?.message ?? err,
    });
    // Best-effort retry once for transient 5xx
    const code = err?.statusCode || err?.code;
    if (code && String(code).startsWith("5")) {
      try {
        const retry = await resend.emails.send({
          from: FROM.login,
          to: identifier,
          subject: `Sign in to ${host}`,
          html: authEmailHtml(url, host),
          text: `Sign in to ${host}\n${url}\n`,
          headers: {
            "X-Entity-Ref-ID": `auth-retry-${Date.now()}`,
          },
        });
        log("warn", "Auth email retry succeeded", { to: identifier, id: retry?.id });
        return retry;
      } catch (retryErr: any) {
        log("error", "Auth email retry failed", {
          to: identifier,
          err: retryErr?.message ?? retryErr,
        });
      }
    }
    // allow flow to continue; NextAuth will still show “Check your email” page
    return null;
  }
}

/**
 * One-time Welcome Email guard
 * Requires a boolean/timestamp field on User: welcomeSentAt (nullable Date)
 */
async function sendWelcomeIfFirstTime(userId: string, email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true, welcomeSentAt: true },
    });

    if (!user) {
      log("warn", "Welcome skip: user not found", { userId, email });
      return;
    }
    // Only after verified email
    if (!user.emailVerified) {
      log("info", "Welcome deferred until emailVerified", { userId, email });
      return;
    }
    if (user.welcomeSentAt) {
      log("info", "Welcome already sent; skipping", { userId, email, at: user.welcomeSentAt });
      return;
    }

    // Attempt send (with minimal retry)
    const resp = await resend.emails.send({
      from: FROM.welcome ?? FROM.login, // allow separate mailbox; fallback to login@
      to: email,
      subject: "Welcome to AEObro 👋",
      html: welcomeHtml(),
      text: "Welcome to AEObro!",
      headers: {
        "X-Entity-Ref-ID": `welcome-${userId}-${Date.now()}`,
      },
    });
    log("info", "Welcome email sent", { userId, email, id: resp?.id });

    // Mark as sent
    await prisma.user.update({
      where: { id: userId },
      data: { welcomeSentAt: new Date() },
      select: { id: true },
    });
  } catch (err: any) {
    log("error", "Failed to send/mark welcome email", {
      userId,
      email,
      err: err?.message ?? err,
    });
    // Do not throw; never block sign-in on welcome failure
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" }, // ensures consistent user presence for events
  providers: [
    EmailProvider({
      maxAge: 24 * 60 * 60, // 24h magic-link validity
      async sendVerificationRequest({ identifier, url }) {
        await sendMagicLinkEmail(identifier, url);
      },
    }),
  ],
  callbacks: {
    /**
     * Triggered on every signIn. We use it to best-effort send welcome once a user is verified.
     * This runs after a magic-link login, so emailVerified should be set by NextAuth + Adapter.
     */
    async signIn({ user }) {
      // fire-and-forget; don’t await to keep sign-in snappy
      sendWelcomeIfFirstTime(user.id, user.email ?? "");
      return true;
    },
  },
  events: {
    /**
     * Optional: if you’d rather send welcome on first account creation,
     * keep this too. The signIn callback above is more reliable when
     * email verification timing is racy.
     */
    async createUser({ user }) {
      // Try to send welcome, but signIn will also guard and mark once.
      sendWelcomeIfFirstTime(user.id, user.email ?? "");
    },
  },
  pages: {
    // Optional: your custom pages, if any
  },
  // Make errors visible in logs
  debug: process.env.NODE_ENV !== "production",
};

const authHandler = NextAuth(authOptions);
export { authHandler as GET, authHandler as POST };
