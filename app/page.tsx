// app/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import VideoSequence from "../components/VideoSequence";

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

  // Video sources (controlled via env vars or defaults)
  const VIDEO_SRC =
    process.env.NEXT_PUBLIC_HERO_VIDEO_SRC ?? "/aeobro-hero-vid1.mp4";
  const VIDEO_POSTER = process.env.NEXT_PUBLIC_HERO_VIDEO_POSTER ?? "";

  // You're holding off on the JSON-LD video for now; pass empty to disable auto-advance
  const JSONLD_VIDEO_SRC = "";

  return (
    <main className="container pt-16 md:pt-20 pb-16">
      {/* Two-column hero: copy/CTAs left, smaller video right */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        {/* Left: headline, copy, CTAs */}
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">
            Help <span className="text-sky-500">AI</span> find you.
          </h1>

          <p className="text-gray-700 max-w-xl">
            AEOBRO optimizes your content to be picked up and displayed by AI.
          </p>
          <p className="text-gray-700 mb-4 max-w-xl">
            Structured, efficient, trusted, and kept current in one place.
          </p>

          <p className="text-gray-500 mb-6 max-w-xl">
            Verified JSON-LD profiles that machines can trust.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 font-medium text-white hover:bg-sky-600 transition-colors"
              aria-label={ctaLabel}
            >
              {ctaLabel}
            </a>

            <a
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-xl border px-5 font-medium hover:border-sky-600 hover:text-sky-700 transition-colors"
            >
              See pricing
            </a>
          </div>
        </div>

        {/* Right: single video with replay support */}
        <VideoSequence
          firstSrc={VIDEO_SRC}
          firstPoster={VIDEO_POSTER}
          secondSrc={JSONLD_VIDEO_SRC}
        />
      </section>
    </main>
  );
}
