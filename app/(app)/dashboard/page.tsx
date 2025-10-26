// app/(app)/dashboard/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardRedirect() {
  // Immediately send the user to the profile editor page
  redirect("/dashboard/editor");
}
