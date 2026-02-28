// lib/auth.ts
// ✅ Updated: 2026-02-28 (production-stable + email logo + subtle security badge)
// - Canonical sign-in page: /login
// - Keep providers/callbacks/events/plan sync/verification finalization
// - Email magic link now uses hosted PNG logo + email-safe HTML tables + subtle security badge

import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import TwitterProvider from "next-auth/providers/twitter";

import { Resend } from "resend";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";
import { compare } from "bcryptjs";

// 🆕 Provider identity dispatcher (see: lib/verify/providers/*)
import { fetchProviderIdentity } from "@/lib/verify/providers";

// ───────────────────────────────────────────────────────────
// Branding / transactional email
// ───────────────────────────────────────────────────────────
const BRAND_BLUE = "#2196F3"; // AEOBRO canonical blue
const EMAIL_LOGO_URL = "https://www.aeobro.com/brand/aeobro-email-logo.png";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Log once per invocation (shows up in Vercel function logs)
    console.error(`[auth] Missing required env: ${name}`);
  }
  return v ?? "";
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// ───────────────────────────────────────────────────────────
// Provider feature flags (env-driven)
// ───────────────────────────────────────────────────────────
const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const facebookEnabled =
  !!process.env.FACEBOOK_CLIENT_ID && !!process.env.FACEBOOK_CLIENT_SECRET;

const twitterEnabled =
  !!process.env.TWITTER_CLIENT_ID && !!process.env.TWITTER_CLIENT_SECRET;

// OAuth allowlist (must mirror what UI enables)
const ALLOWED_OAUTH_PROVIDERS = new Set<string>([
  ...(googleEnabled ? ["google"] : []),
  ...(facebookEnabled ? ["facebook"] : []),
  ...(twitterEnabled ? ["twitter"] : []),
]);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // ✅ Keep JWT (matches your existing gating strategy)
  session: { strategy: "jwt" },

  // ✅ Strong diagnostics in Vercel logs (controlled by NEXTAUTH_DEBUG)
  debug: process.env.NEXTAUTH_DEBUG === "true",
  logger: {
    error(code, ...message) {
      console.error("[nextauth][error]", code, ...message);
    },
    warn(code, ...message) {
      console.warn("[nextauth][warn]", code, ...message);
    },
    debug(code, ...message) {
      if (process.env.NEXTAUTH_DEBUG === "true") {
        console.log("[nextauth][debug]", code, ...message);
      }
    },
  },

  providers: [
    // --- Email magic link via Resend ---
    EmailProvider({
      from: process.env.EMAIL_FROM, // NextAuth uses this label; we validate inside sender
      maxAge: 10 * 60, // 10 minutes
      async sendVerificationRequest({ identifier, url }) {
        const resend = getResend();
        const from = requireEnv("EMAIL_FROM");

        if (!resend) {
          throw new Error("RESEND_API_KEY is missing");
        }
        if (!from) {
          throw new Error("EMAIL_FROM is missing");
        }

        const year = new Date().getFullYear();

        // Email-safe, table-based layout (Gmail/Outlook safe). Uses hosted PNG logo.
        const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f6f8;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f6f8;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;padding:36px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
            <tr>
              <td align="center" style="padding-bottom:22px;">
                <img
                  src="${EMAIL_LOGO_URL}"
                  width="220"
                  height="auto"
                  alt="AEOBRO"
                  style="display:block;border:0;outline:none;text-decoration:none;"
                />
              </td>
            </tr>

            <tr>
              <td align="center" style="font-size:18px;font-weight:700;padding-bottom:10px;">
                Sign in to AEOBRO
              </td>
            </tr>

            <tr>
              <td align="center" style="font-size:14px;color:#444;line-height:1.6;padding-bottom:22px;">
                Click the button below to securely access your account.
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-bottom:18px;">
                <a
                  href="${url}"
                  style="background:${BRAND_BLUE};color:#ffffff !important;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;border:1px solid ${BRAND_BLUE};"
                >
                  Sign In Securely
                </a>
              </td>
            </tr>

            <!-- Subtle security badge -->
            <tr>
              <td align="center" style="font-size:12px;color:#6b7280;line-height:1.5;padding-top:6px;">
                🔒 Secure link • Single-use • Expires in 10 minutes
              </td>
            </tr>

            <tr>
              <td style="padding-top:22px;border-bottom:1px solid #eee;"></td>
            </tr>

            <tr>
              <td align="center" style="font-size:12px;color:#9aa0a6;line-height:1.6;padding-top:16px;">
                If you didn’t request this email, you can safely ignore it.<br/>
                © ${year} AEOBRO
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

        const text = `Sign in to AEOBRO

Use the link below to sign in (expires in 10 minutes, single-use):
${url}

Security: single-use link • expires in 10 minutes

If you did not request this, you can safely ignore this email.`;

        const { error } = await resend.emails.send({
          from,
          to: identifier,
          subject: "Your AEOBRO sign-in link",
          html,
          text,
        });

        if (error) {
          console.error("[auth] Resend send failed:", error);
          throw new Error(`Resend error: ${error.message || String(error)}`);
        }
      },
    }),

    // --- Credentials (with Cloudflare Turnstile) ---
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // Verify Turnstile
        let token: string | undefined;
        try {
          // @ts-expect-error App Router runtime provides formData()
          const form = await req?.formData?.();
          token =
            (form?.get?.("cf-turnstile-response") as string | undefined) ??
            undefined;
        } catch {
          token = (credentials as any)?.["cf-turnstile-response"] as
            | string
            | undefined;
        }

        const { ok } = await verifyTurnstileToken(token);
        if (!ok) throw new Error("CAPTCHA verification failed");

        // Auth
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordHash = (user as any)?.passwordHash as
          | string
          | undefined
          | null;
        if (!passwordHash) return null;

        const isValid = await compare(password, passwordHash);
        return isValid
          ? { id: user.id, email: user.email, name: user.name ?? null }
          : null;
      },
    }),

    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                scope:
                  "openid email profile https://www.googleapis.com/auth/youtube.readonly",
                prompt: "consent",
                access_type: "offline",
              },
            },
          }),
        ]
      : []),

    ...(facebookEnabled
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID!,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
            authorization: {
              params: {
                scope: "public_profile pages_show_list pages_read_engagement",
              },
            },
          }),
        ]
      : []),

    ...(twitterEnabled
      ? [
          TwitterProvider({
            clientId: process.env.TWITTER_CLIENT_ID!,
            clientSecret: process.env.TWITTER_CLIENT_SECRET!,
            version: "2.0",
          }),
        ]
      : []),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) token.sub = (user as any).id ?? user.id;

      if (account?.provider === "google") {
        if (account.access_token)
          (token as any).googleAccessToken = account.access_token;
        if (account.refresh_token)
          (token as any).googleRefreshToken = account.refresh_token;
        if (typeof account.expires_at === "number")
          (token as any).googleExpiresAt = account.expires_at;
      }
      if (account?.provider === "facebook") {
        if (account.access_token)
          (token as any).facebookAccessToken = account.access_token;
      }
      if (account?.provider === "twitter") {
        if (account.access_token)
          (token as any).twitterAccessToken = account.access_token;
      }

      const userId = (user as any)?.id ?? (token.sub as string | undefined);
      if (userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true, planStatus: true, currentPeriodEnd: true },
          });

          if (dbUser) {
            (token as any).plan = dbUser.plan ?? "LITE";
            (token as any).planStatus = dbUser.planStatus ?? "inactive";
            (token as any).currentPeriodEnd =
              dbUser.currentPeriodEnd?.toISOString() ?? null;
          } else {
            (token as any).plan = (token as any).plan ?? "LITE";
            (token as any).planStatus = (token as any).planStatus ?? "inactive";
          }
        } catch (err) {
          console.error("JWT plan sync error:", err);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token?.sub) (session.user as any).id = token.sub;

      (session.user as any).plan = (token as any).plan ?? "LITE";
      (session.user as any).planStatus = (token as any).planStatus ?? "inactive";
      (session.user as any).currentPeriodEnd = (token as any).currentPeriodEnd
        ? new Date((token as any).currentPeriodEnd)
        : null;

      if ((token as any).googleAccessToken)
        (session as any).googleAccessToken = (token as any).googleAccessToken;
      if ((token as any).googleRefreshToken)
        (session as any).googleRefreshToken = (token as any).googleRefreshToken;
      if ((token as any).googleExpiresAt)
        (session as any).googleExpiresAt = (token as any).googleExpiresAt;

      if ((token as any).facebookAccessToken)
        (session as any).facebookAccessToken = (token as any).facebookAccessToken;
      if ((token as any).twitterAccessToken)
        (session as any).twitterAccessToken = (token as any).twitterAccessToken;

      return session;
    },

    async signIn() {
      return true;
    },
  },

  events: {
    async signIn({ user }) {
      try {
        if (!user?.id) return;
        const existing = await prisma.user.findUnique({
          where: { id: user.id },
          select: { emailVerified: true },
        });
        if (!existing?.emailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          });
        }
      } catch {
        /* noop */
      }
    },

    async linkAccount({ user, account }) {
      try {
        if (!user?.id || !account?.provider) return;

        const provider = String(account.provider).toLowerCase();
        if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
          console.error("[oauth] blocked unsupported provider");
          return;
        }

        const accessToken = (account as any).access_token as string | undefined;
        const scope = (account as any).scope as string | undefined;

        await finalizePlatformVerification({
          userId: user.id,
          provider,
          accessToken,
          scope,
        });
      } catch (err) {
        console.error("finalizePlatformVerification error", err);
      }
    },
  },

  pages: { signIn: "/login" },
};

// ───────────────────────────────────────────────────────────
// finalizePlatformVerification helper (unchanged behavior)
// ───────────────────────────────────────────────────────────
type FinalizeParams = {
  userId: string;
  provider: string;
  accessToken?: string;
  scope?: string;
};

export async function finalizePlatformVerification({
  userId,
  provider,
  accessToken,
  scope,
}: FinalizeParams) {
  const normalizedProvider = String(provider ?? "").trim().toLowerCase();

  if (
    !normalizedProvider ||
    normalizedProvider === "domain" ||
    normalizedProvider === "dns" ||
    normalizedProvider === "txt"
  ) {
    return;
  }

  if (!ALLOWED_OAUTH_PROVIDERS.has(normalizedProvider)) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user?.profile) return;
  const profile = user.profile;

  const { externalId, handle, url } = await fetchProviderIdentity(
    normalizedProvider,
    accessToken
  );

  if (!externalId) return;

  const pa = await prisma.platformAccount.upsert({
    where: {
      provider_externalId: { provider: normalizedProvider, externalId },
    },
    update: {
      handle,
      url,
      status: "VERIFIED",
      verifiedAt: new Date(),
      method: "OAUTH",
      platformContext: "OAUTH" as any,
      scopes: scope ?? "",
      profileId: profile.id,
      updatedAt: new Date(),
    },
    create: {
      userId,
      profileId: profile.id,
      provider: normalizedProvider,
      externalId,
      handle,
      url,
      status: "VERIFIED",
      verifiedAt: new Date(),
      method: "OAUTH",
      platformContext: "OAUTH" as any,
      scopes: scope ?? "",
    },
  });

  const prevStatus = profile.verificationStatus;
  const verifiedMap = (profile.verifiedPlatforms as any) ?? {};
  verifiedMap[normalizedProvider] = {
    externalId,
    url,
    handle,
    platformContext: "OAUTH",
    verifiedAt: new Date().toISOString(),
  };

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      verificationStatus: "PLATFORM_VERIFIED",
      platformVerifiedAt: new Date(),
      verifiedPlatforms: verifiedMap,
    },
  });

  try {
    await prisma.changeLog.create({
      data: {
        userId,
        profileId: profile.id,
        entity: "PROFILE",
        action: "UPDATE",
        field: "verificationStatus",
        before: { verificationStatus: prevStatus },
        after: {
          verificationStatus: "PLATFORM_VERIFIED",
          provider: normalizedProvider,
          platformAccountId: pa.id,
        },
      },
    });
  } catch {
    /* noop */
  }
}
