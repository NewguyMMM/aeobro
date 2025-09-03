"use client";

import * as React from "react";
import { signIn } from "next-auth/react";

export default function EmailLoginForm() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      // This triggers NextAuth Email provider → Resend → your template
      await signIn("email", { email, redirect: false });
      setMessage("Check your email for the sign-in link.");
    } catch (err) {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "72px auto", fontFamily: "Inter, system-ui, Arial" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Sign in with Email</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          disabled={busy || !email}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: 0,
            background: "#111",
            color: "#fff",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Sending..." : "Send sign-in link"}
        </button>
      </form>
      {message && <p style={{ marginTop: 12, color: "#444" }}>{message}</p>}
    </div>
  );
}
