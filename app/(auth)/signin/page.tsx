// app/(auth)/signin/page.tsx
"use client";

import * as React from "react";
import TurnstileWidget from "@/components/security/TurnstileWidget";

export default function SignInPage() {
  const [emailToken, setEmailToken] = React.useState<string | null>(null);
  const [credsToken, setCredsToken] = React.useState<string | null>(null);

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl shadow p-6 space-y-6 bg-white">
        <h1 className="text-xl font-semibold text-center">Sign In</h1>

        {/* Email (magic link via custom endpoint that verifies Turnstile) */}
        <form method="POST" action="/api/auth/magic-link" className="space-y-3">
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full border rounded-md p-2"
          />

          {/* Turnstile: set token for this form */}
          <TurnstileWidget onVerify={setEmailToken} />

          {/* Pass the token to the server */}
          <input type="hidden" name="turnstileToken" value={emailToken ?? ""} />

          <button
            type="submit"
            className="w-full rounded-md py-2 border bg-black text-white disabled:opacity-50"
            disabled={!emailToken}
            aria-disabled={!emailToken}
            title={!emailToken ? "Complete the CAPTCHA to continue" : "Send magic link"}
          >
            Send magic link
          </button>

          <p className="text-xs text-gray-500">
            We use Cloudflare Turnstile to prevent abuse. Completing the check may be required.
          </p>
        </form>

        <div className="text-center text-sm text-gray-500">or</div>

        {/* Credentials (custom gate that verifies Turnstile, then calls NextAuth credentials) */}
        <form method="POST" action="/api/auth/credentials-check" className="space-y-3">
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            name="email"
            required
            className="w-full border rounded-md p-2"
          />

          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            name="password"
            required
            className="w-full border rounded-md p-2"
          />

          {/* Turnstile: set token for this form */}
          <TurnstileWidget onVerify={setCredsToken} />

          {/* Pass the token to the server */}
          <input type="hidden" name="turnstileToken" value={credsToken ?? ""} />

          <button
            type="submit"
            className="w-full rounded-md py-2 border bg-black text-white disabled:opacity-50"
            disabled={!credsToken}
            aria-disabled={!credsToken}
            title={!credsToken ? "Complete the CAPTCHA to continue" : "Sign in with Credentials"}
          >
            Sign in with Credentials
          </button>

          <p className="text-xs text-gray-500">
            Protected by Turnstile to deter automated sign-ins.
          </p>
        </form>
      </div>
    </div>
  );
}
