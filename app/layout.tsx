// app/layout.tsx
import React, { type ReactNode } from "react";
import "./globals.css";
import Providers from "./providers";
import AuthButton from "./components/AuthButton";
import { ToastProvider } from "@/components/Toast";
import HomeLink from "@/components/HomeLink";
import Footer from "./components/Footer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ToastProvider>
            <header className="border-b">
              <div className="container flex items-center justify-between py-4">
                <a
                  href="/"
                  className="font-bold text-xl"
                  aria-label="AEOBRO home"
                >
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
                  <a
                    className="btn transition-colors duration-200"
                    href="/audit"
                  >
                    Check AI Visibility
                  </a>
                  <AuthButton />
                </nav>
              </div>
            </header>

            <main>{children}</main>

            {/* Shared footer with Contact Support link */}
            <Footer />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
