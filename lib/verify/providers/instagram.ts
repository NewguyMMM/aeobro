// lib/verify/providers/instagram.ts
// ✅ Updated: 2025-10-31 07:44 ET
import { ProviderIdentity, ProviderError, assertBearer, assertOk } from "./types";

/**
 * Instagram Business identity via Facebook Graph:
 * Steps:
 *  1) GET /me/accounts to list Pages you manage  (requires pages_show_list)
 *  2) For each Page, GET /{pageId}?fields=connected_instagram_account
 *  3) If present, GET /{igId}?fields=id,username,name
 *
 * Scopes: instagram_basic + pages_show_list
 */
export async function fetchIdentity(accessToken?: string): Promise<ProviderIdentity> {
  assertBearer(accessToken, "instagram");

  // 1) List FB pages
  const pagesRes = await fetch(
    "https://graph.facebook.com/v19.0/me/accounts?fields=id,name",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  await assertOk(pagesRes, "instagram/facebook", "/me/accounts");
  const pagesJson = await pagesRes.json();
  const pages = Array.isArray(pagesJson?.data) ? pagesJson.data : [];
  if (!pages.length) {
    throw new ProviderError(
      "No Facebook Pages accessible. To verify Instagram Business, you must manage a Facebook Page linked to your IG Business account and grant 'pages_show_list' + 'instagram_basic'.",
      { code: "NO_PAGES" }
    );
  }

  // 2) Find a Page with a connected IG account
  for (const page of pages) {
    const pageRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=connected_instagram_account`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    await assertOk(pageRes, "instagram/facebook", "/{pageId}?fields=connected_instagram_account");
    const pageJson = await pageRes.json();
    const ig = pageJson?.connected_instagram_account;
    if (!ig?.id) continue;

    // 3) Load IG account
    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${ig.id}?fields=id,username,name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    await assertOk(igRes, "instagram", "/{igId}?fields=id,username,name");
    const igJson = await igRes.json();

    const externalId = String(igJson.id);
    const handle = igJson.username || igJson.name || undefined;
    const url = igJson.username ? `https://www.instagram.com/${igJson.username}` : undefined;

    return {
      externalId,
      handle,
      url,
      platformContext: "instagram-business",
      raw: { page, ig: igJson },
    };
  }

  throw new ProviderError(
    "No Instagram Business account connected to your Facebook Pages. Link your IG Business to a Page and grant 'instagram_basic'.",
    { code: "NO_IG_LINKED" }
  );
}
