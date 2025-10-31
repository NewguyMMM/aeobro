// components/VerifiedBadges.tsx
// ✅ Updated: 2025-10-31 08:20 ET
import * as React from "react";

export function VerifiedBadges({
  domain,
  platform,
  className = "",
}: {
  domain?: boolean;
  platform?: boolean;
  className?: string;
}) {
  if (!domain && !platform) return null;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {platform && (
        <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
          Platform Verified
        </span>
      )}
      {domain && (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
          Domain Verified
        </span>
      )}
    </div>
  );
}
