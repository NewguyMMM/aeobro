"use client";
import TurnstileWidget from "@/components/security/TurnstileWidget";

export default function EmailSignIn() {
  return (
    <form method="POST" action="/api/auth/signin/email" className="space-y-4">
      <input type="email" name="email" required placeholder="you@example.com" className="w-full border rounded p-2" />
      <TurnstileWidget />
      <button type="submit" className="w-full rounded bg-black text-white py-2">Send magic link</button>
    </form>
  );
}
