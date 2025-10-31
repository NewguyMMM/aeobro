// lib/verify/providers/facebook.ts
// ✅ Updated: 2025-10-31 07:44 ET
import { ProviderIdentity, ProviderError, assertBearer, assertOk } from "./types";

/**
 * Minimal "who am I" for Facebook user identity.
 * Scopes: public_profile (plus pages_show_list/pages_read_engagement if you later verify Pages/IG)
 *
 * Endpoint:
 *   GET https://graph.facebook.com/v19.0/me?fields=id,name,link
 */
export async function fetchIdentity(accessToken?: string): Promise<ProviderIdentity> {
  assertBearer(accessToken, "facebook");

  const url = "https://graph.facebook.com/v19.0/me?fields=id,name,link";
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  await assertOk(res, "facebook", "/me?fields=id,name,link");
  const me = await res.json();

  if (!me?.id) {
    throw new ProviderError("Facebook: no user id returned. Check permissions and try again.", {
      code: "NO_USER_ID",
    });
  }

  return {
    externalId: String(me.id),
    handle: me.name || undefined,
    url: me.link || `https://www.facebook.com/${me.id}`,
    platformContext: "facebook-user",
    raw: me,
  };
}

/**
 * Optional: verify a Facebook Page you manage instead of the user.
 * Requires scope: pages_show_list
 * Endpoint:
 *   GET https://graph.facebook.com/v19.0/me/accounts?fields=id,name,link
 * Pass a pageId to pick a specific page; otherwise choose the first.
 */
export async function fetchPageIdentity(accessToken: string, pageId?: string): Promise<ProviderIdentity> {
  assertBearer(accessToken, "facebook");
  const url = "https://graph.facebook.com/v19.0/me/accounts?fields=id,name,link";
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  await assertOk(res, "facebook", "/me/accounts");

  const data = await res.json();
  const pages = Array.isArray(data?.data) ? data.data : [];
  if (!pages.length) {
    throw new ProviderError(
      "No Facebook Pages accessible. Grant 'pages_show_list' and ensure you manage a Page.",
      { code: "NO_PAGES" }
    );
  }

  const page =
    (pageId && pages.find((p: any) => String(p.id) === String(pageId))) || pages[0];

  return {
    externalId: String(page.id),
    handle: page.name || undefined,
    url: page.link || `https://www.facebook.com/${page.id}`,
    platformContext: "facebook-page",
    raw: page,
  };
}
