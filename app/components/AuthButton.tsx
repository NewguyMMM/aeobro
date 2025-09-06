"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Avoid flashing/mismatch while NextAuth determines state
  if (status === "loading") return null;

  if (!session) {
    return (
      <button onClick={() => signIn()} className="btn btn-primary">
        Sign in
      </button>
    );
  }

  // Signed in: hide on /login
  if (pathname === "/login") return null;

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="btn btn-primary"
    >
      Sign out
    </button>
  );
}
