// app/components/Footer.tsx
import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t mt-12 py-6 text-sm text-gray-500">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <p className="mb-4 md:mb-0">&copy; 2025 AEOBRO</p>
        <nav className="flex space-x-6">
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
        </nav>
      </div>
    </footer>
  );
}
