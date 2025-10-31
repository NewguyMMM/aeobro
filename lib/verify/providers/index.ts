// lib/verify/providers/index.ts
// ✅ Updated: 2025-10-31 07:44 ET
import type { ProviderIdentity } from "./types";
import { ProviderError } from "./types";
import * as googleYoutube from "./googleYoutube";
import * as facebook from "./facebook";
import * as instagram from "./instagram";
import * as twitter from "./twitter";
import * as tiktok from "./tiktok";

export async function fetchProviderIdentity(
  provider: string,
  accessToken?: string,
  opts?: Record<string, any>
): Promise<ProviderIdentity> {
  switch (provider) {
    case "google":
      return googleYoutube.fetchIdentity(accessToken);
    case "facebook":
      // If you want to verify a Page/IG instead of the user, choose here:
      if (opts?.kind === "page") {
        return facebook.fetchPageIdentity(accessToken!, opts?.pageId);
      }
      return facebook.fetchIdentity(accessToken);
    case "instagram":
      return instagram.fetchIdentity(accessToken);
    case "twitter":
      return twitter.fetchIdentity(accessToken);
    case "tiktok":
      return tiktok.fetchIdentity(accessToken);
    default:
      throw new ProviderError(`Unsupported provider: ${provider}`);
  }
}

export * from "./types";
