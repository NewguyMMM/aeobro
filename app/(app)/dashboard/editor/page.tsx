// app/(app)/dashboard/editor/page.tsx
import ProfileEditor from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";

export default function ProfileEditorPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Edit your AI-Ready Profile</h1>
        <p className="text-sm opacity-70">
          Add details now or come back anytime — you can publish with just a display name.
        </p>
      </header>

      {/* Your client editor handles fetching /api/profile by itself */}
      <ProfileEditor initial={null} />
    </main>
  );
}
