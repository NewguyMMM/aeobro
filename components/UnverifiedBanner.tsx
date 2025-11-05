// components/UnverifiedBanner.tsx
// 📅 Updated: 2025-11-05 06:00 ET
"use client";

import * as React from "react";

export default function UnverifiedBanner({
  status,
}: {
  status: "UNVERIFIED" | "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED";
}) {
  if (status !== "UNVERIFIED") return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">Unverified profile</div>
          <div className="text-sm text-neutral-700">
            Verify once to unlock badge & external syndication.
          </div>
        </div>
        <a
          href="#verify"
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-900 underline hover:bg-amber-100"
        >
          Go to Verify ↓
        </a>
      </div>
    </div>
  );
}
