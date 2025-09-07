"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Avoid flashing/mismatch while NextAuth determines state
  if (status === "loading") return null;

  // Not signed in → show blue "Sign in"
  if (!session) {
    return (
      <button
        onClick={() => signIn()}
        className="btn bg-sky-500 text-white hover:bg-sky-600 transition-colors duration-200"
      >
        Sign in
      </button>
    );
  }

  // Signed in → hide on /login
  if (pathname === "/login") return null;

  // Signed in → show green "Sign out"
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="btn bg-green-600 text-white hover:bg-green-700 transition-colors duration-200"
    >
      Sign out
    </button>
  );
}
