// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Defensive: trim invisible whitespace in env vars (common source of URL parse errors)
if (process.env.NEXTAUTH_URL) process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.trim();
if (process.env.NEXTAUTH_SECRET) process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET.trim();
if (process.env.EMAIL_FROM) process.env.EMAIL_FROM = process.env.EMAIL_FROM.trim();

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
