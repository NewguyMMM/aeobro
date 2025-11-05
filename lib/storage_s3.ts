// lib/storage_s3.ts
// 📅 Created: 2025-11-05 06:53 ET
// Stub so the build succeeds even when not using S3/R2.
// Replace with real implementation when you flip STORAGE_PROVIDER.

export async function storePublicImageS3(path: string, file: File) {
  throw new Error(
    "S3/R2 not configured. Set STORAGE_PROVIDER to 's3' or 'r2' and replace this stub with a real implementation."
  );
}

export async function removePublicImageS3(_urlOrPath: string) {
  // No-op stub
  return;
}
