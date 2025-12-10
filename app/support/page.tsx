// app/support/page.tsx
// 📅 Added: 2025-12-10 06:12 ET
"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

const CATEGORIES = [
  { value: "TECHNICAL", label: "Technical issue" },
  { value: "BILLING", label: "Billing / subscription" },
  { value: "VERIFICATION", label: "Verification / domain / platform" },
  { value: "OTHER", label: "Other" },
];

export default function SupportPage() {
  const { data: session } = useSession();
  const { push } = useRouter();
  const toast = useToast(); // useToast returns a function: (message: string) => void

  const [email, setEmail] = React.useState(
    (session?.user?.email as string | undefined) || ""
  );
  const [subject, setSubject] = React.useState("");
  const [category, setCategory] = React.useState("TECHNICAL");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/support/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, category, message }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to submit support request");
      }

      // ✅ useToast expects a string, not an object
      toast(
        "Support request sent. We’ll follow up at your email as soon as possible."
      );

      // Optional: redirect back to dashboard after a short delay
      setTimeout(() => {
        if (session) {
          push("/dashboard");
        }
      }, 1500);

      setSubject("");
      setMessage("");
    } catch (err: any) {
      console.error(err);
      toast(
        `Something went wrong. ${
          err?.message || "We couldn’t send your request. Please try again."
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Contact AEOBRO
        </h1>
        <p className="text-slate-400 mb-8">
          Having trouble with your AI Identity Layer, billing, or verification?
          Send us a message and we’ll get back to you at the email below.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              type="email"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <p className="text-xs text-slate-400">
              We’ll use this address to reply to your request.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Category
            </label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Subject
            </label>
            <input
              type="text"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of your issue"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Message
            </label>
            <textarea
              required
              rows={6}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what’s going on, including any URLs, error messages, or steps to reproduce."
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {isSubmitting ? "Sending…" : "Send to AEOBRO"}
          </button>
        </form>
      </main>
    </div>
  );
}
