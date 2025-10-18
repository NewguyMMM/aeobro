// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import { authOptions as baseAuthOptions } from "@/lib/auth";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";

/**
 * Safely extract cf-turnstile-response from the NextAuth App Router request.
 * Supports both form and JSON bodies and tolerates missing clone/formData/json.
 */
async function getTurnstileTokenFromReq(req: unknown): Promise<string | undefined> {
  const maybeReq = req as any;
  const cloned = typeof maybeReq?.clone === "function" ? maybeReq.clone() : maybeReq;
  const contentType: string = cloned?.headers?.get?.("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await cloned?.json?.().catch(() => ({}))) ?? {};
      return body["cf-turnstile-response"];
    } else {
      const form = await cloned?.formData?.().catch(() => undefined);
      return (form?.get?.("cf-turnstile-response") as string | undefined) ?? undefined;
    }
  } catch {
    return undefined;
  }
}

/**
 * Compose final NextAuth options:
 * - Start with "@/lib/auth" options
 * - Add Turnstile enforcement in callbacks.signIn for "email" and "credentials"
 * - Defer to any existing signIn callback afterwards
 */
const authOptions: NextAuthOptions = {
  ...baseAuthOptions,
  callbacks: {
    ...(baseAuthOptions?.callbacks ?? {}),
    async signIn(params) {
      const { account, req } = params;

      // Enforce CAPTCHA on risky entry points
      if (account?.provider === "email" || account?.provider === "credentials") {
        try {
          const token = await getTurnstileTokenFromReq(req);
          const { ok } = await verifyTurnstileToken(token);
          if (!ok) return false; // block sign-in if CAPTCHA fails
        } catch (err) {
          console.error("Turnstile check failed:", err);
          return false; // fail closed on any error
        }
      }

      // Preserve any existing signIn callback behavior
      if (typeof baseAuthOptions?.callbacks?.signIn === "function") {
        return baseAuthOptions.callbacks.signIn(params as any);
      }

      // Default allow
      return true;
    },
  },
};

// Do not export anything else from this file.
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
