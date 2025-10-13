// components/VideoSequence.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function VideoSequence({
  firstSrc,
  firstPoster,
  secondSrc,
}: {
  firstSrc: string;
  firstPoster?: string;
  secondSrc: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentSrc, setCurrentSrc] = useState(firstSrc);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (currentSrc === firstSrc && secondSrc) {
        setCurrentSrc(secondSrc);
        video.src = secondSrc;
        video.loop = true;
        video.controls = false;
        video.play().catch(() => {});
      }
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [currentSrc, firstSrc, secondSrc]);

  return (
    <div className="order-first md:order-none md:justify-self-end w-full max-w-[560px]">
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black shadow-sm">
        {currentSrc ? (
          <video
            ref={videoRef}
            key={currentSrc}
            className="h-full w-full object-cover"
            src={currentSrc}
            poster={currentSrc === firstSrc ? firstPoster || undefined : undefined}
            controls={currentSrc === firstSrc}
            playsInline
            preload="metadata"
            autoPlay
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
  );
}
