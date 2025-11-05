// lib/storage.ts
// ✅ Single swap point: Vercel Blob today; R2/S3 tomorrow.
export type UploadResult = { url: string; size: number; path: string };

const PROVIDER = process.env.STORAGE_PROVIDER ?? "vercel-blob";

export async function storePublicImage(path: string, file: File): Promise<UploadResult> {
  if (PROVIDER === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    const res = await put(path, file, { access: "public", addRandomSuffix: false });
    return { url: res.url, size: file.size, path };
  }
  // S3/R2 fallback (examples further below)
  const mod = await import("./storage_s3");
  return mod.storePublicImageS3(path, file);
}

export async function removePublicImage(urlOrPath: string): Promise<void> {
  if (!urlOrPath) return;
  if (PROVIDER === "vercel-blob") {
    const { del } = await import("@vercel/blob");
    await del(urlOrPath);
    return;
  }
  const mod = await import("./storage_s3");
  await mod.removePublicImageS3(urlOrPath);
}
