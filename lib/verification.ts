import { randomBytes } from "crypto";
import { Resolver } from "dns/promises";
import { prisma } from "@/lib/prisma";

export function generateVerificationToken() {
  return randomBytes(16).toString("hex");
}

export async function ensureProfileToken(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { verificationToken: true },
  });
  if (profile?.verificationToken) return profile.verificationToken;

  const token = generateVerificationToken();
  await prisma.profile.update({
    where: { id: profileId },
    data: { verificationToken: token },
  });
  return token;
}

export async function checkDomainTxtForToken(domain: string, token: string): Promise<boolean> {
  const resolver = new Resolver();
  const hosts = [domain, `_aeobro.${domain}`];
  for (const host of hosts) {
    try {
      const records = await resolver.resolveTxt(host);
      const flattened = records.map(r => r.join("")).map(s => s.trim().toLowerCase());
      if (flattened.some(s => s.includes(`aeobro-verification=${token.toLowerCase()}`))) {
        return true;
      }
    } catch {/* ignore and try next */}
  }
  return false;
}
