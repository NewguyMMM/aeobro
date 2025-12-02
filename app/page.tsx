// app/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import VideoSequence from "../components/VideoSequence";

export const dynamic = "force-dynamic"; // ensure CTA isn't cached incorrectly

export default async function Home() {
  let hasProfile = false;

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

  const VIDEO_SRC =
    process.env.NEXT_PUBLIC_HERO_VIDEO_SRC ?? "/aeobro-hero-vid1.mp4";
  const VIDEO_POSTER = process.env.NEXT_PUBLIC_HERO_VIDEO_POSTER ?? "";
  const JSONLD_VIDEO_SRC = "";

  return (
    <main className="container pt-16 md:pt-20 pb-16">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        <div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-3">
            Help <span className="text-sky-500">AI</span> find you.
          </h1>

          {/* AI IDENTITY LAYER TAGLINE */}
          <p className="mt-1 max-w-2xl text-lg leading-snug text-gray-700 font-medium">
            AEOBRO is the creator of the AI Identity Layer™ and the leader in AI
            Identity™ for brands and businesses.
          </p>

          {/* SUPPORTING COPY */}
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-700">
            Your brand&rsquo;s information is out there.
          </p>

          <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-700">
            AEOBRO organizes and optimizes your brand&rsquo;s information so
            it&rsquo;s picked up and displayed by AI systems like ChatGPT,
            Gemini, and Perplexity.
          </p>

          <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-700 mb-6">
            Verified{" "}
            <span
              className="relative inline-block group align-baseline"
              tabIndex={0}
              aria-describedby="jsonld-tip"
            >
              <span className="underline decoration-dotted cursor-help">
                JSON-LD
              </span>
              <span
                id="jsonld-tip"
                role="tooltip"
                className="absolute z-10 left-1/2 -translate-x-1/2 mt-2 w-80 max-w-xs rounded-xl border bg-white p-3 text-gray-700 text-sm shadow-xl opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <strong>
                  JSON-LD (JavaScript Object Notation for Linked Data)
                </strong>{" "}
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

          {/* CTA BUTTONS */}
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

        <VideoSequence
          firstSrc={VIDEO_SRC}
          firstPoster={VIDEO_POSTER}
          secondSrc={JSONLD_VIDEO_SRC}
        />
      </section>
    </main>
  );
}
