// app/login/page.tsx
"use client";

import * as React from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  // derive callbackUrl from ?callbackUrl=... on the client
  const [callbackUrl, setCallbackUrl] = React.useState("/dashboard");
  React.useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const cb = qs.get("callbackUrl");
      if (cb) setCallbackUrl(cb);
    } catch {
      // ignore
    }
  }, []);

  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = email.trim();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!isValidEmail) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      // Send magic link (no redirect here; NextAuth will handle after click)
      await signIn("email", { email: trimmed, callbackUrl, redirect: false });
      setMessage("Check your email for the sign-in link.");
    } catch (err: any) {
      setError(err?.message || "Could not start sign-in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container pt-28 pb-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-2 text-center text-2xl font-semibold">Sign in or create account</h1>

        {/* Clear explanation for first-time users */}
        <p className="mb-8 text-center text-sm text-gray-600">
          New here? Enter your email and we’ll send you a sign-in link. If this is your first time,
          clicking the link will also create your account.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          >
            {message}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-3" noValidate>
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : false}
          />

          <button
            type="submit"
            disabled={busy || !isValidEmail}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-sky-600 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send sign-in link"}
          </button>

          <p className="mt-2 text-center text-xs text-gray-500">
            Tip: Check your spam folder if you don’t see the email within a minute.
          </p>
        </form>
      </div>
    </div>
  );
}
