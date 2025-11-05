// app/layout.tsx
import React, { type ReactNode } from "react";
import "./globals.css";
import Providers from "./providers";
import AuthButton from "./components/AuthButton";
import { ToastProvider } from "@/components/Toast";
import HomeLink from "@/components/HomeLink"; // ⬅️ new

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ToastProvider>
            <header className="border-b">
              <div className="container flex items-center justify-between py-4">
                <a href="/" className="font-bold text-xl" aria-label="AEOBRO home">
                  AEO<span className="text-sky-500">BRO</span>
                </a>

                <nav className="flex items-center gap-3">
                  {/* Home button appears on all routes except "/" */}
                  <HomeLink />

                  <a
                    href="/pricing"
                    className="px-3 py-2 transition-colors duration-200 hover:text-sky-500"
                  >
                    Pricing
                  </a>
                  <a
                    href="/faq"
                    className="px-3 py-2 transition-colors duration-200 hover:text-sky-500"
                  >
                    FAQ
                  </a>
                  <a className="btn transition-colors duration-200" href="/audit">
                    Check AI Visibility
                  </a>
                  <AuthButton />
                </nav>
              </div>
            </header>

            <main>{children}</main>

            <footer className="border-t mt-16">
              <div className="container py-8 text-sm text-gray-600 flex flex-wrap items-center gap-4">
                <span>© {new Date().getFullYear()} AEOBRO</span>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
                <a href="/aup">AUP</a>
                <a href="/disputes">Disputes</a>
                <a href="/cancel">Cancel subscription</a>
              </div>
            </footer>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
