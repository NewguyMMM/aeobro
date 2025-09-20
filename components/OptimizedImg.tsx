"use client";

import * as React from "react";
import Image, { ImageProps } from "next/image";

type Props = Omit<ImageProps, "placeholder"> & {
  /** Optional base64 data URI for blur placeholder */
  blur?: string | null;
  /**
   * Optional aspect ratio (width/height). When provided and NOT using `fill`,
   * we apply `style={{ aspectRatio }}` to reduce layout shifts.
   * Example: 16/9, 1, 4/3, etc.
   */
  ratio?: number;
};

/**
 * Drop-in wrapper around next/image with smart defaults:
 * - Gracefully no-ops if src is missing
 * - Works with either fixed width/height or fill
 * - Optional `ratio` to stabilize layout (CLS guard) when not using `fill`
 * - Provides responsive `sizes` defaults
 * - Uses blur placeholder only when provided
 * - Async decoding + proper fetchPriority based on `priority`
 * - Hides element on load error to avoid broken-image icons
 */
function OptimizedImgBase(props: Props) {
  const {
    blur,
    ratio,
    sizes,
    alt,
    src,
    fill,
    width,
    height,
    priority,
    quality,
    className,
    style,
    ...rest
  } = props;

  // Guard: if no src, render nothing (avoids runtime errors)
  if (!src) return null;

  const [errored, setErrored] = React.useState(false);
  if (errored) return null;

  // Responsive default:
  // - mobile: take most of the width
  // - tablet: ~50vw
  // - desktop: ~25vw
  const resolvedSizes =
    sizes ??
    (fill
      ? "(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 25vw"
      : "256px");

  const placeholder = blur ? "blur" : ("empty" as const);
  const fetchPriority = priority ? ("high" as const) : ("auto" as const);

  // If not using `fill` and a ratio is provided, apply native aspect-ratio to reduce CLS.
  const mergedStyle =
    !fill && ratio
      ? { ...style, aspectRatio: ratio }
      : style;

  return (
    <Image
      src={src}
      alt={alt ?? ""}
      // If fill is true, Next.js ignores width/height; otherwise they are required.
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={resolvedSizes}
      placeholder={placeholder}
      blurDataURL={blur ?? undefined}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={fetchPriority}
      quality={quality ?? 85}
      className={className}
      style={mergedStyle}
      onError={() => setErrored(true)}
      {...rest}
    />
  );
}

const OptimizedImg = React.memo(OptimizedImgBase);
export default OptimizedImg;
