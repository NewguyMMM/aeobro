// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter"; // correct adapter
import { prisma } from "@/lib/prisma";
import { resend, FROM, authEmailHtml, welcomeHtml } from "@/lib/email";

/** small structured logger */
const log = (level: "info" | "warn" | "error", msg: string, meta?: unknown) => {
  const payload = { level, msg, ...(meta ? { meta } : {}) };
  try {
    console[level === "error" ? "error" : level](JSON.stringify(payload));
  } catch {
    console.log(level.toUpperCase(), msg, meta ?? "");
  }
};

/** send magic-link with resilience */
async function sendMagicLinkEmail(identifier: string, url: string) {
  const { host } = new URL(url);
  try {
    const resp = await resend.emails.send({
      from: FROM.login, // e.g. "AEObro <login@aeobro.com>"
      to: identifier,
      subject: `Sign in to ${host}`,
      html: authEmailHtml(url, host),
      text: `Sign in to ${host}\n${url}\n`,
      headers: { "X-Entity-Ref-ID": `auth-${Date.now()}` },
    });
    log("info", "Auth email sent", { to: identifier, id: resp?.id });
  } catch (err: any) {
    log("error", "Auth email failed", { to: identifier, err: err?.message ?? String(err) });
    // optional single retry on 5xx
    const code = err?.statusCode || err?.code;
    if (code && String(code).startsWith("5")) {
      try {
        const retry = await resend.emails.send({
          from: FROM.login,
          to: identifier,
          subject: `Sign in to ${host}`,
          html: authEmailHtml(url, host),
          text: `Sign in to ${host}\n${url}\n`,
          headers: { "X-Entity-Ref-ID": `auth-retry-${Date.now()}` },
        });
        log("warn", "Auth email retry success", { to: identifier, id: retry?.id });
      } catch (retryErr: any) {
        log("error", "Auth email retry failed", { to: identifier, err: retryErr?.message ?? String(retryErr) });
      }
    }
  }
}

/** send welcome once after emailVerified using DB flag */
async function sendWelcomeIfFirstTime(userId: string, email?: string | null) {
  if (!email) return; // never send to empty
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerified: true, welcomeSentAt: true },
    });
    if (!user) return;
    if (!user.emailVerified) {
      log("info", "Welcome deferred until emailVerified", { userId });
      return;
    }
    if (user.welcomeSentAt) {
      log("info", "Welcome already sent; skipping", { userId, at: user.welcomeSentAt });
      return;
    }

    const resp = await resend.emails.send({
      from: FROM.welcome ?? FROM.login,
      to: email,
      subject: "Welcome to AEObro 👋",
      html: welcomeHtml(),
      text: "Welcome to AEObro!",
      headers: { "X-Entity-Ref-ID": `welcome-${userId}-${Date.now()}` },
    });
    log("info", "Welcome email sent", { userId, id: resp?.id });

    await prisma.user.update({
      where: { id: userId },
      data: { welcomeSentAt: new Date() },
      select: { id: true },
    });
  } catch (err: any) {
    log("error", "Welcome send/mark failed", { userId, err: err?.message ?? String(err) });
  }
}

// NOTE: not exported — keep this local to avoid Next.js Route export error
const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    EmailProvider({
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url }) {
        await sendMagicLinkEmail(identifier, url);
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // fire-and-forget; do not block login
      sendWelcomeIfFirstTime(user.id, user.email);
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      // extra safety in case of timing races
      sendWelcomeIfFirstTime(user.id, user.email);
    },
  },
  debug: process.env.NODE_ENV !== "production",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
