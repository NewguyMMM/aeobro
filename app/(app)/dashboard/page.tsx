// app/(app)/dashboard/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardRedirect() {
  redirect("/dashboard/editor");
}
