// app/(auth)/signin/page.tsx
"use client";

import TurnstileWidget from "@/components/security/TurnstileWidget";

export default function SignInPage() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl shadow p-6 space-y-6 bg-white">
        <h1 className="text-xl font-semibold text-center">Sign In</h1>

        {/* Email (magic link) */}
        <form method="POST" action="/api/auth/signin/email" className="space-y-3">
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full border rounded-md p-2"
          />
          <TurnstileWidget />
          <button
            type="submit"
            className="w-full rounded-md py-2 border bg-black text-white"
          >
            Send magic link
          </button>
        </form>

        <div className="text-center text-sm text-gray-500">or</div>

        {/* Credentials */}
        <form method="POST" action="/api/auth/callback/credentials" className="space-y-3">
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

          <TurnstileWidget />
          <button
            type="submit"
            className="w-full rounded-md py-2 border bg-black text-white"
          >
            Sign in with Credentials
          </button>
        </form>
      </div>
    </div>
  );
}
