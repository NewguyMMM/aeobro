"use client";
import TurnstileWidget from "@/components/security/TurnstileWidget";

export default function SignupPage() {
  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4">
      <input name="email" type="email" required className="w-full border rounded p-2" />
      <input name="password" type="password" required className="w-full border rounded p-2" />
      <TurnstileWidget />
      <button type="submit" className="w-full rounded bg-black text-white py-2">Create account</button>
    </form>
  );
}
