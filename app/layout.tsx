// app/layout.tsx
import React, { type ReactNode } from "react";
import "./globals.css";
import Providers from "./providers";
import AuthButton from "./components/AuthButton";
import { ToastProvider } from "@/components/Toast";
import HomeLink from "@/components/HomeLink";
import MobileMenu from "./components/MobileMenu";
import Footer from "./components/Footer";
import type { Metadata } from "next";

const ASSET_V = "20260220";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aeobro.com"),
  title: {
    default: "AEOBRO",
    template: "%s | AEOBRO",
  },
  icons: {
    icon: [{ url: "/icon.svg" }, { url: "/icon.png" }],
    apple: [{ url: "/apple-icon.png" }],
  },
  themeColor: "#2196F3",
  openGraph: {
    type: "website",
    siteName: "AEOBRO",
    url: "https://www.aeobro.com",
    images: [
      {
        url: `/og/aeobro-og-1200x630.png?v=${ASSET_V}`,
        width: 1200,
        height: 630,
        alt: "AEOBRO",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [`/og/aeobro-og-1200x630.png?v=${ASSET_V}`],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ToastProvider>
            <header className="border-b">
              <div className="container flex items-center justify-between py-4">
                {/* Logo — never shrink on mobile */}
                <a
                  href="/"
                  aria-label="AEOBRO home"
                  className="flex items-center shrink-0"
                >
                  <img
                    src={`/brand/AEOBRO_primary.svg?v=${ASSET_V}`}
                    alt="AEOBRO"
                    className="h-[36px] w-auto"
                    style={{ display: "block" }}
                  />
                </a>

                {/* Mobile Header (hidden on desktop) */}
                <div className="flex items-center gap-3 sm:hidden">
                  <HomeLink />
                  <MobileMenu />
                  <AuthButton />
                </div>

                {/* Desktop Navigation (hidden on mobile) */}
                <nav className="hidden sm:flex items-center gap-3">
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

            <Footer />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
