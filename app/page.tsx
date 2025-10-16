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

          {/* New 3-paragraph subtext */}
          <p className="text-gray-700 max-w-xl mb-2">
            Your brand&rsquo;s information is out there.
          </p>

          <p className="text-gray-700 max-w-xl mb-2">
            AEOBRO organizes and optimizes your brand&rsquo;s information so
            it&rsquo;s picked up and displayed by AI systems like ChatGPT,
            Gemini, and Perplexity.
          </p>

          <p className="text-gray-700 max-w-xl mb-6">
            AEOBRO creates and maintains verified{" "}
            <span
              className="relative inline-block group align-baseline"
              tabIndex={0}
            >
              <span
                className="underline decoration-dotted cursor-help"
                title="JSON-LD (JavaScript Object Notation for Linked Data) is a format that organizes your business information so AI systems and search engines can understand it. It’s like a digital language that connects your brand to the web of knowledge machines use. See FAQ for more."
              >
                JSON-LD
              </span>
              {/* Hover/focus tooltip */}
              <span
                role="tooltip"
                className="absolute z-10 left-0 mt-2 w-80 max-w-xs rounded-xl border bg-white p-3 text-gray-700 text-sm shadow-xl opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <strong>JSON-LD (JavaScript Object Notation for Linked Data)</strong>{" "}
                is a format that organizes your business information so AI
                systems and search engines can understand it. It’s like a
                digital language that connects your brand to the web of
                knowledge machines use.
                <span className="block mt-2 italic">See FAQ for more.</span>
              </span>
            </span>{" "}
            profiles — structured data that machines can trust — keeping your
            presence accurate, current, and AI-ready. No technical skills
            required.
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
