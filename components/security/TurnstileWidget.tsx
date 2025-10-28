"use client";

import Script from "next/script";
import * as React from "react";

type Props = {
  /** Called when a valid token is issued */
  onVerify?: (token: string) => void;
  /** Optional styling or layout class */
  className?: string;
  /** Optional Turnstile theme: auto | light | dark */
  theme?: "auto" | "light" | "dark";
};

/**
 * Cloudflare Turnstile widget wrapper.
 * - Loads Turnstile script once.
 * - Supports `onVerify` callback to capture token.
 * - Works with plain HTML form hidden input via parent component.
 */
export default function TurnstileWidget({ onVerify, className, theme = "auto" }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetId = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Wait for Turnstile to load and render widget
    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onVerify?.(token),
        "expired-callback": () => onVerify?.(""),
        "error-callback": () => onVerify?.(""),
      });
    };

    // Already loaded?
    if (window.turnstile) {
      renderWidget();
    } else {
      const handler = () => renderWidget();
      window.addEventListener("turnstile-loaded", handler);
      return () => window.removeEventListener("turnstile-loaded", handler);
    }

    // Cleanup
    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, [onVerify, siteKey, theme]);

  return (
    <>
      {/* Load Turnstile script globally once */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=turnstile-loaded"
        strategy="afterInteractive"
        async
        defer
      />
      <div ref={containerRef} className={className || "cf-turnstile"} data-sitekey={siteKey} data-theme={theme} />
    </>
  );
}

// Extend global type for TS
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: any) => string;
      remove: (id: string) => void;
    };
  }
}
