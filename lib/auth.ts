// lib/auth.ts
// ✅ Updated: 2026-02-26 (hotfix)
// Goals:
// - Make magic-link failures visible + deterministic
// - Prevent module-load Resend initialization (can fail silently)
// - Add NextAuth debug/logger (gated by NEXTAUTH_DEBUG=true)
// - Keep existing providers/callbacks/events/plan sync/verification finalization

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
const BRAND_BLUE = "#2563EB"; // Tailwind blue-600

// ───────────────────────────────────────────────────────────
// Provider feature flags (env-driven)
// ───────────────────────────────────────────────────────────
const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const facebookEnabled =
  !!process.env.FACEBOOK_CLIENT_ID && !!process.env.FACEBOOK_CLIENT_SECRET;

const twitterEnabled =
  !!process.env.TWITTER_CLIENT_ID && !!process.env.TWITTER_CLIENT_SECRET;

// TikTok requires a custom provider; left as a stub below
const tiktokEnabled =
  !!process.env.TIKTOK_CLIENT_ID && !!process.env.TIKTOK_CLIENT_SECRET; // not used yet

// ───────────────────────────────────────────────────────────
// OAuth allowlist (must mirror what UI enables)
// ───────────────────────────────────────────────────────────
const ALLOWED_OAUTH_PROVIDERS = new Set<string>([
  ...(googleEnabled ? ["google"] : []),
  ...(facebookEnabled ? ["facebook"] : []),
  ...(twitterEnabled ? ["twitter"] : []),
]);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  // ✅ Turn on deep NextAuth logs only when you explicitly enable it
  debug: process.env.NEXTAUTH_DEBUG === "true",
  logger: {
    error(code, metadata) {
      console.error("[nextauth][error]", code, metadata);
    },
    warn(code) {
      console.warn("[nextauth][warn]", code);
    },
    debug(code, metadata) {
      if (process.env.NEXTAUTH_DEBUG === "true") {
        console.log("[nextauth][debug]", code, metadata);
      }
    },
  },

  /**
   * ✅ Ensure session cookie works on both:
   * - aeobro.com
   * - www.aeobro.com
   */
  cookies: {
    sessionToken: {
      name: "__Secure-next-auth.session-token",
      options: {
        domain: ".aeobro.com",
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
    },
  },

  providers: [
    // --- Email magic link via Resend ---
    EmailProvider({
      from: process.env.EMAIL_FROM,
      maxAge: 10 * 60, // 10 minutes
      async sendVerificationRequest({ identifier, url }) {
        // ✅ Validate env at call-time (NOT module-load)
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.EMAIL_FROM;

        if (!apiKey) {
          console.error("❌ [auth] Missing RESEND_API_KEY");
          throw new Error("Missing RESEND_API_KEY");
        }
        if (!from) {
          console.error("❌ [auth] Missing EMAIL_FROM");
          throw new Error("Missing EMAIL_FROM");
        }

        const resend = new Resend(apiKey);

        const year = new Date().getFullYear();
        let ip = "Unknown IP";
        let ua = "Unknown device";
        try {
          // next/headers is safe here; this runs inside a request
          const { headers } = await import("next/headers");
          ip = headers().get("x-forwarded-for") || ip;
          ua = headers().get("user-agent") || ua;
        } catch {
          /* noop */
        }

        const html = `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;padding:24px 0;text-align:center">
  <tr><td>
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 24px;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222;text-align:left;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
      <div style="text-align:center;margin-bottom:16px;line-height:1">
        <span style="font-size:22px;font-weight:700;color:#111;letter-spacing:0.2px;">AEO</span><span style="font-size:22px;font-weight:700;letter-spacing:0.2px;color:${BRAND_BLUE};">BRO</span>
      </div>
      <p style="font-size:16px;margin:0 0 24px">Click below to securely sign in:</p>
      <p style="text-align:center;margin:0 0 32px">
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:${BRAND_BLUE};color:#ffffff !important;font-weight:600;border-radius:10px;text-decoration:none;border:1px solid ${BRAND_BLUE}">
          Sign in to AEOBRO
        </a>
      </p>
      <p style="font-size:13px;color:#777;line-height:1.5;margin:0">
        This link expires in <strong>10 minutes</strong> and can only be used once.<br/>
        If you didn’t request this, you can safely ignore this email.
      </p>
      <p style="font-size:11px;color:#9aa3b2;line-height:1.4;margin-top:10px">Request from: ${ip} — ${ua}</p>
    </div>
    <p style="font-size:12px;color:#aaa;margin:16px 0 0">© ${year} AEOBRO</p>
  </td></tr>
</table>`.trim();

        const text = `Sign in to AEOBRO

Use the link below to sign in (expires in 10 minutes, single-use):
${url}

If you did not request this, you can safely ignore this email.`;

        try {
          const result = await resend.emails.send({
            from,
            to: identifier,
            subject: "Your AEOBRO sign-in link",
            html,
            text,
          });

          // Resend SDK usually returns { data, error }
          const anyResult = result as any;
          if (anyResult?.error) {
            console.error("❌ [auth] Resend send error:", anyResult.error);
            throw new Error(
              `Resend error: ${anyResult.error.message || String(anyResult.error)}`
            );
          }

          if (process.env.NEXTAUTH_DEBUG === "true") {
            console.log("📨 [auth] Resend send ok:", anyResult?.data ?? result);
          }
        } catch (err) {
          console.error("❌ [auth] sendVerificationRequest failed:", err);
          throw err;
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

    // TikTok stub remains unused
    // ...(tiktokEnabled ? [TikTokProvider(...)] : []),
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
      } catch {
        console.error("finalizePlatformVerification error");
      }
    },
  },

  // ✅ canonical sign-in route
  pages: { signIn: "/login" },
};

// ───────────────────────────────────────────────────────────
// finalizePlatformVerification helper
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
    where: { provider_externalId: { provider: normalizedProvider, externalId } },
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
