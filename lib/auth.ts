// lib/auth.ts
// ✅ Updated: 2025-10-31 07:52 ET
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
const resend = new Resend(process.env.RESEND_API_KEY);
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
// NextAuth configuration
// ───────────────────────────────────────────────────────────
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // --- Email magic link via Resend ---
    EmailProvider({
      from: process.env.EMAIL_FROM,
      maxAge: 10 * 60, // 10 minutes
      async sendVerificationRequest({ identifier, url }) {
        const year = new Date().getFullYear();
        let ip = "Unknown IP";
        let ua = "Unknown device";
        try {
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

        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: identifier,
          subject: "Your AEOBRO sign-in link",
          html,
          text,
        });
        if (error) throw new Error(`Resend error: ${error.message || String(error)}`);
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
          token = (form?.get?.("cf-turnstile-response") as string | undefined) ?? undefined;
        } catch {
          token = (credentials as any)?.["cf-turnstile-response"] as string | undefined;
        }
        const { ok } = await verifyTurnstileToken(token);
        if (!ok) throw new Error("CAPTCHA verification failed");

        // Auth
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordHash = (user as any)?.passwordHash as string | undefined | null;
        if (!passwordHash) return null;

        const isValid = await compare(password, passwordHash);
        return isValid ? { id: user.id, email: user.email, name: user.name ?? null } : null;
      },
    }),

    // --- Google OAuth (YouTube verification) ---
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                scope: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
                prompt: "consent",
                access_type: "offline",
              },
            },
          }),
        ]
      : []),

    // --- Facebook OAuth (optional; also used for IG Business via Graph) ---
    ...(facebookEnabled
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID!,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
            authorization: {
              params: {
                scope: "public_profile pages_show_list pages_read_engagement", // add instagram_basic later if needed
              },
            },
          }),
        ]
      : []),

    // --- X (Twitter) OAuth 2.0 (optional) ---
    ...(twitterEnabled
      ? [
          TwitterProvider({
            clientId: process.env.TWITTER_CLIENT_ID!,
            clientSecret: process.env.TWITTER_CLIENT_SECRET!,
            version: "2.0",
          }),
        ]
      : []),

    // --- TikTok (custom provider stub; uncomment when ready) ---
    // ...(tiktokEnabled ? [TikTokProvider({ clientId: process.env.TIKTOK_CLIENT_ID!, clientSecret: process.env.TIKTOK_CLIENT_SECRET! })] : []),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) token.sub = user.id;

      // Persist provider-specific tokens on first OAuth sign-in
      if (account?.provider === "google") {
        if (account.access_token) (token as any).googleAccessToken = account.access_token;
        if (account.refresh_token) (token as any).googleRefreshToken = account.refresh_token;
        if (typeof account.expires_at === "number") (token as any).googleExpiresAt = account.expires_at;
      }
      if (account?.provider === "facebook") {
        if (account.access_token) (token as any).facebookAccessToken = account.access_token;
      }
      if (account?.provider === "twitter") {
        if (account.access_token) (token as any).twitterAccessToken = account.access_token;
      }

      return token;
    },

    async session({ session, token }) {
      if (token?.sub) (session.user as any).id = token.sub;

      // Expose minimal tokens if you need client-side fetches (you probably won't)
      if ((token as any).googleAccessToken) (session as any).googleAccessToken = (token as any).googleAccessToken;
      if ((token as any).googleRefreshToken) (session as any).googleRefreshToken = (token as any).googleRefreshToken;
      if ((token as any).googleExpiresAt) (session as any).googleExpiresAt = (token as any).googleExpiresAt;

      if ((token as any).facebookAccessToken) (session as any).facebookAccessToken = (token as any).facebookAccessToken;
      if ((token as any).twitterAccessToken) (session as any).twitterAccessToken = (token as any).twitterAccessToken;

      return session;
    },

    // Allow sign-in to proceed; finalization happens in events.linkAccount
    async signIn() {
      return true;
    },
  },

  events: {
    // Ensure emailVerified timestamp is set (for Email/Credentials flows)
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

    // 🔑 Core: after an OAuth account is linked, finalize platform verification
    async linkAccount({ user, account }) {
      try {
        if (!user?.id || !account?.provider) return;
        const accessToken = (account as any).access_token as string | undefined;
        const scope = (account as any).scope as string | undefined;
        await finalizePlatformVerification({
          userId: user.id,
          provider: account.provider,
          accessToken,
          scope,
        });
      } catch (err) {
        console.error("finalizePlatformVerification error:", err);
      }
    },
  },

  pages: { signIn: "/signin" },
};

// ───────────────────────────────────────────────────────────
// finalizePlatformVerification helper
// - Fetch canonical identity for each provider (via dispatcher)
// - Upsert PlatformAccount
// - Lift Profile.verificationStatus to PLATFORM_VERIFIED
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
  // 1) Load user + profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user?.profile) return; // no profile to verify against
  const profile = user.profile;

  // 2) Canonical identity via provider module
  const { externalId, handle, url, platformContext } =
    await fetchProviderIdentity(provider, accessToken);

  if (!externalId) return; // safety

  // 3) Upsert PlatformAccount (unique on [provider, externalId])
  const pa = await prisma.platformAccount.upsert({
    where: { provider_externalId: { provider, externalId } },
    update: {
      handle,
      url,
      status: "VERIFIED",
      verifiedAt: new Date(),
      method: "OAUTH",
      platformContext,
      scopes: scope ?? "",
      profileId: profile.id, // (re)attach to current profile
      updatedAt: new Date(),
    },
    create: {
      userId,
      profileId: profile.id,
      provider,
      externalId,
      handle,
      url,
      status: "VERIFIED",
      verifiedAt: new Date(),
      method: "OAUTH",
      platformContext,
      scopes: scope ?? "",
    },
  });

  // 4) Lift profile to PLATFORM_VERIFIED (idempotent) and record provider details
  const prevStatus = profile.verificationStatus;
  const verifiedMap = (profile.verifiedPlatforms as any) ?? {};
  verifiedMap[provider] = {
    externalId,
    url,
    handle,
    platformContext,
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

  // 5) ChangeLog (optional)
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
          provider,
          platformAccountId: pa.id,
        },
      },
    });
  } catch {
    /* noop */
  }
}

// ───────────────────────────────────────────────────────────
// (Optional) TikTok custom provider stub (uncomment when needed)
// import type { OAuthConfig } from "next-auth/providers";
// function TikTokProvider(params: { clientId: string; clientSecret: string }): OAuthConfig<any> {
//   return {
//     id: "tiktok",
//     name: "TikTok",
//     type: "oauth",
//     authorization: {
//       url: "https://www.tiktok.com/v2/auth/authorize/",
//       params: { scope: "user.info.basic", response_type: "code" },
//     },
//     token: "https://open.tiktokapis.com/v2/oauth/token/",
//     userinfo: "https://open.tiktokapis.com/v2/user/info/",
//     clientId: params.clientId,
//     clientSecret: params.clientSecret,
//     profile(profile: any) {
//       // shape depends on TikTok API response
//       return {
//         id: profile?.data?.user?.open_id,
//         name: profile?.data?.user?.display_name,
//         image: profile?.data?.user?.avatar_url,
//       };
//     },
//   };
// }
// ───────────────────────────────────────────────────────────
