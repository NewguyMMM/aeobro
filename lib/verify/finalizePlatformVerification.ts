import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

type Params = {
  userId: string;
  account: {
    provider: string;
    access_token?: string | null;
    scope?: string | null;
  };
};

export async function finalizePlatformVerification({ userId, account }: Params) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user?.profile) return;

  const profile = user.profile;

  let externalId = "";
  let handle: string | undefined;
  let url: string | undefined;
  let platformContext: string | undefined;
  let scopes = account.scope || "";
  const provider = account.provider;

  if (provider === "google") {
    // ——— YouTube canonical identity ———
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: account.access_token! });
    const yt = google.youtube({ version: "v3", auth: oauth2Client });

    const resp = await yt.channels.list({ part: ["id", "snippet"], mine: true });
    const channel = resp.data.items?.[0];
    if (!channel?.id) throw new Error("No YouTube channel found for this Google account");
    externalId = channel.id;
    handle = channel.snippet?.title || undefined;
    url = `https://www.youtube.com/channel/${externalId}`;
    platformContext = "google-youtube";
  }

  // TODO: add branches for facebook / instagram / twitter / tiktok:
  // - Facebook: call /me and optionally /me/accounts to get Pages; choose one and store page id + URL
  // - Instagram: via FB Page's connected_ig_account
  // - Twitter (X): call /2/users/me
  // - TikTok: call userinfo to get open_id + profile link

  // Upsert PlatformAccount
  const pa = await prisma.platformAccount.upsert({
    where: { provider_externalId: { provider, externalId } },
    update: {
      handle,
      url,
      status: "VERIFIED",
      verifiedAt: new Date(),
      method: "OAUTH",
      platformContext,
      scopes,
      profileId: profile.id,
    },
    create: {
      userId,
      profileId: profile.id,
      provider,
      externalId,
      handle,
      url,
      status: "VERIFIED",
      verifiedAt: new Date(),
      method: "OAUTH",
      platformContext,
      scopes,
    },
  });

  // Lift profile to PLATFORM_VERIFIED (idempotent)
  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      verificationStatus: "PLATFORM_VERIFIED",
      platformVerifiedAt: new Date(),
      verifiedPlatforms: {
        ...(profile.verifiedPlatforms as any),
        [provider]: {
          externalId,
          url,
          handle,
          platformContext,
          verifiedAt: new Date().toISOString(),
        },
      },
    },
  });

  // Optional: write ChangeLog
  await prisma.changeLog.create({
    data: {
      userId,
      profileId: profile.id,
      entity: "PROFILE",
      action: "UPDATE",
      field: "verificationStatus",
      before: { verificationStatus: profile.verificationStatus },
      after: { verificationStatus: "PLATFORM_VERIFIED", provider, platformAccountId: pa.id },
    },
  });
}
