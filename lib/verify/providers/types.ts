// lib/verify/providers/types.ts
// ✅ Updated: 2025-10-31 07:44 ET

export type ProviderIdentity = {
  externalId: string;
  handle?: string;
  url?: string;
  platformContext: string;
  raw?: any;
};

export class ProviderError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = "ProviderError";
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

export function assertBearer(token?: string, provider = "provider") {
  if (!token) {
    throw new ProviderError(`Missing ${provider} access token. Please reconnect ${provider}.`, {
      code: "MISSING_TOKEN",
    });
  }
}

export async function assertOk(res: Response, provider: string, endpoint: string) {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  // Try to surface scope-like issues
  const lower = text.toLowerCase();
  const maybeScope =
    lower.includes("permission") ||
    lower.includes("scope") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized");
  throw new ProviderError(
    `${provider}: ${endpoint} failed (${res.status}).${maybeScope ? " Check granted scopes/permissions." : ""} ${text}`.trim(),
    { status: res.status }
  );
}
