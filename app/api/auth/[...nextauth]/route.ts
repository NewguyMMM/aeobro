// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import { authOptions as baseAuthOptions } from "@/lib/auth";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";

/**
 * Merge helper for callbacks: runs our Turnstile check, then (if present)
 * defers to the project's original signIn callback.
 */
function withTurnstileSignIn(
  original?: NextAuthOptions["callbacks"] & { signIn?: NextAuthOptions["callbacks"]["signIn"] }
): NextAuthOptions["callbacks"]["signIn"] {
  return async (params) => {
    const { account, req } = params;

    // We enforce Turnstile for the two risky entry points:
    // - Email (magic-link) initiation: provider === "email"
    // - Credentials login: provider === "credentials"
    if (account?.provider === "email" || account?.provider === "credentials") {
      try {
        // Extract token from the incoming request body (form or JSON)
        const cloned = req.clone();
        const ct = cloned.headers.get("content-type") || "";
        let token: string | undefined;

        if (ct.includes("application/json")) {
          const body = await cloned.json().catch(() => ({} as any));
          token = body["cf-turnstile-response"];
        } else {
          const form = await cloned.formData().catch(() => undefined);
          token = form?.get("cf-turnstile-response") as string | undefined;
        }

        const { ok } = await verifyTurnstileToken(token);
        if (!ok) {
          // Block sign-in if CAPTCHA failed
          return false;
        }
      } catch (err) {
        // Any parsing/network error → fail closed
        console.error("Turnstile signIn check failed:", err);
        return false;
      }
    }

    // If you had an existing signIn callback, preserve it:
    if (original?.signIn) {
      return original.signIn(params);
    }

    // Default allow
    return true;
  };
}

/**
 * Compose the final NextAuth options:
 * - Start with your existing authOptions from "@/lib/auth"
 * - Overlay our signIn callback that performs the Turnstile check
 */
const authOptions: NextAuthOptions = {
  ...baseAuthOptions,
  callbacks: {
    ...(baseAuthOptions?.callbacks || {}),
    signIn: withTurnstileSignIn(baseAuthOptions?.callbacks as any),
  },
};

// Do not export anything else from this file.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
