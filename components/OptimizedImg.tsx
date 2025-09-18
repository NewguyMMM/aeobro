"use client";
import Image, { ImageProps } from "next/image";
import * as React from "react";

type Props = Omit<ImageProps, "placeholder"> & {
  blur?: string | null; // optional base64 blur
};

/**
 * Drop-in wrapper around next/image with smart defaults:
 *  - responsive sizes for profile layouts
 *  - optional blur placeholder
 *  - guards against missing src
 */
export default function OptimizedImg({ blur, sizes, alt, ...rest }: Props) {
  const placeholder = blur ? "blur" : "empty";
  return (
    <Image
      alt={alt ?? ""}
      sizes={sizes ?? "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 256px"}
      placeholder={placeholder as any}
      blurDataURL={blur ?? undefined}
      {...rest}
    />
  );
}
