// app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Your AI Profile</h1>
        <form method="post" action="/api/auth/signout">
          <button
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="rounded-2xl border p-8 bg-white shadow-sm">
        <p className="text-gray-600 mb-6">
          Signed in as <strong>{session.user?.email}</strong>
        </p>
        <h2 className="text-xl font-semibold mb-4">Profile editor</h2>
        <p className="text-gray-600 mb-6">
          Here’s where you’ll add your brand facts: who you are, links, location,
          FAQs, and more. This will generate your verified JSON-LD + public facts bundle.
        </p>
        <button className="px-5 py-3 rounded-xl bg-black text-white hover:bg-gray-900">
          Add your first fact
        </button>
      </section>
    </div>
  );
}

