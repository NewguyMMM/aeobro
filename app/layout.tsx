"use client";

import "./globals.css";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <html lang="en">
      <body>
        <header className="border-b">
          <div className="container flex items-center justify-between py-4">
            <a href="/" className="font-bold text-xl">AEOBRO</a>
            <nav className="flex gap-4">
              <a href="/pricing">Pricing</a>
              <a href="/faq">FAQ</a>
              <a className="btn" href="/audit">Audit</a>

              {/* Auth buttons */}
              {!session ? (
                <button
                  onClick={() => signIn()}
                  className="btn btn-primary"
                >
                  Sign in
                </button>
              ) : (
                pathname !== "/login" && (
                  <button
                    onClick={() => signOut()}
                    className="btn btn-primary"
                  >
                    Sign out
                  </button>
                )
              )}
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="border-t mt-16">
          <div className="container py-8 text-sm text-gray-600 flex gap-4">
            <span>© {new Date().getFullYear()} AEOBRO</span>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/aup">AUP</a>
            <a href="/disputes">Disputes</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
