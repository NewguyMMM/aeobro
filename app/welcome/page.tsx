// app/welcome/page.tsx
import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="container py-12">
      <h1 className="text-3xl font-bold mb-4">Welcome to AEOBRO 🎉</h1>
      <p className="mb-6">Let’s create your AI-visible profile so Google, ChatGPT, and other engines can verify you.</p>
      <Link href="/dashboard/profile" className="btn">Create your AI profile</Link>
    </main>
  );
}
