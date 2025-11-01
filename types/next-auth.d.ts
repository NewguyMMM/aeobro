// types/next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  // If you use `adapter` (Prisma), NextAuth's `User` will have `id`
  interface User {
    id: string;
  }
}
