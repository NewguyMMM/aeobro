// lib/verify/providers/googleYoutube.ts
// ✅ Updated: 2025-10-31 07:44 ET
import { ProviderIdentity, ProviderError, assertBearer, assertOk } from "./types";

/**
 * Requires Google OAuth with scope:
 *   https://www.googleapis.com/auth/youtube.readonly
 * Endpoint:
 *   GET https://www.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true
 */
export async function fetchIdentity(accessToken?: string): Promise<ProviderIdentity> {
  assertBearer(accessToken, "google/youtube");

  const url = "https://www.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true";
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  await assertOk(res, "google/youtube", "/youtube/v3/channels?mine=true");
  const data = await res.json();

  const ch = data?.items?.[0];
  if (!ch?.id) {
    throw new ProviderError(
      "No YouTube channel found on this Google account. Create or select a channel, then try again.",
      { code: "NO_CHANNEL" }
    );
  }

  const externalId = ch.id as string;
  const handle = ch?.snippet?.title as string | undefined;
  const urlPublic = `https://www.youtube.com/channel/${externalId}`;

  return {
    externalId,
    handle,
    url: urlPublic,
    platformContext: "google-youtube",
    raw: data,
  };
}
