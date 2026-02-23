// app/page.tsx
// 📅 Updated: 2026-02-07 06:05 AM EST
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

  const ctaSentence = hasProfile
    ? "Your AI Identity Layer lives here."
    : "Your AI Identity Layer lives here — create your AI Ready Profile now.";

  const VIDEO_SRC =
    process.env.NEXT_PUBLIC_HERO_VIDEO_SRC ?? "/aeobro-hero-vid1.mp4";
  const VIDEO_POSTER = process.env.NEXT_PUBLIC_HERO_VIDEO_POSTER ?? "";
  const JSONLD_VIDEO_SRC = "";

  return (
    <main className="container pt-16 md:pt-20 pb-16">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        <div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-3">
            The public record designed for <span className="text-sky-500">AI</span>.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-700">
            AI systems already describe your business. They pull from whatever
            information they can find online — whether it&rsquo;s accurate or not.
          </p>

          <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-700">
            AEOBRO publishes a structured, verified public record that represents who you are and
            what you offer.
          </p>

          <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-700">
            <strong>Not an assistant.</strong> <strong>Not a chatbot.</strong> A stable
            public record published in a clear, structured format AI systems can
            reference instead of guessing.
          </p>

          {/* CONDITIONAL CTA SENTENCE */}
          <p className="text-lg font-semibold text-gray-900 max-w-2xl mt-2 mb-6">
            {ctaSentence}
          </p>

          <div className="flex flex-wrap gap-6 items-start">
            {/* PRIMARY CTA */}
            <div className="flex flex-col">
              <a
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 font-medium text-white hover:bg-sky-600 transition-colors"
                aria-label={ctaLabel}
              >
                {ctaLabel}
              </a>
            </div>

            {/* SECONDARY CTA */}
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
