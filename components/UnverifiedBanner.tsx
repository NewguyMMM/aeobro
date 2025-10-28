// components/UnverifiedBanner.tsx
"use client";

import * as React from "react";
import VerificationCard from "@/components/VerificationCard";

export default function UnverifiedBanner({
  status,
}: {
  status: "UNVERIFIED" | "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED";
}) {
  if (status !== "UNVERIFIED") return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-medium">Unverified profile</div>
          <div className="text-sm text-neutral-600">
            Verify once to unlock badge & external syndication.
          </div>
        </div>
        <VerificationCard />
      </div>
    </div>
  );
}
