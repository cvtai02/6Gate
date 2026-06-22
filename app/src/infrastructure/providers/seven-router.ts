import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db";
import { settings } from "@/infrastructure/db/schema";
import { decryptValue, encryptValue } from "@/core/security/crypto";
import { env } from "@/infrastructure/config/env";
import { downloadFromUrl } from "@/modules/groups/usecases/shared/storage-helper";

const SETTINGS_KEY_BASE_URL = "sevenRouterBaseUrl";
const SETTINGS_KEY_TOKEN = "sevenRouterAccessToken";

const DEFAULT_BASE_URL = "https://7router-api.minfect.com";

export async function getSevenRouterConfig(): Promise<{ baseUrl: string; accessToken: string | null }> {
  const db = getDb();
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY_BASE_URL))
    .then((r) => r[0]);
  const tokenRow = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY_TOKEN))
    .then((r) => r[0]);

  return {
    baseUrl: rows?.value ?? DEFAULT_BASE_URL,
    accessToken: tokenRow ? decryptValue(tokenRow.value, env.encryptionKey) : null,
  };
}

export async function setSevenRouterConfig(input: { baseUrl?: string; accessToken?: string }) {
  const db = getDb();
  const now = new Date().toISOString();

  if (input.baseUrl !== undefined) {
    await db
      .insert(settings)
      .values({ key: SETTINGS_KEY_BASE_URL, value: input.baseUrl, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: input.baseUrl, updatedAt: now } });
  }

  if (input.accessToken !== undefined) {
    const encrypted = encryptValue(input.accessToken, env.encryptionKey);
    await db
      .insert(settings)
      .values({ key: SETTINGS_KEY_TOKEN, value: encrypted, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: encrypted, updatedAt: now } });
  }
}

export function isSevenRouterPath(value: string): boolean {
  return !value.startsWith("http") && !value.startsWith("/") && value.includes("/");
}

async function resolveSevenRouterPath(absolutePath: string): Promise<string> {
  const config = await getSevenRouterConfig();
  if (!config.accessToken) throw new Error("7router access token is not configured");

  const res = await fetch(`${config.baseUrl}/files/temp-download-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify({ absolutePath, expiresInSeconds: 3600 }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`7router temp-download-url failed (HTTP ${res.status}): ${text}`);
  }

  const data = await res.json() as { url: string };
  return data.url;
}

export async function downloadSevenRouterFile(absolutePath: string): Promise<string> {
  const url = await resolveSevenRouterPath(absolutePath);
  return downloadFromUrl(url);
}
