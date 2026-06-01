import fs from "fs";
import { nanoid } from "nanoid";
import { getDb } from "@/server/db";
import { providers, accounts, publishDestinations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { ProviderType, DestinationType } from "@/lib/enums";

const DESTINATION_TYPE: Record<string, DestinationType> = {
  [ProviderType.youtube]: DestinationType.youtube_channel,
  [ProviderType.meta]: DestinationType.facebook_page,
  [ProviderType.tiktok]: DestinationType.tiktok_account,
  instagram: DestinationType.instagram_account,
};

export async function createDestinationForAccount(
  accountId: string,
  providerType: string,
  name: string,
  externalId?: string | null,
  avatarUrl?: string | null
) {
  const db = getDb();
  await db.insert(publishDestinations).values({
    id: `dest_${nanoid(8)}`,
    socialAccountId: accountId,
    name,
    type: DESTINATION_TYPE[providerType] ?? `${providerType}_account`,
    externalId: externalId ?? null,
    avatarUrl: avatarUrl ?? null,
    createdAt: new Date().toISOString(),
  });
}

export const REDIRECT_URI = "http://localhost:20129/api/accounts/oauth/callback";

export async function getProviderRecord(providerId: string) {
  const db = getDb();
  const provider = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .get();
  if (!provider) throw new Error(`Provider ${providerId} not found`);
  if (provider.type !== ProviderType.zernio && !provider.clientId)
    throw new Error(`Provider "${provider.name}" has no Client ID configured`);
  if (provider.type !== ProviderType.zernio && !provider.clientSecret)
    throw new Error(provider.type === ProviderType.zernio
      ? `Provider "${provider.name}" has no API key configured`
      : `Provider "${provider.name}" has no Client Secret configured`);
  return provider;
}

export async function getAccountRecord(accountId: string) {
  const db = getDb();
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .get();
  if (!account) throw new Error(`Account ${accountId} not found`);
  return account;
}

export function getMimeType(filePath: string): string {
  const ext = (filePath.split(".").pop() ?? "").toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    webm: "video/webm",
  };
  return map[ext] ?? "video/mp4";
}

export function readVideoFile(videoPath: string): { buffer: ArrayBuffer; size: number; mime: string } {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }
  const buf = fs.readFileSync(videoPath);
  // Slice to a clean ArrayBuffer so it is compatible with Web fetch BodyInit
  const buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return { buffer, size: buf.length, mime: getMimeType(videoPath) };
}

export async function checkHttpOk(res: Response, context: string) {
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`${context}: ${text}`);
  }
}
