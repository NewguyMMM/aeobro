// app/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic"; // ensure CTA isn't cached incorrectly

export default async function Home() {
  // Default: assume no profile (covers signed-out users)
  let hasProfile = false;

  // If signed in, check for any saved profile
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (user?.id) {
      const profile = await prisma.profile.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      hasProfile = Boolean(profile?.id);
    }
  }

  const ctaLabel = hasProfile
    ? "Edit Your AI Ready Profile"
    : "Create Your AI Ready Profile";

  // Video configuration via env (stable, easy to swap without code changes)
  const VIDEO_SRC = process.env.NEXT_PUBLIC_HERO_VIDEO_SRC ?? "";
  const VIDEO_POSTER = process.env.NEXT_PUBLIC_HERO_VIDEO_POSTER ?? "";

  return (
    <main className="container pt-16 md:pt-20 pb-16">
      {/* Two-column hero: copy/CTAs left, smaller video right */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        {/* Left: headline, copy, CTAs */}
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">
            Help <span className="text-sky-500">AI</span> find you.
          </h1>

          {/* Tagline */}
          <p className="text-gray-700 max-w-xl">
            AEOBRO optimizes your content to be picked up and displayed by AI.
          </p>
          <p className="text-gray-700 mb-4 max-w-xl">
            Structured, efficient, trusted, and kept current in one place.
          </p>

          {/* Secondary credibility booster */}
          <p className="text-gray-500 mb-6 max-w-xl">
            Verified JSON-LD profiles that machines can trust.
          </p>

          {/* CTAs kept near the top to avoid scrolling */}
          <div className="flex flex-wrap gap-3">
            {/* Primary CTA — label flips based on whether a profile exists */}
            <a
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 font-medium text-white hover:bg-sky-600 transition-colors"
              aria-label={ctaLabel}
            >
              {ctaLabel}
            </a>

            {/* Secondary CTA */}
            <a
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-xl border px-5 font-medium hover:border-sky-600 hover:text-sky-700 transition-colors"
            >
              See pricing
            </a>
          </div>
        </div>

        {/* Right: smaller video */}
        <div className="order-first md:order-none md:justify-self-end w-full max-w-[560px]">
          <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black shadow-sm">
            {VIDEO_SRC ? (
              <video
                className="h-full w-full object-cover"
                src={VIDEO_SRC}
                poster={VIDEO_POSTER || undefined}
                // Per your request: play once with visible controls
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm px-4 text-center">
                Set{" "}
                <code className="mx-1 rounded bg-white/10 px-2 py-1">
                  NEXT_PUBLIC_HERO_VIDEO_SRC
                </code>{" "}
                in Vercel env vars to play your hero video.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
