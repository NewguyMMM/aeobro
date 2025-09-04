// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { resend, FROM, authEmailHtml, welcomeHtml } from "@/lib/email";

/** ensure the magic-link host/protocol match NEXTAUTH_URL */
function forceAppOrigin(inputUrl: string): string {
  const appBase = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    const fixed = new URL(inputUrl);
    const base = new URL(appBase);
    fixed.protocol = base.protocol;
    fixed.host = base.host; // <- forces your domain (e.g., aeobro.vercel.app)
    return fixed.toString();
  } catch {
    // Fallback to original if parsing somehow fails
    return inputUrl;
  }
}

/** small structured logger */
const log = (level: "info" | "warn" | "error", msg: string, meta?: unknown) => {
  const payload = { level, msg, ...(meta ? { meta } : {}) };
  try {
    console[level === "error" ? "error" : level](JSON.stringify(payload));
  } catch {
    console.log(level.toUpperCase(), msg, meta ?? "");
  }
};

/** send magic-link with resilience (Resend SDK v3: { data, error }) */
async function sendMagicLinkEmail(identifier: string, url: string) {
  // Force the app origin so links never point to Supabase or any other host
  const fixedUrl = forceAppOrigin(url);
  const { host } = new URL(fixedUrl);

  // 🔎 Log the exact link we are emailing (view in Vercel → Logs)
  log("info", "Auth link", { fixedUrl });

  try {
    const { data, error } = await resend.emails.send({
      // ✅ Safe "from" fallback to avoid missing EMAIL_FROM
      from: process.env.EMAIL_FROM || "AEObro <noreply@aeobro.com>",
      to: identifier,
      subject: `Sign in to ${host}`,
      html: authEmailHtml(fixedUrl, host),
      text: `Sign in to ${host}\n${fixedUrl}\n`,
      headers: { "X-Entity-Ref-ID": `auth-${Date.now()}` },
    });

    if (error) throw new Error(error.message ?? String(error));
    log("info", "Auth email sent", { to: identifier, id: data?.id });
  } catch (err: any) {
    log("error", "Auth email failed", { to: identifier, err: err?.message ?? String(err) });

    // optional: retry once on 5xx-like cases (Resend doesn't always expose status; keep lightweight)
    try {
      const { data: retryData, error: retryError } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "AEObro <noreply@aeobro.com>",
        to: identifier,
        subject: `Sign in to ${host}`,
        html: authEmailHtml(fixedUrl, host),
        text: `Sign in to ${host}\n${fixedUrl}\n`,
        headers: { "X-Entity-Ref-ID": `auth-retry-${Date.now()}` },
      });
      if (retryError) throw new Error(retryError.message ?? String(retryError));
      log("warn", "Auth email retry success", { to: identifier, id: retryData?.id });
    } catch (retryErr: any) {
      log("error", "Auth email retry failed", { to: identifier, err: retryErr?.message ?? String(retryErr) });
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

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || FROM.welcome || "AEObro <noreply@aeobro.com>",
      to: email,
      subject: "Welcome to AEObro 👋",
      html: welcomeHtml(),
      text: "Welcome to AEObro!",
      headers: { "X-Entity-Ref-ID": `welcome-${userId}-${Date.now()}` },
    });
    if (error) throw new Error(error.message ?? String(error));
    log("info", "Welcome email sent", { userId, id: data?.id });

    await prisma.user.update({
      where: { id: userId },
      data: { welcomeSentAt: new Date() },
      select: { id: true },
    });
  } catch (err: any) {
    log("error", "Welcome send/mark failed", { userId, err: err?.message ?? String(err) });
  }
}

// Keep local; do not export (Next.js Route files allow only specific exports)
const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    EmailProvider({
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url }) {
        // Use the same helper here for clarity (sendMagicLinkEmail also forces it)
        const fixed = forceAppOrigin(url);
        await sendMagicLinkEmail(identifier, fixed);
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
