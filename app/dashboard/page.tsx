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
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));

    // Listen for auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Not signed in: show Supabase Auth (magic link)
  if (!session) {
    return (
      <div className="max-w-md mx-auto py-16">
        <h1 className="text-2xl font-semibold mb-6">Sign in to create your profile</h1>

        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          // If you don't use Google OAuth yet, leave only magic-link email:
          providers={[]}
          onlyThirdPartyProviders={false}
          redirectTo={
            typeof window !== 'undefined'
              ? `${window.location.origin}/dashboard`
              : undefined
          }
        />

        <p className="text-sm text-gray-500 mt-4">
          We’ll email you a magic link from <strong>noreply@aeobro.com</strong>. Check spam if you don’t
          see it within a minute.
        </p>
      </div>
    );
  }

  // Signed in: simple placeholder
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-2">Your profile</h1>
      <p className="text-gray-600 mb-8">
        Start filling out your AEO/GEO-ready details.
      </p>

      <div className="rounded-xl border p-6">
        <p className="mb-4">
          Profile editor goes here (Who you are, Web presence, Location, FAQs, etc.).
        </p>
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
    </div>
  );
}
