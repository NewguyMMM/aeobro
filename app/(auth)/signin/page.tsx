"use client";

import TurnstileWidget from "@/components/security/TurnstileWidget";

export default function SignInPage() {
  return (
    <form method="POST" action="/api/auth/callback/credentials" className="space-y-4">
      <input type="email" name="email" required placeholder="you@example.com" className="w-full border rounded p-2" />
      <input type="password" name="password" required placeholder="••••••••" className="w-full border rounded p-2" />
      <TurnstileWidget className="mt-2" />
      <button type="submit" className="w-full rounded bg-black text-white py-2">Sign in</button>
    </form>
  );
}
