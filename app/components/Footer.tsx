// app/components/Footer.tsx
import React from "react";
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t mt-12 py-6 text-sm text-gray-500">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <p className="mb-1">&copy; {year} AEOBRO</p>
          <p className="text-xs text-gray-500">
            AEOBRO is not affiliated with OpenAI, Google, or Perplexity. Names
            are used for identification only.
          </p>
        </div>

        <nav className="flex flex-wrap gap-6">
          <Link href="/privacy" className="hover:text-gray-800">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-gray-800">
            Terms
          </Link>
          <Link href="/aup" className="hover:text-gray-800">
            AUP
          </Link>
          <Link href="/disputes" className="hover:text-gray-800">
            Disputes
          </Link>
          {/* 🔁 updated: /cancel → /billing & label */}
          <Link href="/billing" className="hover:text-gray-800">
            Manage subscription
          </Link>
          {/* 🆕 Contact link */}
          <Link href="/support" className="hover:text-gray-800">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
