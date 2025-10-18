"use client";

import Script from "next/script";

type Props = {
  siteKey?: string;                     // optional override
  size?: "normal" | "compact" | "invisible";
  theme?: "auto" | "light" | "dark";
  className?: string;
};

/**
 * Renders a Cloudflare Turnstile widget. It injects a hidden input named
 * `cf-turnstile-response` that your server can validate.
 */
export default function TurnstileWidget({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
  size = "managed" as any, // Cloudflare treats managed as default; keep "normal" if you prefer
  theme = "auto",
  className = "",
}: Props) {
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />
      <div
        className={`cf-turnstile ${className}`}
        data-sitekey={siteKey}
        data-theme={theme}
        // omit data-size to let Managed mode decide; set data-size={size} if you want to force it
      />
    </>
  );
}
