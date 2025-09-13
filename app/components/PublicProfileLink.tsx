// app/components/PublicProfileLink.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = {
  id: string | number;
  slug?: string | null;
  isPublished?: boolean | null; // if you later want to gate the link
};

export default function PublicProfileLink() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const profile: Profile | null = data?.profile ?? null;

        if (!profile) return;

        // If you want to require publish: uncomment next two lines
        // if (profile.isPublished === false) return;

        const url = profile.slug ? `/p/${profile.slug}` : `/profile/${profile.id}`;
        if (!cancelled) setHref(url);
      } catch {
        // ignore; link will simply not render
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!href) return null;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-blue-600 hover:underline"
    >
      View public profile
    </Link>
  );
}
