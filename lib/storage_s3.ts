// lib/storage_s3.ts
// 📅 Updated: 2025-11-05 06:58 ET
// Stub so builds succeed when STORAGE_PROVIDER isn't 's3' or 'r2'.
// When you flip providers later, replace this stub with the real implementation.

export type UploadResult = { url: string; size: number; path: string };

export async function storePublicImageS3(_path: string, _file: File): Promise<UploadResult> {
  // This path shouldn't run unless you set STORAGE_PROVIDER=s3|r2.
  // We still type it correctly so TypeScript is happy.
  throw new Error(
    "S3/R2 not configured. Set STORAGE_PROVIDER to 's3' or 'r2' and provide a real implementation."
  );
}

export async function removePublicImageS3(_urlOrPath: string): Promise<void> {
  // No-op stub
  return;
}
