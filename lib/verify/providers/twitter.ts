// lib/verify/providers/twitter.ts
// ✅ Updated: 2025-10-31 07:44 ET
import { ProviderIdentity, ProviderError, assertBearer, assertOk } from "./types";

/**
 * Twitter/X v2 identity
 * Scopes: tweet.read users.read offline.access (minimum)
 * Endpoint:
 *   GET https://api.twitter.com/2/users/me
 */
export async function fetchIdentity(accessToken?: string): Promise<ProviderIdentity> {
  assertBearer(accessToken, "twitter");

  const res = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await assertOk(res, "twitter", "/2/users/me");
  const data = await res.json();

  const u = data?.data;
  if (!u?.id) {
    throw new ProviderError("Twitter: no user id returned. Check granted scopes.", {
      code: "NO_USER_ID",
    });
  }

  const externalId = String(u.id);
  const handle = u.username ? `@${u.username}` : undefined;
  const url = u.username ? `https://twitter.com/${u.username}` : undefined;

  return {
    externalId,
    handle,
    url,
    platformContext: "twitter-user",
    raw: data,
  };
}
