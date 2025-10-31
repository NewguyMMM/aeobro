// lib/verify/providers/tiktok.ts
// ✅ Updated: 2025-10-31 07:44 ET
import { ProviderIdentity, ProviderError, assertBearer, assertOk } from "./types";

/**
 * TikTok Open API v2
 * Scopes: user.info.basic
 * Endpoints (varies by app region/permissions):
 *   POST https://open.tiktokapis.com/v2/user/info/
 *     body: { fields: ["open_id","display_name","avatar_url"] }
 */
export async function fetchIdentity(accessToken?: string): Promise<ProviderIdentity> {
  assertBearer(accessToken, "tiktok");

  const res = await fetch("https://open.tiktokapis.com/v2/user/info/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: ["open_id", "display_name", "username", "avatar_url"] }),
  });
  await assertOk(res, "tiktok", "/v2/user/info/");
  const data = await res.json();

  const user = data?.data?.user;
  const openId = user?.open_id;
  if (!openId) {
    throw new ProviderError("TikTok: no open_id returned. Ensure 'user.info.basic' scope is granted.", {
      code: "NO_OPEN_ID",
    });
  }

  const username: string | undefined = user?.username;
  return {
    externalId: String(openId),
    handle: user?.display_name || (username ? `@${username}` : undefined),
    url: username ? `https://www.tiktok.com/@${username}` : undefined,
    platformContext: "tiktok-user",
    raw: data,
  };
}
