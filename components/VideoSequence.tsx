// components/VideoSequence.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  firstSrc: string;
  firstPoster?: string;
  /** Optional – if provided, we’ll auto-advance to this after first ends.
   * If empty/undefined, we’ll show a Replay button instead. */
  secondSrc?: string;
};

export default function VideoSequence({ firstSrc, firstPoster, secondSrc }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [src, setSrc] = useState<string>(firstSrc);
  const [showReplay, setShowReplay] = useState(false);

  // Keep internal src in sync if env or props change
  useEffect(() => {
    setSrc(firstSrc);
    setShowReplay(false);
  }, [firstSrc]);

  const onEnded = () => {
    const v = videoRef.current;
    if (!v) return;

    // If a second video is defined, advance to it; otherwise show replay UI.
    if (secondSrc) {
      setSrc(secondSrc);
      setShowReplay(false);
      // Load new source and play
      requestAnimationFrame(() => {
        v.load();
        // Don’t auto-play if you want play-on-click; comment next line out.
        // v.play().catch(() => {});
      });
    } else {
      // Stay on the same video, show replay
      setShowReplay(true);
    }
  };

  const onPlay = () => setShowReplay(false);

  const handleReplay = () => {
    const v = videoRef.current;
    if (!v) return;
    setShowReplay(false);
    try {
      v.currentTime = 0;
      v.play().catch(() => {});
    } catch {
      // If currentTime isn’t seekable yet, reload
      v.load();
      v.play().catch(() => {});
    }
  };

  // Use the poster only for the first video
  const poster = src === firstSrc && firstPoster ? firstPoster : undefined;

  return (
    <div className="order-first md:order-none md:justify-self-end w-full max-w-[560px]">
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black shadow-sm">
        <video
          ref={videoRef}
          key={src} // force <video> to reset when source changes
          className="h-full w-full object-cover"
          src={src}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          onEnded={onEnded}
          onPlay={onPlay}
        >
          Your browser does not support the video tag.
        </video>

        {showReplay && (
          <button
            type="button"
            onClick={handleReplay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-semibold rounded-2xl focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Replay video"
            title="Replay"
          >
            ↺ Replay
          </button>
        )}
      </div>
    </div>
  );
}
