"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";

type Props = { className?: string };

export default function HomeLink({ className = "" }: Props) {
  const pathname = usePathname();

  // Hide on the homepage itself
  if (pathname === "/") return null;

  return (
    <Link
      href="/"
      aria-label="Go to AEOBRO home"
      className={
        "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm " +
        "hover:bg-neutral-50 active:translate-y-px " +
        "transition " +
        className
      }
    >
      <Home className="h-4 w-4" />
      <span className="hidden sm:inline">Home</span>
    </Link>
  );
}
