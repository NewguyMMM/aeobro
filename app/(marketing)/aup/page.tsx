// app/(marketing)/aup/page.tsx
export const revalidate = 3600; // cache page for 1 hour (ISR)

export default function AupPage() {
  return (
    <section className="container py-16">
      <h1 className="text-4xl font-extrabold">Acceptable Use Policy</h1>
      <p className="mt-6">
        No illegal, deceptive, hateful, or infringing content.
      </p>
    </section>
  );
}
