'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardPage() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold mb-6">Sign in to create your AI Profile</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          onlyThirdPartyProviders={false}
          localization={{ variables: { sign_in: { email_label: 'Email' } } }}
          redirectTo={
            typeof window !== 'undefined'
              ? `${window.location.origin}/dashboard`
              : undefined
          }
        />
        <p className="text-sm text-gray-500 mt-4">
          We’ll email you a magic link from <strong>noreply@aeobro.com</strong>.
          Check spam if you don’t see it in a minute.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Your AI Profile</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Signed in as <strong>{session.user.email}</strong>
          </span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setSession(null);
            }}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Profile editor placeholder */}
      <section className="rounded-2xl border p-8 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Profile editor</h2>
        <p className="text-gray-600 mb-6">
          Here’s where you’ll add your brand facts: who you are, links, location, FAQs,
          and more. This will generate your verified JSON-LD + public facts bundle.
        </p>
        <button className="px-5 py-3 rounded-xl bg-black text-white hover:bg-gray-900">
          Add your first fact
        </button>
      </section>
    </div>
  );
}
