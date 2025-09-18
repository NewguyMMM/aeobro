"use client";
import * as React from "react";
import Image, { ImageProps } from "next/image";

type Props = Omit<ImageProps, "placeholder"> & {
  /** Optional base64 data URI for blur placeholder */
  blur?: string | null;
};

/**
 * Drop-in wrapper around next/image with smart defaults:
 * - Gracefully no-ops if src is missing
 * - Works with either fixed width/height or fill
 * - Provides responsive `sizes` defaults
 * - Uses blur placeholder only when provided
 * - Async decoding + proper fetchPriority based on `priority`
 */
function OptimizedImgBase(props: Props) {
  const {
    blur,
    sizes,
    alt,
    src,
    fill,
    width,
    height,
    priority,
    quality,
    ...rest
  } = props;

  // Guard: if no src, render nothing (avoids runtime errors)
  if (!src) return null;

  // If using `fill`, give a responsive sizes default; otherwise a conservative fixed default
  const resolvedSizes =
    sizes ?? (fill ? "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw" : "256px");

  const placeholder = blur ? "blur" : "empty";
  const fetchPriority = priority ? "high" : "auto";

  return (
    <Image
      src={src}
      alt={alt ?? ""}
      // If fill is true, Next.js ignores width/height; otherwise they are required.
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={resolvedSizes}
      placeholder={placeholder as any}
      blurDataURL={blur ?? undefined}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={fetchPriority as any}
      // Slightly higher quality default; adjust as you like
      quality={quality ?? 85}
      {...rest}
    />
  );
}

const OptimizedImg = React.memo(OptimizedImgBase);
export default OptimizedImg;
