// app/login/page.tsx
"use client";

import * as React from "react";
import { signIn } from "next-auth/react";

function getSafeCallbackUrl(): string {
  // Default destination after login
  const defaultPath = "/dashboard";

  if (typeof window === "undefined") return defaultPath;

  const origin = window.location.origin;

  try {
    const qs = new URLSearchParams(window.location.search);
    const cb = qs.get("callbackUrl");

    // If none provided, use default (absolute)
    if (!cb) return `${origin}${defaultPath}`;

    // Resolve relative OR absolute against current origin
    const resolved = new URL(cb, origin);

    // Fail-closed: prevent open redirects to other origins
    if (resolved.origin !== origin) return `${origin}${defaultPath}`;

    // Keep full path/query/hash on same origin
    return `${origin}${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return `${origin}${defaultPath}`;
  }
}

export default function LoginPage() {
  const [callbackUrl, setCallbackUrl] = React.useState<string>(() => {
    // initialize once
    return typeof window !== "undefined" ? `${window.location.origin}/dashboard` : "/dashboard";
  });

  React.useEffect(() => {
    setCallbackUrl(getSafeCallbackUrl());
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
      // Key change: callbackUrl is always ABSOLUTE and same-origin safe
      const res = await signIn("email", {
        email: trimmed,
        callbackUrl,
        redirect: false,
      });

      // NextAuth sometimes returns { error } rather than throwing
      if (res?.error) {
        setError(res.error);
      } else {
        setMessage("Check your email for the sign-in link.");
      }
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
